process.chdir('C:\\Users\\Gabriel\\Documents\\autoestetia-pro\\backend');
require('dotenv').config();
const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe("SELECT count(*) as total FROM pg_tables WHERE schemaname='public'")
  .then(r => {
    console.log('TABELAS_NO_BANCO:' + r[0].total);
  })
  .catch(e => console.log('ERRO:' + e.message))
  .finally(() => p.$disconnect());
