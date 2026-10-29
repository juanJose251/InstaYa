@echo off
rem Activa el plan Basico despues de confirmar el pago. Uso: activar-plan.cmd 1   (meses)
rem InstaYa! debe estar abierto.
"%~dp0node\node.exe" "%~dp0instaya.mjs" --activar %1
pause
