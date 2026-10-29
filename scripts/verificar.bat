@echo off
rem Corre tests y builds de InstaYa! y deja el resultado en verificacion\*.log
setlocal
set RAIZ=%~dp0..
if not exist "%RAIZ%\verificacion" mkdir "%RAIZ%\verificacion"
del /q "%RAIZ%\verificacion\*.log" 2>nul

cd /d "%RAIZ%\backend"
call npx prisma generate > "%RAIZ%\verificacion\1-prisma.log" 2>&1
call npm test > "%RAIZ%\verificacion\2-backend-test.log" 2>&1
call npm run build > "%RAIZ%\verificacion\3-backend-build.log" 2>&1

cd /d "%RAIZ%\frontend"
call npm test > "%RAIZ%\verificacion\4-frontend-test.log" 2>&1
set VITE_DEMO=true
call npm run build > "%RAIZ%\verificacion\5-frontend-build.log" 2>&1
set PW_CHANNEL=chrome
call npx playwright test --reporter=list > "%RAIZ%\verificacion\6-e2e.log" 2>&1

echo listo > "%RAIZ%\verificacion\FIN.log"
endlocal
