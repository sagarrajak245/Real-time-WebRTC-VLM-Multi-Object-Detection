# WebRTC Real-time Multi-Object Detection

Real-time object detection demo that streams video from phone via WebRTC, performs YOLO inference, and overlays bounding boxes in near real-time.

## Requirements

- **Node.js 20+** (recommended for best compatibility)
- Docker & Docker Compose (optional)
- Chrome/Safari browser on phone
- Same WiFi network (or ngrok for external access)

## Quick Start

### One-Command Start
```bash
# Clone and start (defaults to WASM mode)
git clone <your-repo>
cd webrtc-detection
./start.sh
```

### Mode Selection
```bash
# WASM mode (low-resource, runs on modest laptops)
MODE=wasm ./start.sh

# Server mode (requires more resources, better accuracy)  
MODE=server ./start.sh

# With ngrok for external phone access
./start.sh --ngrok
```

### Docker Alternative
```bash
docker-compose up --build
```

### Using Docker
```bash
docker-compose up --build
```

## Phone Connection

1. Start the server with `./start.sh`
2. Open `http://localhost:3000` in your browser
3. Scan the displayed QR code with your phone
4. Allow camera access on your phone
5. Watch live object detection overlays!

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-restart
npm run dev

# Run production mode
npm start
```

## Benchmarking

Run 30-second benchmark:
```bash
./bench/run_bench.sh --duration 30 --mode wasm
cat metrics.json
```

## Troubleshooting

- **Node.js version**: Ensure you're using Node.js 20+ for best compatibility
- **Phone won't connect**: Ensure same WiFi network or use `./start.sh --ngrok`
- **High CPU**: Switch to WASM mode or reduce resolution
- **Misaligned overlays**: Check browser console for timestamp errors
- **Connection issues**: Use Chrome DevTools > webrtc-internals
- **Module errors**: Make sure you're using Node.js 20+ with ES modules support

## Architecture

- **Frontend**: Vanilla JS + WebRTC
- **Backend**: Node.js 20 + Express 5 + Socket.IO 4.8
- **ML Model**: YOLOv5n (quantized)
- **Modes**: Server inference vs WASM browser inference

## Performance Targets

- **WASM Mode**: <200ms latency, 10-15 FPS, <50% CPU
- **Server Mode**: <100ms latency, 20-30 FPS, <70% CPU


Here’s a **complete cheat sheet** of all the different ways you can run your WebRTC detection project, covering **local Node.js**, **Docker**, **mode switching**, and **ngrok support**:

---

## **1️⃣ Local Node.js (without Docker)**

| Purpose                           | Command                          | Notes                                             |
| --------------------------------- | -------------------------------- | ------------------------------------------------- |
| WASM mode (default, low-resource) | `./start.sh`                     | Runs inference in the browser using WASM.         |
| WASM mode explicitly              | `MODE=wasm ./start.sh`           | Forces WASM mode even if default changes.         |
| Server mode (Node.js inference)   | `MODE=server ./start.sh`         | Uses server-side ONNX inference.                  |
| WASM mode + ngrok                 | `./start.sh --ngrok`             | Exposes localhost to phone for remote connection. |
| Server mode + ngrok               | `MODE=server ./start.sh --ngrok` | Server-side inference with remote access.         |

---

## **2️⃣ Docker / Docker Compose**

Your `docker-compose.yml` already sets:

```yaml
environment:
  - MODE=wasm
```

* ✅ Default: **WASM mode**.

| Purpose                    | Command                                                                          | Notes                               |
| -------------------------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| Default WASM mode          | `docker-compose up --build`                                                      | Uses `MODE=wasm` from compose file. |
| Server mode                | `docker-compose run -e MODE=server webrtc-detection`                             | Overrides default mode.             |
| Server mode with rebuild   | `docker-compose run -e MODE=server --build webrtc-detection`                     | Ensures latest code & dependencies. |
| Expose ngrok inside Docker | Modify `start.sh` inside container with `--ngrok` OR use local Node.js for ngrok | Easier to run ngrok outside Docker. |

---

## **3️⃣ Bench / Metrics collection**

| Purpose            | Command                                            | Notes                          |
| ------------------ | -------------------------------------------------- | ------------------------------ |
| WASM bench (30s)   | `./bench/run_bench.sh --duration 30 --mode wasm`   | Outputs `metrics.json`.        |
| Server bench (30s) | `./bench/run_bench.sh --duration 30 --mode server` | Server-side inference metrics. |

---

### **Summary Table**

| Run Environment | Mode   | ngrok | Command                                              |
| --------------- | ------ | ----- | ---------------------------------------------------- |
| Local Node      | WASM   | No    | `./start.sh`                                         |
| Local Node      | WASM   | Yes   | `./start.sh --ngrok`                                 |
| Local Node      | Server | No    | `MODE=server ./start.sh`                             |
| Local Node      | Server | Yes   | `MODE=server ./start.sh --ngrok`                     |
| Docker          | WASM   | No    | `docker-compose up --build`                          |
| Docker          | Server | No    | `docker-compose run -e MODE=server webrtc-detection` |

---

✅ **Key notes**

* `MODE` is the main switch between **low-resource WASM** and **server inference**.
* ngrok is optional for remote phone access.
* Docker defaults to WASM unless overridden.
* Bench scripts are independent of Docker; they read the `--mode` argument.


📱 Phone Browser          💻 Desktop Browser         🖥️ Server
     │                         │                      │
     │ ──── WebRTC Video ────► │                      │
     │                         │                      │
     │                         │ ── Socket.IO ──────► │
     │                         │   (frame-data)       │
     │                         │                      │
     │                         │                      ▼
     │                         │              server/inference.js
     │                         │                   (YOLO)
     │                         │                      │
     │                         │ ◄── Socket.IO ────── │
     │                         │   (detections)       │
     │                         │                      │
     │                         ▼                      │
     │                  client/app.js                 │
     │                 (overlay drawing)              │



Complete Data Flow Sequence
WASM Mode Data Flow:
1. 📱 Phone Browser:
   └── navigator.mediaDevices.getUserMedia()
       └── WebRTC stream to desktop

2. 💻 Desktop Browser (client/app.js):
   ├── captureAndSendFrame()
   │   ├── canvas.drawImage(video)
   │   └── canvas.toDataURL() → base64 image
   │
   └── this.wasmInference.detect(imageData)
       │
       ▼
3. 🧠 WASM Inference (client/wasm-inference.js):
   ├── preprocessImage() → 320x320 tensor
   ├── session.run() → ONNX inference
   ├── postprocessResults() → NMS + format
   └── return detections[]
       │
       ▼
4. 📊 Overlay (client/app.js):
   └── drawDetections() → canvas overlay



Server Mode Data Flow:
1. 📱 Phone Browser:
   └── navigator.mediaDevices.getUserMedia()
       └── WebRTC stream to desktop

2. 💻 Desktop Browser (client/app.js):
   ├── captureAndSendFrame()
   │   ├── canvas.drawImage(video)
   │   └── canvas.toDataURL() → base64 image
   │
   └── socket.emit('frame-data', frameData)
       │
       ▼
3. 🖥️ Server (server/index.js):
   ├── socket.on('frame-data')
   └── yoloInference.detect(data)
       │
       ▼
4. 🧠 Server Inference (server/inference.js):
   ├── preprocessImage() → 640x640 tensor
   ├── session.run() → ONNX inference
   ├── postprocessResults() → NMS + format
   └── return detections[]
       │
       ▼
5. 🖥️ Server (server/index.js):
   └── socket.emit('detections', result)
       │
       ▼
6. 💻 Desktop Browser (client/app.js):
   ├── socket.on('detections')
   └── drawDetections() → canvas overlay



📂 File Dependencies Map
start.sh
    │
    └── npm start
        │
        └── server/index.js (MAIN ENTRY)
            ├── imports: server/inference.js
            ├── serves: client/index.html
            ├── serves: client/app.js
            ├── serves: client/wasm-inference.js
            └── serves: public/models/yolov5n.onnx
                │
                ├── client/app.js
                │   ├── uses: Socket.IO connection
                │   ├── imports: client/wasm-inference.js
                │   └── renders: HTML canvas overlay
                │
                ├── client/wasm-inference.js
                │   ├── loads: public/models/yolov5n.onnx
                │   └── uses: ONNX Runtime Web (CDN)
                │
                └── server/inference.js
                    ├── loads: server/models/yolov5n.onnx
                    └── uses: onnxruntime-node


                    
🎯 Key Data Structures
Frame Data (Browser → Server):
{
    frame_id: 1692000000123,
    capture_ts: 1692000000000,
    image_data: "data:image/jpeg;base64,/9j/4AAQ..." // Base64
}
Detection Result (Server → Browser):
{
    frame_id: 1692000000123,
    capture_ts: 1692000000000,
    recv_ts: 1692000000100,
    inference_ts: 1692000000120,
    detections: [
        {
            label: "person",
            score: 0.93,
            xmin: 0.12, ymin: 0.08,
            xmax: 0.34, ymax: 0.67
        }
    ]
}