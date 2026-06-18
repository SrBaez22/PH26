@echo off
echo =========================================
echo  Monitoramento Ambiental - Parando...
echo =========================================
echo.

echo [1/3] Parando MQTT Worker...
taskkill /FI "WINDOWTITLE eq MQTT Worker" /T /F >nul 2>&1

echo [2/3] Parando Backend API...
taskkill /FI "WINDOWTITLE eq Backend API" /T /F >nul 2>&1

echo [3/3] Parando Frontend...
taskkill /FI "WINDOWTITLE eq Frontend" /T /F >nul 2>&1

echo.
echo =========================================
echo  Todos os servicos encerrados!
echo =========================================
pause
