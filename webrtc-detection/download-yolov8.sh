#!/bin/bash

# Download YOLOv8n ONNX model only
set -e

echo "📥 Downloading YOLOv8n ONNX model..."

# Create models directory
mkdir -p server/models
mkdir -p public/models

# YOLOv8n (Nano) - Optimized for real-time low-resource inference
echo "Downloading YOLOv8n (6.2MB)..."
curl -L -o server/models/yolov8n.onnx "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.onnx"
cp server/models/yolov8n.onnx public/models/yolov8n.onnx

echo "✅ YOLOv8n model downloaded successfully!"
echo "📊 Model info:"
ls -lh server/models/yolov8n.onnx
echo ""
echo "🎯 YOLOv8n Configuration:"
echo "- Input size: 320×320 (optimized for WebRTC)"
echo "- Confidence threshold: 0.55 (reduces false positives)"
echo "- Model size: 6.2MB (ultra-lightweight)"
echo "- Expected FPS: 12-15 on CPU/WASM"
echo "- mAP: 37.3 (excellent accuracy for nano model)"
echo ""
echo "🚀 Perfect for real-time WebRTC applications:"
echo "- Phone → browser live streaming"
echo "- Low-resource inference (WASM + modest laptops)"
echo "- Real-time object detection with overlays"
echo "- Multi-object detection with bounding boxes"