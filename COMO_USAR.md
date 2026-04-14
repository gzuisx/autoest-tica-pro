# AutoEstética Pro — Como usar

## Iniciar o sistema

Execute o arquivo `start.bat` na pasta do projeto.
Ele vai instalar dependências, criar o banco e subir backend + frontend automaticamente.

Ou manualmente:

### Terminal 1 — Backend
```
cd backend
npm run dev
```

### Terminal 2 — Frontend
```
cd frontend
npm run dev
```

## Acessar o sistema

Abra o navegador em: http://localhost:5173

## Conta de demonstração (já criada)

- **Identificador:** demo-estetica
- **E-mail:** admin@demo.com
- **Senha:** demo123456

## Criar sua própria conta

Acesse http://localhost:5173/register e cadastre sua estética.

## Banco de dados

- Arquivo: `backend/prisma/dev.db`
- Ver dados: `cd backend && npm run db:studio`
- Resetar: delete o arquivo `dev.db` e rode `npm run db:push && npm run db:seed`

## Estrutura do projeto

```
autoestetia-pro/
├── backend/           → API Node.js + Express + Prisma
│   ├── src/routes/    → Todas as rotas da API
│   ├── prisma/        → Schema do banco de dados
│   └── .env           → Configurações (mude os secrets em produção!)
└── frontend/          → React + Vite + Tailwind
    └── src/pages/     → Todas as telas do sistema
```

## Deploy em produção

1. Troque `DATABASE_URL` no `.env` para PostgreSQL
2. Mude `JWT_SECRET` e `JWT_REFRESH_SECRET` para valores fortes
3. Deploy backend no Railway ou Render
4. Deploy frontend no Vercel ou Netlify
