# WebRTC Real-time Object Detection System

A production-ready system for real-time multi-object detection on live video streams from mobile phones via WebRTC. Features dual-mode inference (client-side WASM or server-side processing), advanced performance metrics, and smart frame queue management with backpressure handling.

## Demo Video
🎥 **[1-minute Loom Demo](YOUR_LOOM_URL_HERE)** - Shows live phone → browser detection with metrics

## Quick Start

### One-Command Setup
```bash
git clone <your-repo-url>
cd webrtc-detection
./start.sh
```

Open `http://localhost:3000` on your laptop, scan the QR code with your phone, and start detecting objects in real-time.

### Docker Compose (Recommended)
```bash
docker-compose up --build
```

### Manual Setup
```bash
npm install
MODE=wasm npm start    # Client-side inference
MODE=server npm start  # Server-side inference
```

## System Architecture

### Dual-Mode Processing
- **WASM Mode** (Default): Client-side inference using YOLOv5n with ONNX Runtime Web
- **Server Mode**: Server-side inference using YOLOv8n with ONNX Runtime Node.js

### Key Components
- **WebRTC Pipeline**: Phone camera → WebRTC → Browser display with overlays
- **Smart Frame Processor**: Advanced queue management with backpressure (server mode)
- **Bandwidth Monitor**: Real-time WebRTC connection quality tracking
- **Benchmark Suite**: Comprehensive performance analysis with 30+ metrics

## Performance Metrics

### WASM Mode (Client-side YOLOv5n)
```json
{
  "processed_fps": 18.7,
  "e2e_latency": {
    "median_ms": 83,
    "p95_ms": 193
  },
  "network_stats": {
    "downlink_kbps": { "avg": 1964.4, "peak": 3732.9 }
  },
  "detection_rate": 1.0,
  "bottleneck_detection": "Server Processing"
}
```

### Server Mode (Server-side YOLOv8n)
```json
{
  "processed_fps": 7.5,
  "e2e_latency": {
    "median_ms": 74,
    "p95_ms": 109
  },
  "latency_breakdown": {
    "network": { "median_ms": 1 },
    "server_processing": { "median_ms": 72 },
    "queue_wait": { "median_ms": 1 }
  },
  "queue_utilization": "10.00%"
}
```

## Phone Connection Instructions

### Method 1: QR Code (Recommended)
1. Ensure phone and laptop are on the same WiFi network
2. Start the server with `./start.sh`
3. Scan the displayed QR code with your phone camera
4. Allow camera permissions in your browser

### Method 2: Public URL via ngrok
```bash
./start.sh --ngrok    # Exposes public URL for remote access
```

### Method 3: Manual IP Entry
```bash
# Find your local IP
ip addr show | grep inet

# On phone, navigate to:
# http://YOUR_LOCAL_IP:3000/phone
```

### Supported Browsers
- **Android**: Chrome (recommended), Firefox
- **iOS**: Safari (latest), Chrome
- **Requirements**: WebRTC support, camera access

## Benchmarking

### Quick Benchmark
```bash
./bench/run_bench.sh --duration 30 --mode wasm
```

### Advanced Benchmarking
```bash
# Server mode with extended duration
./bench/run_bench.sh --duration 60 --mode server

# Custom configuration
MODE=wasm DURATION=45 ./bench/run_bench.sh
```

### Benchmark Output
Results saved to `bench/metrics.json` with:
- End-to-end latency (median, P95, mean)
- Processing FPS and detection rates
- Network bandwidth utilization
- Frame processing statistics
- Performance bottleneck analysis

## Low-Resource Mode Features

### Adaptive Processing
- **Input Resolution**: 320x320 pixels (optimized for mobile)
- **Frame Rate**: 8 FPS capture, adaptive processing
- **Memory Management**: Automatic cleanup and garbage collection
- **Queue Management**: Smart frame dropping with backpressure

### WASM Optimizations
- Quantized YOLOv5n model (5MB)
- Single-threaded processing for CPU efficiency
- Client-side inference reduces server load
- Automatic fallback to mock detection if model fails

### Resource Requirements
- **Minimum**: Intel i5 dual-core, 4GB RAM
- **Recommended**: Intel i5 quad-core, 8GB RAM
- **Network**: 2 Mbps uplink (phone), 1 Mbps downlink (browser)

## Configuration Options

### Environment Variables
```bash
MODE=wasm|server          # Processing mode
PORT=3000                 # Server port
INPUT_SIZE=320            # Model input resolution
MAX_QUEUE_SIZE=10         # Frame processor queue size
PROCESSING_TIMEOUT=5000   # Frame timeout (ms)
```

### Runtime Mode Switching
```bash
# Switch to server mode
./start.sh --mode server

# Enable debug logging
DEBUG=true ./start.sh

# Custom port
PORT=8080 ./start.sh
```

## Advanced Features

### Real-time Metrics Dashboard
- Live FPS and latency monitoring
- Network bandwidth tracking (uplink/downlink)
- WebRTC connection quality (RTT, jitter, packet loss)
- Frame processing queue status
- Detailed latency breakdown (network/server/queue)

### Smart Frame Processing
- **Backpressure Handling**: Drops oldest frames when queue is full
- **Timeout Protection**: Prevents processing stalls
- **Adaptive Quality**: Maintains real-time performance under load
- **Metrics Collection**: Comprehensive processing statistics

### WebRTC Stats Monitoring
- Real-time bandwidth utilization
- Connection quality metrics
- Video resolution and framerate tracking
- Packet loss and jitter analysis

## API Reference

### Detection Results Format
```javascript
{
  "frame_id": "string_or_int",
  "capture_ts": 1690000000000,
  "recv_ts": 1690000000100,
  "inference_ts": 1690000000120,
  "network_latency_ms": 100,
  "server_latency_ms": 20,
  "queue_wait_ms": 5,
  "detections": [
    {
      "label": "person",
      "score": 0.93,
      "xmin": 0.12,    // Normalized [0-1]
      "ymin": 0.08,
      "xmax": 0.34,
      "ymax": 0.67
    }
  ]
}
```

### REST Endpoints
- `GET /health` - System status and configuration
- `GET /api/metrics/realtime` - Live performance metrics
- `POST /api/benchmark/start` - Start benchmark run
- `GET /api/benchmark/results` - Get benchmark results
- `POST /api/benchmark/save` - Save results to file

## Troubleshooting

### Common Issues

**Phone won't connect**
```bash
# Check same network
ping YOUR_PHONE_IP

# Use ngrok for NAT traversal
./start.sh --ngrok
```

**High CPU usage**
```bash
# Switch to WASM mode
MODE=wasm ./start.sh

# Reduce processing rate
INPUT_SIZE=240 ./start.sh
```

**Detection overlay misaligned**
- Verify timestamp synchronization
- Check browser console for WebRTC errors
- Ensure stable network connection

**Poor detection quality**
- Ensure good lighting conditions
- Keep objects in frame center
- Check network bandwidth requirements

### Debug Mode
```bash
DEBUG=true ./start.sh
```

Enables:
- Detailed logging
- WebRTC connection diagnostics
- Frame processing metrics
- Performance profiling

### Performance Monitoring
```bash
# Check resource usage
docker stats

# Monitor network
ifstat -i wlan0

# WebRTC diagnostics
# Open chrome://webrtc-internals in browser
```

## Docker Configuration

### Production Deployment
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  webrtc-detection:
    build: .
    ports:
      - "80:3000"
    environment:
      - MODE=server
      - NODE_ENV=production
    volumes:
      - ./bench:/app/bench
    restart: unless-stopped
```

### Development Setup
```yaml
# docker-compose.dev.yml (default)
version: '3.8'
services:
  webrtc-detection:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MODE=wasm
      - NODE_ENV=development
    volumes:
      - .:/app
      - /app/node_modules
```

## Model Information

### WASM Mode: YOLOv5n
- **Size**: ~5MB quantized ONNX
- **Architecture**: YOLOv5 nano
- **Input**: 320×320×3
- **Classes**: 80 COCO classes
- **Performance**: ~18 FPS on modern devices

### Server Mode: YOLOv8n
- **Size**: ~6MB ONNX
- **Architecture**: YOLOv8 nano
- **Input**: 320×320×3
- **Classes**: 80 COCO classes
- **Performance**: ~7.5 FPS (with queue management)

## Contributing

### Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build production
npm run build
```

### Code Structure
```
├── client/           # Frontend (browser)
│   ├── app.js       # Main WebRTC client
│   ├── wasm-inference.js
│   └── WebRTCStatsMonitor.js
├── server/          # Backend (Node.js)
│   ├── index.js     # Main server
│   ├── inference.js # YOLOv8 inference
│   └── FrameProcessor.js
├── public/          # Static assets
├── bench/           # Benchmarking tools
└── models/          # ONNX model files
```

## License

MIT License - see LICENSE file for details.

## Technical Support

For issues, questions, or contributions:
1. Check the troubleshooting section above
2. Review existing GitHub issues
3. Create a detailed issue report with:
   - System specifications
   - Browser/device information
   - Steps to reproduce
   - Console error logs

---

**Next Improvement**: Implement adaptive bitrate control based on network conditions to optimize bandwidth usage while maintaining detection quality.
 