@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Cai phan mem cho To Toan
cd /d "%~dp0"

echo ==========================================
echo       CAI PHAN MEM CHAY WEB TO TOAN
echo ==========================================
echo.
echo Script cai Node.js, MySQL Server, MySQL Workbench,
echo Docker Desktop va thu vien cua du an.
echo Can Internet va quyen Administrator. Co the chay lai neu bi ngat.
echo.

net session >nul 2>&1
if errorlevel 1 (
  echo [LOI] Hay nhan chuot phai file nay va chon "Run as administrator".
  pause
  exit /b 1
)

where winget.exe >nul 2>&1
if errorlevel 1 (
  echo [LOI] Chua co WinGet. Hay cai/cap nhat "App Installer" tu Microsoft Store.
  echo Sau do mo lai file BAT nay.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [LOI] Khong tim thay package.json. Dat file BAT o thu muc goc du an.
  pause
  exit /b 1
)

echo [1/5] Cai Node.js LTS...
call :INSTALL OpenJS.NodeJS.LTS "Node.js LTS"
if errorlevel 1 goto FAILED

echo [2/5] Cai MySQL Server...
call :INSTALL Oracle.MySQL "MySQL Server"
if errorlevel 1 goto FAILED

echo [3/5] Cai MySQL Workbench...
call :INSTALL Oracle.MySQLWorkbench "MySQL Workbench"
if errorlevel 1 goto FAILED

echo [4/5] Cai Docker Desktop...
call :INSTALL Docker.DockerDesktop "Docker Desktop"
if errorlevel 1 goto FAILED

echo [5/5] Cai thu vien cua du an...
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [CHUA XONG] Node.js vua duoc cai nhung terminal chua nhan PATH moi.
  echo Hay dong cua so nay, mo lai file BAT voi quyen Administrator.
  pause
  exit /b 2
)
call npm.cmd ci
if errorlevel 1 (
  echo [LOI] npm ci that bai. Kiem tra Internet va dung luong o dia.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo DA CAI XONG PHAN MEM VA THU VIEN DU AN
echo ==========================================
echo.
echo VIEC CAN LAM TIEP:
echo 1. Neu Windows/Docker yeu cau khoi dong lai hoac WSL 2, hay hoan tat.
echo 2. Cau hinh MySQL Server, dat mat khau root va dam bao dich vu dang chay.
echo 3. Mo HUONG_DAN_CHAY_LOCAL_MAY_KHAC.md, muc 3 de chon:
echo    A - database moi, hoac B - mang du lieu tu may cu.
echo 4. Mo Docker Desktop. Chay docker pull texlive/texlive:latest
echo    va docker compose -f compose.latex.yml up -d.
echo 5. Sau khi thiet lap database, bam dup KHOI_DONG_WEB.bat.
echo.
echo KHONG chay db:setup neu da co database/data cu.
pause
exit /b 0

:INSTALL
echo Dang kiem tra/cai %~2...
winget install --id %~1 --exact --source winget --no-upgrade --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo [LOI] Khong cai duoc %~2. Kiem tra thong bao WinGet phia tren.
  exit /b 1
)
exit /b 0

:FAILED
echo.
echo Da dung tai buoc bi loi. Sau khi sua loi, chay lai file BAT nay.
pause
exit /b 1
