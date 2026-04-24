/**
 * Gera código de ativação curto e legível (ex: XKAP92BM).
 * Sem I, O, 0, 1 para evitar confusão visual.
 */
export function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
