@echo off
cd /d C:\Users\Gabriel\Documents\autoestetia-pro\backend
echo Rodando prisma db push...
node node_modules\prisma\build\index.js db push --schema prisma\schema.prisma
echo.
echo Exit code: %ERRORLEVEL%
pause
