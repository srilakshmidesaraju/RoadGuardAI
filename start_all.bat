@echo off
echo Installing and Starting RoadGuard AI Services...

echo -- Starting Python AI Service --
call .venv\Scripts\python.exe -m pip install -r ai_service\requirements.txt
start "RoadGuard - AI Service (Python)" cmd /c ".venv\Scripts\python.exe ai_service\app.py"

echo -- Starting Node.js Backend --
cd backend
call npm install
start "RoadGuard - Backend (Node.js)" cmd /c "npm start"

echo.
echo =======================================
echo SERVICES STARTED!
echo Frontend is now accessible via Node.js
echo.
echo URL: http://localhost:3005/
echo =======================================
pause
