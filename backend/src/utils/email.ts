import nodemailer from 'nodemailer';

const isDev = process.env.NODE_ENV !== 'production';

function createTransporter() {
  if (isDev) {
    // Em dev: imprime no console (não envia e-mail)
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

interface SendPasswordResetOptions {
  to: string;
  name: string;
  resetUrl: string;
  tenantName: string;
}

export async function sendPasswordResetEmail(opts: SendPasswordResetOptions): Promise<void> {
  const subject = `Redefinição de senha — ${opts.tenantName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Olá, ${opts.name}!</h2>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>${opts.tenantName}</strong>.</p>
      <p>Clique no botão abaixo para criar uma nova senha. Este link é válido por <strong>24 horas</strong>.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${opts.resetUrl}"
           style="background-color: #2563eb; color: white; padding: 12px 24px;
                  border-radius: 6px; text-decoration: none; font-size: 16px;">
          Redefinir senha
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">
        Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece a mesma.
      </p>
      <p style="color: #666; font-size: 14px;">
        Ou copie e cole este link no navegador:<br/>
        <a href="${opts.resetUrl}" style="color: #2563eb;">${opts.resetUrl}</a>
      </p>
    </div>
  `;

  if (isDev) {
    console.log(`\n[DEV] E-mail de recuperação de senha:`);
    console.log(`  Para: ${opts.to}`);
    console.log(`  Link: ${opts.resetUrl}\n`);
    return;
  }

  const transporter = createTransporter();
  if (!transporter) return;

  await transporter.sendMail({
    from: `"${opts.tenantName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: opts.to,
    subject,
    html,
  });
}
