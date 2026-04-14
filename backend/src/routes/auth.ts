import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '../utils/prisma';

export const authRouter = Router();

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

function generateTokens(payload: { userId: string; tenantId: string; role: string; email: string }) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '8h' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });
  return { accessToken, refreshToken };
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
    const tokens = generateTokens({
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
    });

    res.status(201).json({
      message: 'Estética cadastrada com sucesso!',
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
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

    const tokens = generateTokens({
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
      email: user.email,
    });

    res.json({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, logoUrl: tenant.logoUrl },
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', async (req, res) => {
  const { slug, email } = req.body;
  if (!slug || !email) {
    res.status(400).json({ error: 'Slug e e-mail são obrigatórios' });
    return;
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    // Resposta genérica para não revelar se o tenant existe
    res.json({ message: 'Se o e-mail existir, você receberá um link para redefinir a senha.' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });

  if (!user || !user.active) {
    res.json({ message: 'Se o e-mail existir, você receberá um link para redefinir a senha.' });
    return;
  }

  const token = randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetExpiry: expiry },
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  // Em produção: enviar por e-mail. Por ora, retorna no dev.
  console.log(`[DEV] Link de recuperação: ${resetUrl}`);

  res.json({
    message: 'Se o e-mail existir, você receberá um link para redefinir a senha.',
    ...(process.env.NODE_ENV === 'development' ? { devResetUrl: resetUrl } : {}),
  });
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 8) {
    res.status(400).json({ error: 'Token e senha (mín. 8 caracteres) são obrigatórios' });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetToken: null, passwordResetExpiry: null },
  });

  res.json({ message: 'Senha redefinida com sucesso! Faça login.' });
});

// POST /api/auth/refresh
authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(401).json({ error: 'Refresh token não fornecido' });
    return;
  }
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      userId: string;
      tenantId: string;
      role: string;
      email: string;
    };
    const tokens = generateTokens(payload);
    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Refresh token inválido' });
  }
});
