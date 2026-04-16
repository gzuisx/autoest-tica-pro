import { Router, Request, Response } from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';

export const mercadopagoRouter = Router();

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

const PLANS = {
  basic: { price: 97, label: 'AutoEstética Pro — Plano Basic' },
  pro:   { price: 197, label: 'AutoEstética Pro — Plano Pro' },
};

// ─── Criar preferência de pagamento ──────────────────────────────────────────
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

// ─── Webhook — Mercado Pago notifica pagamentos ───────────────────────────────
mercadopagoRouter.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const { type, data } = req.body;

  // Responde 200 imediatamente para o MP não retentar
  res.sendStatus(200);

  if (type !== 'payment' || !data?.id) return;

  try {
    const { MercadoPagoConfig: MPConfig, Payment } = await import('mercadopago');
    const mpInst = new MPConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const paymentClient = new Payment(mpInst);
    const payment = await paymentClient.get({ id: data.id });

    if (payment.status !== 'approved') return;

    const externalRef = payment.external_reference;
    if (!externalRef) return;

    const [tenantId, plan] = externalRef.split('|');
    if (!tenantId || !['basic', 'pro'].includes(plan)) return;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan: plan as 'basic' | 'pro',
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 dias
      },
    });

    console.log(`[MP] Plano atualizado: tenant=${tenantId} plano=${plan}`);
  } catch (err: any) {
    console.error('[MP] Erro ao processar webhook:', err?.message);
  }
});

// ─── Rota pública — criar preferência da landing page ────────────────────────
mercadopagoRouter.post('/landing-preference', async (req: Request, res: Response): Promise<void> => {
  const { plan, email, name } = req.body as { plan: 'basic' | 'pro'; email?: string; name?: string };

  if (!PLANS[plan]) {
    res.status(400).json({ error: 'Plano inválido.' });
    return;
  }

  const landingUrl = process.env.LANDING_URL || process.env.FRONTEND_URL || 'https://autoest-tica-pro.vercel.app';

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
          success: `${landingUrl}/registro?payment=success&plan=${plan}`,
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
