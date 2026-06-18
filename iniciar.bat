@echo off
echo =========================================
echo  Monitoramento Ambiental - Iniciando...
echo =========================================
echo.

echo [1/3] Iniciando o Worker MQTT (connection.py)...
start "MQTT Worker" cmd /k ".venv\Scripts\python.exe connection.py"

timeout /t 2 /nobreak > nul

echo [2/3] Iniciando o Backend FastAPI...
start "Backend API" cmd /k ".venv\Scripts\python.exe backend\main.py"

timeout /t 2 /nobreak > nul

echo [3/3] Iniciando o Frontend React...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo =========================================
echo  Tudo iniciado! Abra:
echo  Dashboard: http://localhost:5173
echo  API:       http://localhost:8000
echo =========================================
echo.
echo Lembre-se de iniciar o simulador no Wokwi!
echo https://wokwi.com/projects/465306576952814593
pause
