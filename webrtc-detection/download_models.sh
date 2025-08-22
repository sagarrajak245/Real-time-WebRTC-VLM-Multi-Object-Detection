#!/bin/bash

# YOLO Model Download Script
# Downloads YOLOv5n and YOLOv8n models to public/models and server/models

echo "🚀 Starting YOLO model download..."

# Model URLs (your provided links)
YOLO5N_URL="https://drive.google.com/uc?export=download&id=1L34kjXyXw-ARzKfsk6p-g75Zd8x-VUGE"
YOLO8N_URL="https://drive.google.com/uc?export=download&id=1ieW8oEUXXrTG2VhMORXqiP6qSLtMmix8"

# Create directories
echo "📁 Creating directories..."
mkdir -p public/models
mkdir -p server/models

# Function to download with Google Drive virus scan bypass
download_gdrive_file() {
    local url=$1
    local output_file=$2
    local filename=$(basename "$output_file")
    
    echo "⬇️  Downloading $filename..."
    
    # First attempt - direct download
    if command -v curl >/dev/null 2>&1; then
        curl -L -c /tmp/cookies.txt -s "$url" > /tmp/intermezzo.html
        curl -L -b /tmp/cookies.txt -s "$(egrep -o 'https://drive.google.com/uc\?export=download[^"]*' /tmp/intermezzo.html | head -1)" > "$output_file"
    else
        echo "❌ Error: curl is required for Google Drive downloads"
        return 1
    fi
    
    # Check if file was downloaded successfully
    if [ -s "$output_file" ]; then
        local filesize=$(stat -c%s "$output_file" 2>/dev/null || stat -f%z "$output_file" 2>/dev/null || echo "0")
        if [ "$filesize" -gt 1000 ]; then
            echo "✅ Successfully downloaded $filename ($(du -h "$output_file" | cut -f1))"
            return 0
        else
            echo "⚠️  Small file detected, trying alternative method..."
            rm -f "$output_file"
        fi
    fi
    
    # Alternative method for large files
    echo "🔄 Trying alternative download method..."
    local file_id=$(echo "$url" | grep -oP '(?<=id=)[^&]*')
    local confirm_url="https://drive.google.com/uc?export=download&confirm=1&id=$file_id"
    
    if curl -L -o "$output_file" "$confirm_url"; then
        if [ -s "$output_file" ]; then
            local filesize=$(stat -c%s "$output_file" 2>/dev/null || stat -f%z "$output_file" 2>/dev/null || echo "0")
            if [ "$filesize" -gt 1000 ]; then
                echo "✅ Successfully downloaded $filename ($(du -h "$output_file" | cut -f1))"
                return 0
            fi
        fi
    fi
    
    echo "❌ Failed to download $filename"
    return 1
}

# Download YOLOv5n
echo ""
echo "🔄 Downloading YOLOv5n model..."
if download_gdrive_file "$YOLO5N_URL" "public/models/yolov5n.onnx"; then
    cp "public/models/yolov5n.onnx" "server/models/yolov5n.onnx"
    echo "📋 Copied yolov5n.onnx to server/models/"
else
    echo "❌ YOLOv5n download failed"
fi

echo ""
echo "🔄 Downloading YOLOv8n model..."
if download_gdrive_file "$YOLO8N_URL" "public/models/yolov8n.onnx"; then
    cp "public/models/yolov8n.onnx" "server/models/yolov8n.onnx"
    echo "📋 Copied yolov8n.onnx to server/models/"
else
    echo "❌ YOLOv8n download failed"
fi

# Clean up temporary files
rm -f /tmp/cookies.txt /tmp/intermezzo.html

# Verify downloads
echo ""
echo "🔍 Verification Results:"
echo "Public models:"
ls -la public/models/ 2>/dev/null || echo "No files in public/models/"

echo ""
echo "Server models:"
ls -la server/models/ 2>/dev/null || echo "No files in server/models/"

echo ""
if [ -f "public/models/yolov5n.onnx" ] && [ -f "public/models/yolov8n.onnx" ]; then
    echo "✨ All models downloaded successfully!"
else
    echo "⚠️  Some models failed to download. You may need to:"
    echo "   1. Check your internet connection"
    echo "   2. Verify the Google Drive links are publicly accessible"
    echo "   3. Try downloading manually from the Google Drive links"
fi

echo ""
echo "🎯 Project ready for WebRTC detection!"     