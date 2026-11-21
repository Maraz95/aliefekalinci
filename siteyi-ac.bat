@echo off
REM Portfolyo sitesini yerelde acar: http://localhost:5500
cd /d "%~dp0"
echo Site aciliyor... Kapatmak icin bu pencereyi kapat.
start "" http://localhost:5500
where python >NUL 2>NUL && (python -m http.server 5500) || (py -m http.server 5500)
if errorlevel 1 (
  echo.
  echo Python bulunamadi. https://www.python.org/downloads/ adresinden kur, kurarken "Add to PATH" kutusunu isaretle.
  pause
)
