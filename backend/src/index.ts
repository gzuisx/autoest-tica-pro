import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { sanitizeBody } from './middleware/sanitize';

import { prisma } from './utils/prisma';
import { authRouter } from './routes/auth';
import { clientsRouter } from './routes/clients';
import { vehiclesRouter } from './routes/vehicles';
import { servicesRouter } from './routes/services';
import { schedulesRouter } from './routes/schedules';
import { quotesRouter } from './routes/quotes';
import { serviceOrdersRouter } from './routes/serviceOrders';
import { paymentsRouter } from './routes/payments';
import { dashboardRouter } from './routes/dashboard';
import { photosRouter } from './routes/photos';
import { tenantRouter } from './routes/tenant';
import { reportsRouter } from './routes/reports';
import { auditLogRouter } from './routes/auditLog';
import { adminRouter } from './routes/admin';
import { planRouter } from './routes/plan';
import { leadsRouter } from './routes/leads';
import { mercadopagoRouter } from './routes/mercadopago';

const app = express();
const PORT = process.env.PORT || 3333;
const isDev = process.env.NODE_ENV === 'development';

// Railway usa proxy reverso — necessário para rate limit e IP correto funcionarem
app.set('trust proxy', 1);

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true },
  contentSecurityPolicy: isDev ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
}));

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

console.log('[CORS] Origens permitidas:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return isDev ? callback(null, true) : callback(new Error('Origin não fornecido'));
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.error('[CORS] Origem rejeitada:', origin);
    callback(new Error('Origem não permitida pelo CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limit geral
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Rate limit para autenticação (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Rate limit para uploads (anti abuso de armazenamento)
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,
  message: { error: 'Limite de uploads atingido. Aguarde 1 minuto.' },
});
app.use('/api/photos/upload', uploadLimiter);

// Rate limit para relatórios (queries pesadas)
const reportsLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 segundos
  max: 5,
  message: { error: 'Muitas requisições de relatório. Aguarde alguns segundos.' },
});
app.use('/api/reports', reportsLimiter);

// Rate limit para pagamentos e deleções críticas
const criticalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Muitas operações. Aguarde 1 minuto.' },
});
app.use('/api/payments', criticalLimiter);

// Rate limit para painel super-admin (anti brute-force)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/admin/login', adminLimiter);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeBody); // XSS sanitization — strips all HTML tags from string inputs

// ─── Static files (uploads) ──────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/tenant', tenantRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/services', servicesRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/service-orders', serviceOrdersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/photos', photosRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/audit-log', auditLogRouter);
app.use('/api/admin', adminRouter);
app.use('/api/plan', planRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/mercadopago', mercadopagoRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (isDev) {
    console.error(err.stack);
  } else {
    console.error(`[ERROR] ${err.message}`);
  }
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ─── Jobs de limpeza periódica ────────────────────────────────────────────────

async function cleanupExpiredRefreshTokens() {
  try {
    const { count } = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) console.log(`[Cleanup] ${count} refresh token(s) expirado(s) removido(s)`);
  } catch (err) {
    console.error('[Cleanup] Erro ao limpar refresh tokens:', err);
  }
}

async function downgradeExpiredPlans() {
  try {
    const { count } = await prisma.tenant.updateMany({
      where: {
        planExpiresAt: { lt: new Date() },
        plan: { not: 'free' },
      },
      data: { plan: 'free', planExpiresAt: null },
    });
    if (count > 0) console.log(`[Cleanup] ${count} plano(s) expirado(s) rebaixado(s) para free`);
  } catch (err) {
    console.error('[Cleanup] Erro ao rebaixar planos expirados:', err);
  }
}

app.listen(PORT, async () => {
  console.log(`🚀 AutoEstética Pro API rodando na porta ${PORT}`);

  // Executa limpeza imediata no startup
  await Promise.all([cleanupExpiredRefreshTokens(), downgradeExpiredPlans()]);

  // Agenda limpeza a cada 6 horas
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(cleanupExpiredRefreshTokens, SIX_HOURS);
  setInterval(downgradeExpiredPlans, SIX_HOURS);
});

export default app;
