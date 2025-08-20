# 🧪 WebRTC Detection Testing Checklist

## Phase 1: Basic Server Setup & Connection ✅

### Test 1.1: Server Startup
- [ ] Run: `node server/index.js`
- [ ] Check: Server starts on port 3000
- [ ] Check: QR code displays in terminal
- [ ] Check: No error messages
- [ ] Expected output:
  ```
  🚀 WebRTC Detection Server running on port 3000
  📱 Open http://localhost:3000 to connect your phone
  🎯 Mode: wasm
  ⚡ Node.js: v20.x.x
  ```

### Test 1.2: Web Interface Access
- [ ] Open browser: `http://localhost:3000`
- [ ] Check: Web page loads successfully
- [ ] Check: UI shows "WebRTC Real-time Object Detection"
- [ ] Check: Status shows "Ready for phone connection"
- [ ] Check: Video element is present
- [ ] Check: Control buttons are visible

### Test 1.3: Health Check API
- [ ] Test: `http://localhost:3000/health`
- [ ] Expected response:
  ```json
  {
    "status": "ok",
    "mode": "wasm",
    "nodeVersion": "v20.x.x",
    "timestamp": "2025-08-20T..."
  }
  ```

---

## Phase 2: Mobile Camera Streaming 📱

### Test 2.1: Phone Connection
- [ ] Phone on same WiFi network
- [ ] Scan QR code OR visit URL manually
- [ ] Check: Phone browser opens the page
- [ ] Check: Same UI loads on phone

### Test 2.2: Camera Permission
- [ ] Click "📹 Start Detection" on phone
- [ ] Check: Browser asks for camera permission
- [ ] Grant camera permission
- [ ] Check: Camera preview appears on phone
- [ ] Check: No error messages in console

### Test 2.3: WebRTC Connection
- [ ] Check desktop browser console for:
  ```
  📱 Client connected: [socket-id]
  📡 Received offer from [socket-id]
  📡 Received answer from [socket-id]
  🧊 Received ICE candidate from [socket-id]
  ```
- [ ] Check: Video stream appears on desktop
- [ ] Check: Phone camera feed visible on desktop

---

## Phase 3: AI Inference Testing 🧠

### Test 3.1: WASM Mode (Default)
- [ ] Server running with MODE=wasm
- [ ] Check: WASM model loads in browser
- [ ] Check: Frame processing happens locally
- [ ] Check: Bounding boxes appear on video
- [ ] Check: FPS counter updates
- [ ] Check: Latency shows reasonable values (<200ms)

### Test 3.2: Server Mode
- [ ] Restart server: `MODE=server node server/index.js`
- [ ] Check: Server loads ONNX model
- [ ] Check: Frame data sent to server
- [ ] Check: Detections returned from server
- [ ] Check: Better performance (<100ms latency)

### Test 3.3: Detection Accuracy
- [ ] Point camera at person
- [ ] Check: "person" label appears
- [ ] Point camera at objects (chair, bottle, etc.)
- [ ] Check: Correct labels appear
- [ ] Check: Confidence scores are reasonable (>50%)

---

## Phase 4: Performance Benchmarking 📊

### Test 4.1: Manual Benchmark
- [ ] Click "📊 Run Benchmark" button
- [ ] Check: 30-second countdown starts
- [ ] Check: Metrics update during benchmark
- [ ] Check: Results appear after completion

### Test 4.2: API Benchmark
- [ ] Test: POST `/api/benchmark/start`
- [ ] Test: GET `/api/benchmark/results`
- [ ] Check: `bench/metrics.json` file created
- [ ] Verify metrics format:
  ```json
  {
    "timestamp": "...",
    "duration_seconds": 30,
    "e2e_latency": {
      "median_ms": 150,
      "p95_ms": 200
    },
    "processed_fps": 12.5,
    "total_frames": 375
  }
  ```

---

## 🐛 Common Issues & Solutions

### Issue: Server won't start
- **Check**: Node.js version (need 20+)
- **Check**: Port 3000 not in use
- **Solution**: `netstat -ano | findstr :3000`

### Issue: Phone can't connect
- **Check**: Same WiFi network
- **Check**: Firewall not blocking port 3000
- **Solution**: Try `http://[your-ip]:3000`

### Issue: Camera permission denied
- **Check**: Using HTTPS or localhost
- **Check**: Browser supports WebRTC
- **Solution**: Use Chrome/Safari, enable camera

### Issue: No video stream
- **Check**: WebRTC connection established
- **Check**: Browser console for errors
- **Solution**: Check STUN server connectivity

### Issue: AI inference fails
- **Check**: Model files exist in correct locations
- **Check**: ONNX Runtime loaded successfully
- **Solution**: Check browser/server console logs

---

## 📝 Test Results Log

### Test Run: [Date/Time]
- **Phase 1**: ✅ / ❌
- **Phase 2**: ✅ / ❌  
- **Phase 3**: ✅ / ❌
- **Phase 4**: ✅ / ❌

### Notes:
- 
- 
- 

### Bugs Found:
1. 
2. 
3. 

### Performance Results:
- **WASM Mode**: ___ FPS, ___ ms latency
- **Server Mode**: ___ FPS, ___ ms latency