@echo off
echo Iniciando AutoEstética Pro...
echo.

:: Verifica se as dependências do backend estão instaladas
if not exist "backend\node_modules" (
    echo Instalando dependências do backend...
    cd backend && npm install && cd ..
)

:: Verifica se as dependências do frontend estão instaladas
if not exist "frontend\node_modules" (
    echo Instalando dependências do frontend...
    cd frontend && npm install && cd ..
)

:: Inicializa o banco de dados se necessário
if not exist "backend\prisma\dev.db" (
    echo Criando banco de dados...
    cd backend && npm run db:push && npm run db:seed && cd ..
)

echo.
echo Iniciando backend na porta 3333...
start "Backend" cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak > nul

echo Iniciando frontend na porta 5173...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ✓ Sistema iniciado!
echo   Backend:  http://localhost:3333
echo   Frontend: http://localhost:5173
echo.
pause
