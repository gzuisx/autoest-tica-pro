/**
 * Gera links wa.me para abertura direta do WhatsApp com mensagem pré-preenchida.
 * Solução 100% gratuita, sem API externa.
 */

function formatPhone(phone: string): string {
  // Remove tudo que não é número, garante DDI 55 (Brasil)
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

function buildWaLink(phone: string, message: string): string {
  const formattedPhone = formatPhone(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

export function waLinkConfirmSchedule(
  phone: string,
  clientName: string,
  date: string,
  time: string,
  services: string[],
  tenantName: string,
): string {
  const serviceList = services.join(', ');
  const message =
    `Olá, ${clientName}! 👋\n\n` +
    `Confirmamos seu agendamento na *${tenantName}*:\n\n` +
    `📅 Data: ${date}\n` +
    `🕐 Horário: ${time}\n` +
    `✂️ Serviços: ${serviceList}\n\n` +
    `Confirme respondendo *SIM* ou entre em contato caso precise remarcar.\n\nTe esperamos! 🙌✨`;
  return buildWaLink(phone, message);
}

export function waLinkScheduleUpdate(
  phone: string,
  clientName: string,
  date: string,
  time: string,
  services: string[],
  tenantName: string,
): string {
  const serviceList = services.join(', ');
  const message =
    `Olá, ${clientName}! 👋\n\n` +
    `Seu agendamento na *${tenantName}* foi atualizado:\n\n` +
    `📅 Nova data: ${date}\n` +
    `🕐 Novo horário: ${time}\n` +
    `✂️ Serviços: ${serviceList}\n\n` +
    `Qualquer dúvida, entre em contato. Te esperamos! 🙌✨`;
  return buildWaLink(phone, message);
}

export function waLinkQuote(
  phone: string,
  clientName: string,
  vehicle: string,
  services: string[],
  totalValue: number,
  tenantName: string,
): string {
  const serviceList = services.map((s) => `  • ${s}`).join('\n');
  const formattedValue = totalValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const message =
    `Olá, ${clientName}! 👋\n\n` +
    `Segue seu orçamento da *${tenantName}*:\n\n` +
    `🚗 Veículo: ${vehicle}\n\n` +
    `Serviços:\n${serviceList}\n\n` +
    `💰 *Total: ${formattedValue}*\n\n` +
    `Responda *APROVO* para confirmar ou entre em contato para dúvidas. 😊`;
  return buildWaLink(phone, message);
}

export function waLinkReturnReminder(
  phone: string,
  clientName: string,
  lastServiceDays: number,
  tenantName: string,
): string {
  const message =
    `Olá, ${clientName}! 🚗✨\n\n` +
    `Faz ${lastServiceDays} dias desde sua última visita na *${tenantName}*.\n\n` +
    `Que tal agendar uma revisão para manter seu carro sempre impecável?\n\n` +
    `Responda esta mensagem para marcarmos o melhor horário para você! 😊`;
  return buildWaLink(phone, message);
}

export function waLinkBirthday(
  phone: string,
  clientName: string,
  tenantName: string,
): string {
  const message =
    `Feliz aniversário, ${clientName}! 🎉🎂\n\n` +
    `A equipe da *${tenantName}* deseja um ótimo dia para você!\n\n` +
    `Como presente, temos uma surpresa especial te esperando. Entre em contato e saiba mais! 🎁🚗`;
  return buildWaLink(phone, message);
}
