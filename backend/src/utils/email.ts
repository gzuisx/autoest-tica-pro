import nodemailer from 'nodemailer';

const isDev = process.env.NODE_ENV !== 'production';

// Resend.com via SMTP:
//   SMTP_HOST=smtp.resend.com
//   SMTP_PORT=465
//   SMTP_SECURE=true
//   SMTP_USER=resend
//   SMTP_PASS=<sua API key do Resend>
//   SMTP_FROM=noreply@seudominio.com.br

function createTransporter() {
  if (isDev) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false', // true por padrão (Resend usa 465/SSL)
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function baseLayout(content: string): string {
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;padding:32px 16px;min-height:100vh;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <div style="background:#4f46e5;padding:28px 32px;text-align:center;">
        <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">&#9632; AutoEstética Pro</span>
      </div>
      <div style="padding:36px 32px;">
        ${content}
      </div>
      <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">
          Este e-mail foi enviado automaticamente. Não responda a esta mensagem.
        </p>
      </div>
    </div>
  </div>`;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  if (isDev) {
    console.log(`\n[DEV EMAIL] ─────────────────────`);
    console.log(`  Para: ${to}`);
    console.log(`  Assunto: ${subject}`);
    const code = html.match(/letter-spacing:8px[^>]*>([A-Z0-9]{6,8})</)?.[1];
    const link = html.match(/href="(https?:\/\/[^"]+(?:reset|register)[^"]+)"/)?.[1];
    if (code) console.log(`  Código: ${code}`);
    if (link) console.log(`  Link: ${link}`);
    console.log(`──────────────────────────────────\n`);
    return;
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_PASS) {
    console.warn(`[EMAIL] SMTP não configurado — e-mail não enviado para ${to} (${subject})`);
    return;
  }

  const transporter = createTransporter();
  if (!transporter) return;
  await transporter.sendMail({
    from: `"AutoEstética Pro" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

// ─── Verificação de e-mail (cadastro) ────────────────────────────────────────

interface SendVerificationOptions {
  to: string;
  name: string;
  code: string; // 6 dígitos em texto
}

export async function sendVerificationEmail(opts: SendVerificationOptions): Promise<void> {
  const html = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Confirme seu e-mail</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">
      Olá, <strong>${opts.name}</strong>! Use o código abaixo para ativar sua conta no AutoEstética Pro.
    </p>
    <div style="background:#f0f0ff;border:2px dashed #6366f1;border-radius:10px;padding:28px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;color:#6366f1;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Seu código de verificação</p>
      <span style="font-size:40px;font-weight:800;color:#4f46e5;letter-spacing:8px;font-family:monospace;">${opts.code}</span>
    </div>
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
      &#9679; Este código expira em <strong>30 minutos</strong>.
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;">
      &#9679; Se você não criou esta conta, ignore este e-mail.
    </p>
  `);
  await send(opts.to, 'Seu código de verificação — AutoEstética Pro', html);
}

// ─── Recuperação de senha ─────────────────────────────────────────────────────

interface SendPasswordResetOptions {
  to: string;
  name: string;
  resetUrl: string;
  tenantName: string;
}

export async function sendPasswordResetEmail(opts: SendPasswordResetOptions): Promise<void> {
  const html = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Redefinir sua senha</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">
      Olá, <strong>${opts.name}</strong>! Recebemos uma solicitação para redefinir a senha da sua conta em <strong>${opts.tenantName}</strong>.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${opts.resetUrl}"
         style="background:#4f46e5;color:#ffffff;padding:14px 32px;border-radius:8px;
                text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">
        Redefinir senha
      </a>
    </div>
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
      &#9679; Este link é válido por <strong>24 horas</strong>.
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
      &#9679; Se você não solicitou, ignore este e-mail. Sua senha permanece a mesma.
    </p>
    <p style="margin:0;font-size:13px;color:#9ca3af;word-break:break-all;">
      Ou cole este link no navegador: <a href="${opts.resetUrl}" style="color:#6366f1;">${opts.resetUrl}</a>
    </p>
  `);
  await send(opts.to, `Redefinição de senha — ${opts.tenantName}`, html);
}

// ─── Boas-vindas após verificação de e-mail ──────────────────────────────────

interface SendWelcomeOptions {
  to: string;
  name: string;
  tenantName: string;
  appUrl: string;
}

export async function sendWelcomeEmail(opts: SendWelcomeOptions): Promise<void> {
  const html = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Bem-vindo ao AutoEstética Pro! 🎉</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;">
      Olá, <strong>${opts.name}</strong>! Sua conta da <strong>${opts.tenantName}</strong> está ativa.
      Você tem <strong>14 dias grátis</strong> para explorar tudo.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#15803d;">Por onde começar:</p>
      <p style="margin:0 0 6px;font-size:14px;color:#374151;">&#9642; Cadastre seus serviços no catálogo</p>
      <p style="margin:0 0 6px;font-size:14px;color:#374151;">&#9642; Adicione seus primeiros clientes</p>
      <p style="margin:0 0 6px;font-size:14px;color:#374151;">&#9642; Crie seu primeiro agendamento ou OS</p>
      <p style="margin:0;font-size:14px;color:#374151;">&#9642; Confira o dashboard para ver o resumo do dia</p>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${opts.appUrl}"
         style="background:#4f46e5;color:#ffffff;padding:14px 32px;border-radius:8px;
                text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">
        Acessar minha conta
      </a>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      Alguma dúvida? Responda este e-mail — estamos aqui para ajudar.
    </p>
  `);
  await send(opts.to, `Bem-vindo à AutoEstética Pro, ${opts.name}!`, html);
}

// ─── Link de cadastro pós-pagamento ──────────────────────────────────────────

interface SendRegistrationLinkOptions {
  to: string;
  plan: 'basic' | 'pro' | 'trial';
  activationCode: string; // código curto legível (ex: XKAP92BM)
  registerUrl: string;    // URL com ?token=... (para o botão do e-mail)
}

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic — R$ 97/mês',
  pro:   'Pro — R$ 197/mês',
  trial: 'Gratuito — 14 dias',
};

export async function sendRegistrationLinkEmail(opts: SendRegistrationLinkOptions): Promise<void> {
  const planLabel = PLAN_LABELS[opts.plan] ?? opts.plan;
  const isTrial = opts.plan === 'trial';
  const html = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
      ${isTrial ? 'Seu teste grátis está pronto!' : 'Pagamento confirmado! Crie sua conta'}
    </h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;">
      ${isTrial
        ? 'Você ganhou <strong>14 dias grátis</strong> do AutoEstética Pro. Use o código abaixo para criar sua conta agora mesmo — sem precisar de cartão.'
        : `Seu pagamento do <strong>Plano ${planLabel}</strong> foi aprovado. Use o código abaixo para criar sua conta no AutoEstética Pro.`
      }
    </p>
    <div style="background:#f0f0ff;border:2px dashed #6366f1;border-radius:10px;padding:28px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;color:#6366f1;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Seu código de ativação</p>
      <span style="font-size:36px;font-weight:800;color:#4f46e5;letter-spacing:8px;font-family:monospace;">${opts.activationCode}</span>
      <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Digite este código na tela de cadastro</p>
    </div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:14px;color:#15803d;font-weight:700;">Seu plano inclui:</p>
      ${opts.plan === 'pro' ? `
        <p style="margin:0 0 4px;font-size:14px;color:#374151;">&#10003; Usuários ilimitados</p>
        <p style="margin:0 0 4px;font-size:14px;color:#374151;">&#10003; Notificação automática no WhatsApp</p>
        <p style="margin:0 0 4px;font-size:14px;color:#374151;">&#10003; Relatórios avançados + PDF</p>
        <p style="margin:0;font-size:14px;color:#374151;">&#10003; Suporte prioritário via WhatsApp</p>
      ` : `
        <p style="margin:0 0 4px;font-size:14px;color:#374151;">&#10003; Agenda com detecção de conflito</p>
        <p style="margin:0 0 4px;font-size:14px;color:#374151;">&#10003; Ordens de serviço com fotos</p>
        <p style="margin:0 0 4px;font-size:14px;color:#374151;">&#10003; Relatórios básicos (CSV)</p>
        <p style="margin:0;font-size:14px;color:#374151;">&#10003; Até 2 usuários</p>
      `}
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${opts.registerUrl}"
         style="background:#4f46e5;color:#ffffff;padding:16px 40px;border-radius:8px;
                text-decoration:none;font-size:16px;font-weight:700;display:inline-block;">
        Criar minha conta agora
      </a>
    </div>
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
      &#9679; O código e o link são <strong>de uso único</strong> e expiram em <strong>48 horas</strong>.
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
      &#9679; Se você não realizou este pagamento, entre em contato conosco.
    </p>
    <p style="margin:0;font-size:13px;color:#9ca3af;word-break:break-all;">
      Ou cole este link no navegador: <a href="${opts.registerUrl}" style="color:#6366f1;">${opts.registerUrl}</a>
    </p>
  `);
  await send(opts.to, `Seu acesso ao AutoEstética Pro está pronto — Plano ${planLabel}`, html);
}

// ─── Notificação de novo lead (landing page) → Gabriel ───────────────────────

interface SendLeadNotificationOptions {
  leadEmail: string;
  leadName?: string;
  source?: string; // ex: 'hero', 'pricing-pro', 'cta-form'
}

export async function sendLeadNotification(opts: SendLeadNotificationOptions): Promise<void> {
  const ownerEmail = process.env.OWNER_EMAIL || 'gabrieldejesusf10@gmail.com';
  const html = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">Novo lead na landing page! 🚀</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;">
      Alguém demonstrou interesse no AutoEstética Pro.
    </p>
    <div style="background:#f0f0ff;border:1px solid #c7d2fe;border-radius:10px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>E-mail:</strong> ${opts.leadEmail}</p>
      ${opts.leadName ? `<p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Nome:</strong> ${opts.leadName}</p>` : ''}
      ${opts.source ? `<p style="margin:0;font-size:14px;color:#374151;"><strong>Origem:</strong> ${opts.source}</p>` : ''}
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;">
      Entre em contato o quanto antes — leads quentes convertem melhor!
    </p>
  `);
  await send(ownerEmail, `Novo lead: ${opts.leadEmail}`, html);
}
