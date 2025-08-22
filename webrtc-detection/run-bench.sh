#!/bin/bash

# This script triggers a benchmark on an ALREADY RUNNING application instance.

# --- Default values ---
DURATION=30
MODE="wasm"

# --- Parse command-line arguments ---
while [ "$#" -gt 0 ]; do
  case "$1" in
    --duration) DURATION="$2"; shift 2;;
    --mode) MODE="$2"; shift 2;;
    *) echo "Unknown parameter passed: $1"; exit 1;;
  esac
done

# --- Validate mode ---
if [ "$MODE" != "server" ] && [ "$MODE" != "wasm" ]; then
    echo "❌ Invalid mode: $MODE. Please use 'server' or 'wasm'."
    exit 1
fi

echo "📊 Starting a $DURATION-second benchmark in '$MODE' mode on the running application..."

# 1. Start the benchmark via API call
echo "🏁 Triggering benchmark..."
curl -X POST -H "Content-Type: application/json" \
     -d "{\"duration\": $DURATION, \"mode\": \"$MODE\"}" \
     http://localhost:3000/api/benchmark/start

# 2. Wait for the benchmark to complete
echo "⏱️ Benchmark is running. Waiting for $DURATION seconds..."
sleep $DURATION

# 3. Fetch and save the results
echo "📈 Fetching results..."
curl http://localhost:3000/api/benchmark/results > bench/metrics.json

# 4. Check if the results file was created and is not empty
if [ -s "bench/metrics.json" ]; then
    echo "✅ Benchmark complete! Results saved to bench/metrics.json"
else
    echo "❌ Failed to fetch benchmark results. Is the application running and processing video?"
fi

echo "✨ Done."   
