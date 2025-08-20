# 🧪 WebRTC Flow Testing Guide

## ✅ **New WebRTC Flow Implementation Complete!**

Your codebase now implements the **proper WebRTC flow**:

### **📱 Phone Browser (`/phone`):**
- ✅ `getUserMedia()` → get local camera
- ✅ `WebRTC Peer` → stream video track to PC
- ✅ `Minimal UI` → just streaming controls

### **💻 PC Browser (`/`):**
- ✅ `WebRTC Peer` → receive video stream
- ✅ `Display live video` from phone
- ✅ `Capture frames` from received stream
- ✅ `Send frames for processing` (WASM/Server)
- ✅ `Overlay detections` on received video

---

## 🚀 **Testing Instructions:**

### **Step 1: Start Server**
```bash
cd webrtc-detection
node server/index.js
```

**Expected Output:**
```
🚀 WebRTC Detection Server running on port 3000
💻 PC Browser: http://localhost:3000
📱 Phone: http://localhost:3000/phone
🎯 Mode: wasm
⚡ Node.js: v20.x.x

📱 Scan this QR code with your phone:
[QR CODE for http://localhost:3000/phone]
```

### **Step 2: Open PC Interface**
1. **Open browser**: `http://localhost:3000`
2. **Check interface**: Should show "Ready for phone connection"
3. **Note the phone URL**: Copy `http://localhost:3000/phone`

### **Step 3: Connect Phone (Same Network)**
1. **Open phone browser**: Visit `http://[your-pc-ip]:3000/phone`
2. **Click "Start Camera"**: Allow camera access
3. **Click "Connect to PC"**: Establishes WebRTC connection
4. **Check PC browser**: Should show phone video stream

### **Step 4: Test with ngrok (Different Networks)**
```bash
# Install ngrok: https://ngrok.com/
ngrok http 3000

# Use the ngrok URL on phone:
# https://abc123.ngrok.io/phone
```

---

## 🔍 **Expected Behavior:**

### **Phone Side:**
```
📱 Phone Status: Ready to start
📱 Phone Status: Camera ready - click Connect to PC
📱 Phone Status: Connecting to PC...
📱 Phone Status: ✅ Connected to PC - streaming video!
```

### **PC Side:**
```
📡 Received offer from phone: [socket-id]
📺 Received phone video stream
✅ Connected to phone - processing video
📊 Metrics: { fps: 13, latency: 70ms, ... }
```

### **Server Console:**
```
📱 Client connected: [phone-socket-id]
📱 Client connected: [pc-socket-id]
📡 Relaying offer from phone to PC
📡 Relaying answer from PC to phone
🧊 Relaying phone ICE candidate to PC
🧊 Relaying PC ICE candidate to phone
```

---

## 🎯 **Key Differences from Before:**

### **❌ Old Flow (What you experienced):**
- Phone processed its own video
- Phone sent base64 images to server
- Phone displayed its own overlays
- PC was just a viewer

### **✅ New Flow (Proper WebRTC):**
- Phone only streams video (no processing)
- PC receives video stream via WebRTC
- PC processes frames and shows overlays
- Server only handles signaling + inference

---

## 🐛 **Troubleshooting:**

### **Issue: Phone can't connect to PC**
- **Same Network**: Use `http://[pc-ip]:3000/phone`
- **Different Networks**: Use ngrok URL
- **Check**: Firewall not blocking port 3000

### **Issue: WebRTC connection fails**
- **Check**: Both devices support WebRTC
- **Check**: STUN servers accessible
- **Try**: Refresh both browsers

### **Issue: No video on PC**
- **Check**: Phone camera permissions granted
- **Check**: WebRTC connection established
- **Check**: Browser console for errors

### **Issue: Detection not working**
- **Check**: Video stream received on PC
- **Check**: WASM model loading (browser console)
- **Check**: Frame capture working

---

## 📊 **Performance Expectations:**

- **WebRTC Latency**: ~50-100ms (much better than base64)
- **Processing FPS**: 10-15 FPS (WASM) / 15-25 FPS (Server)
- **E2E Latency**: ~100-200ms total
- **Bandwidth**: ~500KB/s - 2MB/s (video stream)

---

## 🎉 **Success Criteria:**

- [ ] Phone streams camera to PC via WebRTC
- [ ] PC displays live phone video
- [ ] PC processes frames and shows overlays
- [ ] Benchmark generates metrics.json
- [ ] Performance is smooth (>10 FPS)
- [ ] Latency is reasonable (<200ms)

**This is now a proper WebRTC object detection system!** 🚀