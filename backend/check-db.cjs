require('dotenv').config();
const { Client } = require('pg');

const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"))
  .then(r => {
    const tables = r.rows.map(x => x.tablename);
    const fs = require('fs');
    const msg = 'OK: ' + tables.length + ' tabelas: ' + tables.join(', ');
    console.log(msg);
    fs.writeFileSync('C:\\\\Users\\\\Gabriel\\\\Desktop\\\\dbcheck.txt', msg);
    c.end();
  })
  .catch(e => {
    const fs = require('fs');
    fs.writeFileSync('C:\\\\Users\\\\Gabriel\\\\Desktop\\\\dbcheck.txt', 'ERRO: ' + e.message);
    console.log('ERRO:', e.message);
    c.end();
  });
