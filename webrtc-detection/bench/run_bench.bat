@echo off
REM WebRTC Detection Benchmark Runner for Windows

set DURATION=%1
set MODE=%2
set OUTPUT_FILE=bench\metrics.json

if "%DURATION%"=="" set DURATION=30
if "%MODE%"=="" set MODE=wasm

echo 🔬 Running WebRTC Detection Benchmark
echo Duration: %DURATION% seconds
echo Mode: %MODE%
echo Output: %OUTPUT_FILE%

REM Check if server is running
curl -s http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    echo 🚀 Starting server...
    start /b npm start
    timeout /t 5 >nul
) else (
    echo ✅ Server already running
)

REM Wait for server to be ready
echo ⏳ Waiting for server to be ready...
for /l %%i in (1,1,30) do (
    curl -s http://localhost:3000/health >nul 2>&1
    if not errorlevel 1 (
        echo ✅ Server is ready
        goto :server_ready
    )
    timeout /t 1 >nul
)

:server_ready
REM Trigger benchmark via API
echo 📊 Starting %DURATION%s benchmark...
curl -X POST "http://localhost:3000/api/benchmark/start" -H "Content-Type: application/json" -d "{\"duration\": %DURATION%, \"mode\": \"%MODE%\"}"

REM Wait for benchmark to complete
timeout /t %DURATION% >nul
timeout /t 5 >nul

REM Fetch results
echo 📈 Fetching benchmark results...
curl -s "http://localhost:3000/api/benchmark/results" > "%OUTPUT_FILE%"

if exist "%OUTPUT_FILE%" (
    echo ✅ Benchmark completed successfully!
    echo 📄 Results saved to: %OUTPUT_FILE%
    echo.
    echo 📊 Quick Summary:
    type "%OUTPUT_FILE%" | findstr "median_ms processed_fps total_frames"
) else (
    echo ❌ Failed to save benchmark results
    exit /b 1
)