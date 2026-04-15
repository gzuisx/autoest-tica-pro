import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { sendLeadNotification } from '../utils/email';

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

// POST /api/leads — chamado pelo formulário da landing page
leadsRouter.post('/', leadsLimiter, async (req, res) => {
  try {
    const data = leadSchema.parse(req.body);

    // Notifica Gabriel sem bloquear a resposta
    sendLeadNotification({
      leadEmail: data.email,
      leadName: data.name,
      source: data.source,
    }).catch(() => {/* silencia erro de e-mail */});

    res.json({ message: 'Obrigado! Entraremos em contato em breve.' });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});
