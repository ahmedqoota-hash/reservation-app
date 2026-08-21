@echo off
echo === Installing backend dependencies ===
cd /d C:\Users\AHMED\.kiro\reservation-app\backend
"C:\Program Files\nodejs\npm.cmd" install
echo Backend install exit: %ERRORLEVEL%

echo === Installing frontend dependencies ===
cd /d C:\Users\AHMED\.kiro\reservation-app\frontend
"C:\Program Files\nodejs\npm.cmd" install
echo Frontend install exit: %ERRORLEVEL%

echo === Building frontend ===
cd /d C:\Users\AHMED\.kiro\reservation-app\frontend
"C:\Program Files\nodejs\npm.cmd" run build
echo Frontend build exit: %ERRORLEVEL%

echo === ALL DONE ===
