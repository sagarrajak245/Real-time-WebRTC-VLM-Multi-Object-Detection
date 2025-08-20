#!/bin/bash

# WebRTC Detection Startup Script
set -e

MODE=${MODE:-wasm}
NGROK=${1:-}
PORT=${PORT:-3000}

echo "🚀 Starting WebRTC Detection Demo"
echo "Mode: $MODE"
echo "Port: $PORT"
echo "Node version: $(node --version 2>/dev/null || echo 'Node.js not found')"

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | sed 's/v//')
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)
    if [ "$MAJOR_VERSION" -lt "20" ]; then
        echo "⚠️  Warning: Node.js 20+ recommended (current: $NODE_VERSION)"
    fi
fi

# Check if Docker is available
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "🐳 Using Docker..."
    
    # Set environment variable for mode
    export MODE=$MODE
    
    if [ "$NGROK" = "--ngrok" ]; then
        echo "🌐 Starting with ngrok support..."
        # Start ngrok in background if available
        if command -v ngrok &> /dev/null; then
            ngrok http $PORT &
            sleep 3
            NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*' | cut -d'"' -f4 | head -1)
            if [ ! -z "$NGROK_URL" ]; then
                echo "📱 Ngrok URL: $NGROK_URL"
            else
                echo "⚠️  Could not retrieve ngrok URL"
            fi
        else
            echo "⚠️  ngrok not found. Install it for external access."
        fi
    fi
    
    # Start with docker-compose
    docker-compose up --build
    
else
    echo "📦 Using local Node.js..."
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Download YOLO model if not present
    if [ ! -f "server/models/yolov5n.onnx" ]; then
        echo "📥 Downloading YOLO model..."
        mkdir -p server/models
        curl -L -o server/models/yolov5n.onnx "https://github.com/ultralytics/yolov5/releases/download/v6.0/yolov5n.onnx"
    fi
    
    # Copy model to public directory for WASM access
    if [ ! -f "public/models/yolov5n.onnx" ]; then
        echo "📋 Copying model for WASM access..."
        mkdir -p public/models
        cp server/models/yolov5n.onnx public/models/yolov5n.onnx
    fi
    
    # Start application with ngrok support
    if [ "$NGROK" = "--ngrok" ]; then
        echo "🌐 Starting with ngrok support..."
        if command -v ngrok &> /dev/null; then
            ngrok http $PORT &
            sleep 3
            NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*' | cut -d'"' -f4 | head -1)
            if [ ! -z "$NGROK_URL" ]; then
                echo "📱 Ngrok URL: $NGROK_URL"
            fi
        else
            echo "⚠️  ngrok not found. Install it for external access."
        fi
    fi
    
    # Start application
    MODE=$MODE npm start
fi
