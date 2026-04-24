import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { sendLeadNotification, sendRegistrationLinkEmail } from '../utils/email';
import { generateActivationCode } from '../utils/tokens';

export const leadsRouter = Router();

const leadsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  message: { error: 'Muitas solicitações. Tente novamente em 1 hora.' },
});

const leadSchema = z.object({
  email: z.string().email('E-mail inválido'),
  name: z.string().optional(),
  source: z.string().optional(),
});

// POST /api/leads — chamado pelo formulário da landing page (lead simples)
leadsRouter.post('/', leadsLimiter, async (req, res) => {
  try {
    const data = leadSchema.parse(req.body);

    sendLeadNotification({
      leadEmail: data.email,
      leadName: data.name,
      source: data.source,
    }).catch(() => {});

    res.json({ message: 'Obrigado! Entraremos em contato em breve.' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/leads/trial — cria trial de 14 dias e envia código por e-mail
leadsRouter.post('/trial', leadsLimiter, async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email('E-mail inválido') }).parse(req.body);

    // Evita criar token duplicado para o mesmo e-mail (se já tiver um válido, ignora)
    const existing = await prisma.registrationToken.findFirst({
      where: { email, plan: 'trial', used: false, expiresAt: { gt: new Date() } },
    });

    if (!existing) {
      const token = generateActivationCode();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

      await prisma.registrationToken.create({
        data: { token, plan: 'trial', email, expiresAt },
      });

      const frontendUrl = process.env.FRONTEND_URL || 'https://autoest-tica-pro.vercel.app';
      const registerUrl = `${frontendUrl}/register?token=${token}`;

      sendRegistrationLinkEmail({
        to: email,
        plan: 'trial',
        activationCode: token,
        registerUrl,
      }).catch(err => console.error('[Trial] Falha ao enviar e-mail:', err?.message));
    }

    // Notifica Gabriel também
    sendLeadNotification({ leadEmail: email, source: 'trial-cta' }).catch(() => {});

    res.json({ message: 'Código de acesso enviado! Verifique seu e-mail.' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error('[Trial] Erro:', err?.message);
    res.status(500).json({ error: 'Erro ao criar conta de teste. Tente novamente.' });
  }
});
