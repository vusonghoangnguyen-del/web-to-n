@echo off
setlocal
chcp 65001 >nul
title Khoi dong To Toan

cd /d "%~dp0"

echo ========================================
echo          KHOI DONG WEB TO TOAN
echo ========================================
echo.

where node.exe >nul 2>&1
if errorlevel 1 (
  echo [LOI] Chua tim thay Node.js tren may.
  echo Hay cai Node.js roi chay lai file nay.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [1/3] Dang cai dependency lan dau...
  call npm.cmd install
  if errorlevel 1 (
    echo [LOI] Khong cai duoc dependency.
    pause
    exit /b 1
  )
) else (
  echo [1/3] Dependency da san sang.
)

call :SETUP_LATEX

netstat -ano | findstr ":3001" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo [2/3] Dang khoi dong NestJS API tai cong 3001...
  start "To Toan - NestJS API" /D "%~dp0" cmd.exe /k "npm.cmd run dev:nest"
) else (
  echo [2/3] NestJS API da chay tai cong 3001.
)

netstat -ano | findstr ":5174" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo [3/3] Dang khoi dong Next.js tai cong 5174...
  start "To Toan - Next.js" /D "%~dp0" cmd.exe /k "npm.cmd run dev:next"
) else (
  echo [3/3] Next.js da chay tai cong 5174.
)

echo.
echo Dang cho API va website san sang...

set /a WAIT_COUNT=0
:WAIT_FOR_API
set /a WAIT_COUNT+=1
curl.exe --silent --fail --output nul "http://127.0.0.1:3001/api/v1/health" >nul 2>&1
if not errorlevel 1 goto WAIT_FOR_WEB_SETUP

if %WAIT_COUNT% GEQ 60 goto START_FAILED
ping 127.0.0.1 -n 2 >nul
goto WAIT_FOR_API

:WAIT_FOR_WEB_SETUP
set /a WAIT_COUNT=0
:WAIT_FOR_WEB
set /a WAIT_COUNT+=1
curl.exe --silent --fail --output nul "http://127.0.0.1:5174" >nul 2>&1
if not errorlevel 1 goto OPEN_WEB

if %WAIT_COUNT% GEQ 60 goto START_FAILED
ping 127.0.0.1 -n 2 >nul
goto WAIT_FOR_WEB

:START_FAILED
echo [LOI] API hoac website chua san sang. Xem loi trong cua so NestJS va Next.js.
pause
exit /b 1

:OPEN_WEB
echo Mo website: http://127.0.0.1:5174
start "" "http://127.0.0.1:5174"

echo.
echo Website dang chay. Khong dong hai cua so API va Next.js.
echo Ban co the dong cua so nay.
ping 127.0.0.1 -n 4 >nul
endlocal
exit /b 0

:SETUP_LATEX
where docker.exe >nul 2>&1
if errorlevel 1 (
  echo [CANH BAO] Chua tim thay Docker. Tinh nang bien dich LaTeX can Docker Desktop.
  exit /b 0
)
docker info >nul 2>&1
if errorlevel 1 (
  if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" start "" /min "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
  if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" start "" /min "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  echo Dang cho Docker Desktop...
)
set /a DOCKER_WAIT=0
:WAIT_FOR_DOCKER
docker info >nul 2>&1
if not errorlevel 1 goto DOCKER_READY
set /a DOCKER_WAIT+=1
if %DOCKER_WAIT% GEQ 60 goto DOCKER_UNAVAILABLE
ping 127.0.0.1 -n 2 >nul
goto WAIT_FOR_DOCKER
:DOCKER_READY
docker compose -f compose.latex.yml up -d
if errorlevel 1 goto DOCKER_UNAVAILABLE
start "To Toan - LaTeX Worker" /D "%~dp0" cmd.exe /k "npm.cmd run dev:worker"
exit /b 0
:DOCKER_UNAVAILABLE
echo [CANH BAO] Docker chua san sang. Hay mo Docker Desktop de bien dich LaTeX.
exit /b 0
