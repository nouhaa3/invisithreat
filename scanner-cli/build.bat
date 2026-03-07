@echo off
echo.
echo  [InvisiThreat] Installing dependencies...
pip install pyinstaller click requests
if %errorlevel% neq 0 (
    echo  ERROR: pip install failed. Make sure Python is installed.
    pause
    exit /b 1
)
echo.
echo  [InvisiThreat] Building invisithreat.exe ...
python -m PyInstaller --onefile --name invisithreat scanner.py
if %errorlevel% neq 0 (
    echo  ERROR: Build failed.
    pause
    exit /b 1
)
echo.
echo  [InvisiThreat] Copying to frontend public folder for download...
if not exist "..\frontend\public\downloads" mkdir "..\frontend\public\downloads"
copy /Y "dist\invisithreat.exe" "..\frontend\public\downloads\invisithreat.exe"
if %errorlevel% neq 0 (
    echo  WARNING: Could not copy to frontend/public/downloads — copy dist\invisithreat.exe manually.
) else (
    echo  Copied to frontend\public\downloads\invisithreat.exe
)
echo.
echo  ============================================
echo   Done!
echo   - Standalone exe: dist\invisithreat.exe
echo   - Served via platform at: /downloads/invisithreat.exe
echo   - Users download it from the Developer page
echo  ============================================
echo.
pause
