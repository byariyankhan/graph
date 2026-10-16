@echo off
REM DocuGraph installer for Windows (unsigned / developer mode).
REM Copies the extension and enables unsigned CEP extensions (PlayerDebugMode).
setlocal
set "SRC=%~dp0..\extension"
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.docugraph.ae"
echo Installing DocuGraph to "%DEST%"
if exist "%DEST%" rmdir /s /q "%DEST%"
xcopy "%SRC%" "%DEST%\" /e /i /q /y >nul
for %%V in (9 10 11 12 13) do reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
echo Done. Restart After Effects, then open Window ^> Extensions ^> DocuGraph.
pause
