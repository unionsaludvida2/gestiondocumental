@echo off
chcp 65001 > nul
title Sistema de Gestion Documental - Servidor Local
cd /d "%~dp0"

echo =================================================================
echo   Iniciando Servidor Local con Sincronizacion en Vivo de OneDrive
echo   Union para la salud y la vida S.A.S.
echo =================================================================
echo.

if exist "%USERPROFILE%\.venv_estandarizador\Scripts\python.exe" (
    set "PYTHON_CMD=%USERPROFILE%\.venv_estandarizador\Scripts\python.exe"
) else if exist "%~dp0.venv\Scripts\python.exe" (
    set "PYTHON_CMD=%~dp0.venv\Scripts\python.exe"
) else (
    set "PYTHON_CMD=python"
)

echo Abriendo navegador en http://localhost:8080 ...
start "" "http://localhost:8080"

echo Servidor en ejecucion. Para detenerlo, cierra esta ventana.
echo.
"%PYTHON_CMD%" server.py 8080
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Ocurrio un error al ejecutar el servidor local.
    pause
)