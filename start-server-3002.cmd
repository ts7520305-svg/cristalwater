@echo off
title Cristal Water - Servidor Local 3002
cd /d "%~dp0"

echo.
echo =====================================================
echo   CRISTAL WATER - SERVIDOR LOCAL
echo =====================================================
echo.
echo Esta janela tem de ficar aberta.
echo Se fechar esta janela, o browser deixa de mostrar o sistema.
echo.
echo Quando aparecer "Cristal Water Enterprise ativo",
echo atualiza o browser do Codex em:
echo http://127.0.0.1:3002/admin-pools
echo.

if exist "C:\Program Files\nodejs\node.exe" (
  "C:\Program Files\nodejs\node.exe" src\server.js
) else (
  node src\server.js
)

echo.
echo O servidor parou. Verifica a mensagem acima.
pause
