#!/bin/bash

# Default to WASM mode if no argument is provided
# Usage: ./start.sh [server|wasm]
MODE=${1:-wasm}

# Check if the mode is valid
if [ "$MODE" != "server" ] && [ "$MODE" != "wasm" ]; then
    echo "❌ Invalid mode: $MODE. Please use 'server' or 'wasm'."
    exit 1
fi

echo "🚀 Starting application in '$MODE' mode..."

# Export the MODE variable so docker-compose can access it
export MODE

# Build and run the Docker containers in detached mode
# The --build flag ensures the image is rebuilt if the Dockerfile changes
docker-compose up --build -d

# The Node.js server will automatically start ngrok and display the QR code in the container logs.
# We'll follow the logs to display it directly in the user's terminal.
echo "✅ Application started. Waiting for ngrok QR code..."
echo "-----------------------------------------------------"

# Follow the logs of the service and exit when the QR code is found
docker-compose logs -f webrtc-detection-app | while read -r line; do
    echo "$line"
    # Exit the log stream once the QR code is printed to keep the terminal clean
    if [[ "$line" == *"QRCode"* ]]; then
        echo "-----------------------------------------------------"
        echo "📱 Scan the QR code above with your phone to connect."
        echo "ℹ️  Press Ctrl+C to stop viewing logs (the app will keep running)."
        break
    fi
done

# Keep the script attached to the logs so the user can see ongoing activity
docker-compose logs -f webrtc-detection-app
