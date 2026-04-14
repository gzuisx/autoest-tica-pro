import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

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

const app = express();
const PORT = process.env.PORT || 3333;

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});
app.use('/api/', limiter);

// Rate limit específico para rotas de autenticação (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 AutoEstética Pro API rodando na porta ${PORT}`);
});

export default app;
