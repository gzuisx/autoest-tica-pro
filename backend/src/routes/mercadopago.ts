import { Router, Request, Response } from 'express';
import { createHmac } from 'crypto';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import rateLimit from 'express-rate-limit';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { sendRegistrationLinkEmail } from '../utils/email';
import { generateActivationCode } from '../utils/tokens';

export const mercadopagoRouter = Router();

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

// Rate limit para rota pública da landing (evita abuso de API do MP)
const landingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const PLANS = {
  basic: { price: 97, label: 'AutoEstética Pro — Plano Basic' },
  pro:   { price: 197, label: 'AutoEstética Pro — Plano Pro' },
};

// ─── Validação de assinatura do webhook do Mercado Pago ───────────────────────
// IMPORTANTE: Configurar MP_WEBHOOK_SECRET no Railway com o secret do painel MP
// para que esta validação funcione em produção.
function validateMPWebhookSignature(req: Request): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[MP Webhook] AVISO: MP_WEBHOOK_SECRET não configurado — validação ignorada. Configure no Railway!');
    return true;
  }

  const signatureHeader = req.headers['x-signature'] as string | undefined;
  const requestId = req.headers['x-request-id'] as string | undefined;

  if (!signatureHeader || !requestId) {
    console.warn('[MP Webhook] Headers x-signature ou x-request-id ausentes');
    return false;
  }

  // Formato: "ts=TIMESTAMP,v1=HMAC_SHA256"
  const ts = signatureHeader.split(',').find(p => p.startsWith('ts='))?.split('=')[1];
  const v1 = signatureHeader.split(',').find(p => p.startsWith('v1='))?.split('=')[1];

  if (!ts || !v1) {
    console.warn('[MP Webhook] Formato de x-signature inválido');
    return false;
  }

  const dataId = req.body?.data?.id;
  const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expectedHash = createHmac('sha256', secret).update(template).digest('hex');

  if (expectedHash !== v1) {
    console.warn('[MP Webhook] Assinatura inválida — possível tentativa de fraude bloqueada');
    return false;
  }

  return true;
}

// ─── POST /api/mercadopago/create-preference — autenticado (upgrade no app) ──
mercadopagoRouter.post('/create-preference', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { plan } = req.body as { plan: 'basic' | 'pro' };

  if (!PLANS[plan]) {
    res.status(400).json({ error: 'Plano inválido. Use "basic" ou "pro".' });
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.user!.tenantId },
    select: { name: true, email: true },
  });

  if (!tenant) {
    res.status(404).json({ error: 'Tenant não encontrado' });
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const preference = new Preference(mp);
    const result = await preference.create({
      body: {
        items: [
          {
            id: plan,
            title: PLANS[plan].label,
            quantity: 1,
            unit_price: PLANS[plan].price,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: tenant.email || undefined,
        },
        back_urls: {
          success: `${frontendUrl}/settings?payment=success&plan=${plan}`,
          failure: `${frontendUrl}/settings?payment=failure`,
          pending: `${frontendUrl}/settings?payment=pending`,
        },
        auto_return: 'approved',
        external_reference: `${req.user!.tenantId}|${plan}`,
        notification_url: `${process.env.BACKEND_URL || 'https://autoest-tica-pro-production.up.railway.app'}/api/mercadopago/webhook`,
      },
    });

    res.json({ checkoutUrl: result.init_point, preferenceId: result.id });
  } catch (err: any) {
    console.error('[MP] Erro ao criar preferência:', err?.message);
    res.status(500).json({ error: 'Erro ao criar pagamento. Tente novamente.' });
  }
});

// ─── POST /api/mercadopago/webhook — notificações do Mercado Pago ─────────────
mercadopagoRouter.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  // Responde 200 imediatamente para o MP não retentar
  res.sendStatus(200);

  // Valida assinatura antes de processar
  if (!validateMPWebhookSignature(req)) {
    console.warn('[MP Webhook] Requisição rejeitada: assinatura inválida');
    return;
  }

  const { type, data } = req.body;
  if (type !== 'payment' || !data?.id) return;

  try {
    const { MercadoPagoConfig: MPConfig, Payment } = await import('mercadopago');
    const mpInst = new MPConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const paymentClient = new Payment(mpInst);
    const payment = await paymentClient.get({ id: data.id });

    if (payment.status !== 'approved') return;

    const externalRef = payment.external_reference;
    if (!externalRef) return;

    const parts = externalRef.split('|');

    // Pagamento da landing: "landing|plan|email" — gera token de cadastro e envia email
    if (parts[0] === 'landing') {
      const plan = parts[1] as 'basic' | 'pro';
      const email = parts[2];

      if (!email || email === 'unknown' || !['basic', 'pro'].includes(plan)) {
        console.warn('[MP Webhook] Landing payment sem email válido:', externalRef);
        return;
      }

      const token = generateActivationCode();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

      await prisma.registrationToken.create({
        data: { token, plan, email, expiresAt },
      });

      const frontendUrl = process.env.FRONTEND_URL || 'https://autoest-tica-pro.vercel.app';
      const registerUrl = `${frontendUrl}/register?token=${token}`;

      await sendRegistrationLinkEmail({ to: email, plan, activationCode: token, registerUrl });

      console.log(`[MP Webhook] Token de cadastro gerado e email enviado: plano=${plan} email=${email}`);
      return;
    }

    // Pagamento do app: "tenantId|plan"
    const [tenantId, plan] = parts;
    if (!tenantId || !['basic', 'pro'].includes(plan)) return;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan: plan as 'basic' | 'pro',
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 dias
      },
    });

    console.log(`[MP Webhook] Plano atualizado: tenant=${tenantId} plano=${plan}`);
  } catch (err: any) {
    console.error('[MP Webhook] Erro ao processar:', err?.message);
  }
});

// ─── GET /api/mercadopago/payment-return — retorno do MP após pagamento da landing ──
// MP redireciona aqui com ?payment_id=...&status=approved&external_reference=...
// Backend verifica o pagamento, gera token e redireciona para /register?token=...
mercadopagoRouter.get('/payment-return', async (req: Request, res: Response): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'https://autoest-tica-pro.vercel.app';
  const landingUrl  = process.env.LANDING_URL  || 'https://autoest-tica-pro-landing.vercel.app';

  const { payment_id, status, external_reference } = req.query as Record<string, string>;

  if (status !== 'approved' || !payment_id || !external_reference) {
    res.redirect(`${landingUrl}?payment=failure`);
    return;
  }

  const parts = external_reference.split('|');
  if (parts[0] !== 'landing' || parts.length < 3) {
    res.redirect(`${frontendUrl}/register?payment=success`);
    return;
  }

  const plan  = parts[1] as 'basic' | 'pro';
  const email = parts[2];

  if (!email || email === 'unknown' || !['basic', 'pro'].includes(plan)) {
    res.redirect(`${frontendUrl}/register?payment=success&plan=${plan}`);
    return;
  }

  try {
    // Verifica se webhook já criou token para este email (idempotência)
    const existing = await prisma.registrationToken.findFirst({
      where: { email, plan, used: false, expiresAt: { gt: new Date() } },
    });

    let token: string;

    if (existing) {
      token = existing.token;
      console.log(`[payment-return] Token existente reutilizado: email=${email}`);
    } else {
      // Verifica pagamento diretamente com a API do MP
      const { MercadoPagoConfig: MPConfig, Payment } = await import('mercadopago');
      const mpInst = new MPConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
      const paymentClient = new Payment(mpInst);
      const payment = await paymentClient.get({ id: Number(payment_id) });

      if (payment.status !== 'approved') {
        res.redirect(`${landingUrl}?payment=failure`);
        return;
      }

      token = generateActivationCode();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

      await prisma.registrationToken.create({
        data: { token, plan, email, expiresAt },
      });

      const registerUrl = `${frontendUrl}/register?token=${token}`;
      sendRegistrationLinkEmail({ to: email, plan, activationCode: token, registerUrl })
        .catch(err => console.error('[payment-return] Falha ao enviar email:', err?.message));

      console.log(`[payment-return] Token gerado: plano=${plan} email=${email}`);
    }

    // Redireciona direto para o cadastro com o token — sem precisar esperar e-mail
    res.redirect(`${frontendUrl}/register?token=${token}`);
  } catch (err: any) {
    console.error('[payment-return] Erro:', err?.message);
    res.redirect(`${frontendUrl}/register?payment=success&plan=${plan}`);
  }
});

// ─── POST /api/mercadopago/landing-preference — rota pública (landing page) ───
mercadopagoRouter.post('/landing-preference', landingLimiter, async (req: Request, res: Response): Promise<void> => {
  const { plan, email, name } = req.body as { plan: 'basic' | 'pro'; email?: string; name?: string };

  if (!PLANS[plan]) {
    res.status(400).json({ error: 'Plano inválido.' });
    return;
  }

  const landingUrl = process.env.LANDING_URL || 'https://autoest-tica-pro-landing.vercel.app';
  const frontendUrl = process.env.FRONTEND_URL || 'https://autoest-tica-pro.vercel.app';

  try {
    const preference = new Preference(mp);
    const result = await preference.create({
      body: {
        items: [
          {
            id: plan,
            title: PLANS[plan].label,
            quantity: 1,
            unit_price: PLANS[plan].price,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: email || undefined,
          name: name || undefined,
        },
        back_urls: {
          success: `${process.env.BACKEND_URL || 'https://autoest-tica-pro-production.up.railway.app'}/api/mercadopago/payment-return`,
          failure: `${landingUrl}?payment=failure`,
          pending: `${landingUrl}?payment=pending`,
        },
        auto_return: 'approved',
        external_reference: `landing|${plan}|${email || 'unknown'}`,
        notification_url: `${process.env.BACKEND_URL || 'https://autoest-tica-pro-production.up.railway.app'}/api/mercadopago/webhook`,
      },
    });

    res.json({ checkoutUrl: result.init_point });
  } catch (err: any) {
    console.error('[MP] Erro landing preference:', err?.message);
    res.status(500).json({ error: 'Erro ao iniciar pagamento.' });
  }
});
