import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../utils/prisma';
import { sendPasswordResetEmail } from '../utils/email';
import { authenticate } from '../middleware/auth';
import * as audit from '../utils/auditLog';

export const authRouter = Router();

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas. Aguarde 1 hora antes de tentar novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerSchema = z.object({
  tenantName: z.string().min(2, 'Nome da estética muito curto'),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug inválido (use apenas letras minúsculas, números e -'),
  ownerName: z.string().min(2),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  slug: z.string(),
});

const REFRESH_TOKEN_EXPIRY_DAYS = 30;

function generateAccessToken(payload: { userId: string; tenantId: string; role: string; email: string }) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '8h' });
}

async function createRefreshToken(userId: string, tenantId: string): Promise<string> {
  const rawToken = randomBytes(40).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { tokenHash, userId, tenantId, expiresAt },
  });

  return rawToken;
}

async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await prisma.refreshToken.deleteMany({ where: { tokenHash } }).catch(() => {});
}

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    const slugExists = await prisma.tenant.findUnique({ where: { slug: data.tenantSlug } });
    if (slugExists) {
      res.status(409).json({ error: 'Este identificador já está em uso. Escolha outro.' });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const tenant = await prisma.tenant.create({
      data: {
        name: data.tenantName,
        slug: data.tenantSlug,
        phone: data.phone,
        email: data.email,
        users: {
          create: {
            name: data.ownerName,
            email: data.email,
            passwordHash,
            role: 'admin',
          },
        },
      },
      include: { users: true },
    });

    const user = tenant.users[0];
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
      details: { event: 'register' },
    });

    res.status(201).json({
      message: 'Estética cadastrada com sucesso!',
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
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

// POST /api/auth/login
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

// POST /api/auth/logout
authRouter.post('/logout', authenticate, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  await audit.log({
    tenantId: req.user!.tenantId,
    userId: req.user!.userId,
    action: 'LOGOUT',
    entity: 'user',
    entityId: req.user!.userId,
  });

  res.json({ message: 'Logout realizado com sucesso' });
});

// POST /api/auth/refresh
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
      // Token expirado ou inválido — remove se existir
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

    // Rotação: revoga o token atual e emite um novo par
    await prisma.refreshToken.delete({ where: { tokenHash } });

    const newAccessToken = generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });
    const newRefreshToken = await createRefreshToken(user.id, user.tenantId);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: 'Erro ao validar refresh token' });
  }
});

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { slug, email } = req.body;
  if (!slug || !email) {
    res.status(400).json({ error: 'Slug e e-mail são obrigatórios' });
    return;
  }

  const genericMsg = { message: 'Se o e-mail existir, você receberá um link para redefinir a senha.' };

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    res.json(genericMsg);
    return;
  }

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });

  if (!user || !user.active) {
    res.json(genericMsg);
    return;
  }

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: tokenHash, passwordResetExpiry: expiry },
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
    tenantName: tenant.name,
  });

  res.json(genericMsg);
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 8) {
    res.status(400).json({ error: 'Token e senha (mín. 8 caracteres) são obrigatórios' });
    return;
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Invalida todos os refresh tokens do usuário após troca de senha
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiry: null },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);

  res.json({ message: 'Senha redefinida com sucesso! Faça login.' });
});
