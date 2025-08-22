#!/bin/bash

# Default values
DURATION=30
MODE="wasm"

# Parse command-line arguments
while [ "$#" -gt 0 ]; do
  case "$1" in
    --duration) DURATION="$2"; shift 2;;
    --mode) MODE="$2"; shift 2;;
    *) echo "Unknown parameter passed: $1"; exit 1;;
  esac
done

# Validate mode
if [ "$MODE" != "server" ] && [ "$MODE" != "wasm" ]; then
    echo "❌ Invalid mode: $MODE. Please use 'server' or 'wasm'."
    exit 1
fi

echo "📊 Starting a $DURATION-second benchmark in '$MODE' mode..."

# Export the MODE variable for docker-compose
export MODE

# 1. Start the application in the background
echo "🚀 Building and starting services..."
docker-compose up --build -d

# Wait for the server to be fully ready
echo "⏳ Waiting for the server to initialize (15 seconds)..."
sleep 15

# 2. Start the benchmark via API call
echo "🏁 Triggering benchmark..."
curl -X POST -H "Content-Type: application/json" \
     -d "{\"duration\": $DURATION, \"mode\": \"$MODE\"}" \
     http://localhost:3000/api/benchmark/start

# 3. Wait for the benchmark to complete
echo "⏱️ Benchmark is running. Waiting for $DURATION seconds..."
sleep $DURATION

# 4. Fetch and save the results
echo "📈 Fetching results..."
curl http://localhost:3000/api/benchmark/results > bench/metrics.json

# Check if the results file was created and is not empty
if [ -s "bench/metrics.json" ]; then
    echo "✅ Benchmark complete! Results saved to bench/metrics.json"
else
    echo "❌ Failed to fetch benchmark results."
fi

# 5. Clean up and stop the containers
echo "🛑 Stopping services..."
docker-compose down

echo "✨ Done."
