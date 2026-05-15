@echo off
echo ========================================
echo   KING PACK - Actualizando servidor...
echo ========================================
echo.
echo Conectando al VPS...
echo Cuando pida contrasena, escribi: Macciotec2026.
echo.
ssh root@76.13.112.206 "cd /root/KINGPACK && git pull origin master && pm2 restart all && pm2 status"
echo.
echo ========================================
echo   Listo! Servidor actualizado.
echo ========================================
pause
