#!/bin/bash

# Download YOLOv5n ONNX model for object detection
set -e

MODEL_DIR="public/models"
MODEL_FILE="yolov5n.onnx"
MODEL_URL="https://github.com/ultralytics/yolov5/releases/download/v6.0/yolov5n.onnx"

echo "📥 Downloading YOLOv5n ONNX model..."

# Create models directory
mkdir -p "$MODEL_DIR"

# Download model if it doesn't exist
if [ ! -f "$MODEL_DIR/$MODEL_FILE" ]; then
    echo "Downloading from: $MODEL_URL"
    curl -L -o "$MODEL_DIR/$MODEL_FILE" "$MODEL_URL"
    echo "✅ Model downloaded successfully"
else
    echo "✅ Model already exists"
fi

# Also copy to server models directory for server mode
mkdir -p "server/models"
cp "$MODEL_DIR/$MODEL_FILE" "server/models/$MODEL_FILE"

echo "📊 Model info:"
ls -lh "$MODEL_DIR/$MODEL_FILE"
echo "🎯 Model ready for both WASM and server modes"