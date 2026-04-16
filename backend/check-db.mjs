import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
try {
  const r = await p.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  console.log('✅ Banco conectado!', r.length, 'tabelas criadas:');
  console.log(r.map(x => x.tablename).join(', '));
} catch (e) {
  console.log('❌ Erro:', e.message);
} finally {
  await p.$disconnect();
}
