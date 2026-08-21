@echo off
cd /d "C:\Users\AHMED\.kiro\reservation-app\frontend"
"C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build > "C:\Users\AHMED\.kiro\reservation-app\build.log" 2>&1
echo BUILD_EXIT:%ERRORLEVEL% >> "C:\Users\AHMED\.kiro\reservation-app\build.log"
