import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../utils/prisma';
import { sendPasswordResetEmail, sendVerificationEmail, sendWelcomeEmail } from '../utils/email';
import { authenticate } from '../middleware/auth';
import * as audit from '../utils/auditLog';

export const authRouter = Router();

// ─── Rate limiters ────────────────────────────────────────────────────────────

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Muitas tentativas. Aguarde 1 hora antes de tentar novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  tenantName: z.string().min(2, 'Nome da estética muito curto'),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug inválido (use apenas letras minúsculas, números e -'),
  ownerName: z.string().min(2),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  phone: z.string().optional(),
  registrationToken: z.string().optional(), // token pós-pagamento da landing
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  slug: z.string(),
});

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateAccessToken(payload: { userId: string; tenantId: string; role: string; email: string }) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

async function createRefreshToken(userId: string, tenantId: string): Promise<string> {
  const rawToken = randomBytes(40).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { tokenHash, userId, tenantId, expiresAt } });
  return rawToken;
}

async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await prisma.refreshToken.deleteMany({ where: { tokenHash } }).catch(() => {});
}

/** Gera código de 6 dígitos e retorna { code, codeHash } */
function generateVerificationCode(): { code: string; codeHash: string } {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = createHash('sha256').update(code).digest('hex');
  return { code, codeHash };
}

// ─── GET /api/auth/registration-token — valida token de cadastro pós-pagamento
authRouter.get('/registration-token', async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Token não fornecido' });
    return;
  }

  const record = await prisma.registrationToken.findUnique({ where: { token } });

  if (!record || record.used || record.expiresAt < new Date()) {
    res.status(400).json({ error: 'Link inválido, já utilizado ou expirado.' });
    return;
  }

  res.json({ valid: true, plan: record.plan, email: record.email });
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────

authRouter.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Valida token de cadastro pós-pagamento (se fornecido)
    let registrationTokenRecord: { id: string; plan: string } | null = null;
    if (data.registrationToken) {
      const record = await prisma.registrationToken.findUnique({
        where: { token: data.registrationToken },
      });
      if (!record || record.used || record.expiresAt < new Date()) {
        res.status(400).json({ error: 'Link de cadastro inválido ou expirado. Solicite um novo.' });
        return;
      }
      registrationTokenRecord = record;
    }

    const slugExists = await prisma.tenant.findUnique({ where: { slug: data.tenantSlug } });
    if (slugExists) {
      res.status(409).json({ error: 'Este identificador já está em uso. Escolha outro.' });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const { code, codeHash } = generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 30 * 60 * 1000);

    // Se veio com token de pagamento, aplica o plano pago automaticamente
    const paidPlan = registrationTokenRecord?.plan;
    const planExpiresAt = paidPlan
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : undefined;

    const tenant = await prisma.tenant.create({
      data: {
        name: data.tenantName,
        slug: data.tenantSlug,
        phone: data.phone,
        email: data.email,
        ...(paidPlan && { plan: paidPlan, planExpiresAt }),
        users: {
          create: {
            name: data.ownerName,
            email: data.email,
            passwordHash,
            role: 'admin',
            emailVerified: false,
            emailVerificationCode: codeHash,
            emailVerificationExpiry: verificationExpiry,
          },
        },
      },
      include: { users: true },
    });

    const user = tenant.users[0];

    // Marca token como usado
    if (registrationTokenRecord) {
      await prisma.registrationToken.update({
        where: { id: registrationTokenRecord.id },
        data: { used: true },
      });
    }

    await sendVerificationEmail({ to: user.email, name: user.name, code });

    res.status(201).json({
      message: 'Conta criada! Verifique seu e-mail para ativar o acesso.',
      pendingVerification: true,
      email: user.email,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
});

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────

authRouter.post('/verify-email', verificationLimiter, async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    res.status(400).json({ error: 'E-mail e código são obrigatórios' });
    return;
  }

  const codeHash = createHash('sha256').update(String(code)).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      email: String(email),
      emailVerificationCode: codeHash,
      emailVerificationExpiry: { gt: new Date() },
      emailVerified: false,
    },
    include: { tenant: true },
  });

  if (!user) {
    res.status(400).json({ error: 'Código inválido ou expirado. Solicite um novo.' });
    return;
  }

  // Ativa a conta
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationExpiry: null,
    },
  });

  // Gera tokens e faz login automático após verificação
  const accessToken = generateAccessToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  });
  const refreshToken = await createRefreshToken(user.id, user.tenantId);

  await audit.log({
    tenantId: user.tenantId,
    userId: user.id,
    userName: user.name,
    action: 'LOGIN',
    entity: 'user',
    entityId: user.id,
    details: { event: 'email_verified' },
  });

  // Boas-vindas — dispara sem bloquear a resposta
  sendWelcomeEmail({
    to: user.email,
    name: user.name,
    tenantName: user.tenant.name,
    appUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  }).catch(() => {/* silencia erro de e-mail */});

  res.json({
    message: 'E-mail verificado com sucesso! Bem-vindo.',
    tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug, logoUrl: user.tenant.logoUrl },
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  });
});

// ─── POST /api/auth/resend-verification ──────────────────────────────────────

authRouter.post('/resend-verification', verificationLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'E-mail é obrigatório' });
    return;
  }

  const user = await prisma.user.findFirst({
    where: { email: String(email), emailVerified: false },
  });

  // Resposta genérica para não revelar se o e-mail existe
  const genericMsg = { message: 'Se o e-mail existir, um novo código foi enviado.' };

  if (!user) {
    res.json(genericMsg);
    return;
  }

  const { code, codeHash } = generateVerificationCode();
  const verificationExpiry = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationCode: codeHash, emailVerificationExpiry: verificationExpiry },
  });

  await sendVerificationEmail({ to: user.email, name: user.name, code });

  res.json(genericMsg);
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const tenant = await prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (!tenant || !tenant.active) {
      res.status(401).json({ error: 'Estética não encontrada ou inativa' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: data.email } },
    });

    if (!user || !user.active) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const passwordMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    // Bloqueia login se e-mail não verificado
    if (!user.emailVerified) {
      res.status(403).json({
        error: 'E-mail não verificado. Verifique sua caixa de entrada.',
        pendingVerification: true,
        email: user.email,
      });
      return;
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
    });
    const refreshToken = await createRefreshToken(user.id, tenant.id);

    await audit.log({
      tenantId: tenant.id,
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      entity: 'user',
      entityId: user.id,
    });

    res.json({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, logoUrl: tenant.logoUrl },
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

authRouter.post('/logout', authenticate, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await revokeRefreshToken(refreshToken);

  await audit.log({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    action: 'LOGOUT',
    entity: 'user',
    entityId: req.user!.userId,
  });

  res.json({ message: 'Logout realizado com sucesso' });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(401).json({ error: 'Refresh token não fornecido' });
    return;
  }
  try {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { tokenHash } });
      res.status(401).json({ error: 'Refresh token inválido ou expirado. Faça login novamente.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, tenantId: true, role: true, email: true, active: true },
    });

    if (!user || !user.active) {
      await prisma.refreshToken.delete({ where: { tokenHash } });
      res.status(401).json({ error: 'Usuário inativo' });
      return;
    }

    await prisma.refreshToken.delete({ where: { tokenHash } });
    const newAccessToken = generateAccessToken({ userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email });
    const newRefreshToken = await createRefreshToken(user.id, user.tenantId);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: 'Erro ao validar refresh token' });
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

authRouter.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { slug, email } = req.body;
  if (!slug || !email) {
    res.status(400).json({ error: 'Slug e e-mail são obrigatórios' });
    return;
  }

  const genericMsg = { message: 'Se o e-mail existir, você receberá um link para redefinir a senha.' };

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) { res.json(genericMsg); return; }

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });

  if (!user || !user.active) { res.json(genericMsg); return; }

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: tokenHash, passwordResetExpiry: expiry },
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

  await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl, tenantName: tenant.name });

  res.json(genericMsg);
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 8) {
    res.status(400).json({ error: 'Token e senha (mín. 8 caracteres) são obrigatórios' });
    return;
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const user = await prisma.user.findFirst({
    where: { passwordResetToken: tokenHash, passwordResetExpiry: { gt: new Date() } },
  });

  if (!user) {
    res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiry: null },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);

  res.json({ message: 'Senha redefinida com sucesso! Faça login.' });
});
