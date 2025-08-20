#!/bin/bash

# WebRTC Detection Benchmark Runner
set -e

DURATION=${1:-30}
MODE=${2:-wasm}
OUTPUT_FILE="bench/metrics.json"

echo "🔬 Running WebRTC Detection Benchmark"
echo "Duration: ${DURATION} seconds"
echo "Mode: ${MODE}"
echo "Output: ${OUTPUT_FILE}"

# Start server in background if not running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "🚀 Starting server..."
    MODE=${MODE} npm start &
    SERVER_PID=$!
    sleep 5
    
    # Cleanup function
    cleanup() {
        echo "🧹 Cleaning up..."
        kill $SERVER_PID 2>/dev/null || true
    }
    trap cleanup EXIT
else
    echo "✅ Server already running"
fi

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Server is ready"
        break
    fi
    sleep 1
done

# Trigger benchmark via API
echo "📊 Starting ${DURATION}s benchmark..."
curl -X POST "http://localhost:3000/api/benchmark/start" \
    -H "Content-Type: application/json" \
    -d "{\"duration\": ${DURATION}, \"mode\": \"${MODE}\"}"

# Wait for benchmark to complete
sleep $((DURATION + 5))

# Fetch results
echo "📈 Fetching benchmark results..."
curl -s "http://localhost:3000/api/benchmark/results" > "${OUTPUT_FILE}"

if [ -f "${OUTPUT_FILE}" ]; then
    echo "✅ Benchmark completed successfully!"
    echo "📄 Results saved to: ${OUTPUT_FILE}"
    echo ""
    echo "📊 Quick Summary:"
    cat "${OUTPUT_FILE}" | grep -E '"median_ms"|"processed_fps"|"total_frames"' || echo "Results format may vary"
else
    echo "❌ Failed to save benchmark results"
    exit 1
fi