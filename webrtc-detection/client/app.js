// WebRTC PC Client + Overlay Rendering with ES Modules
class WebRTCDetectionClient {
    constructor() {
        this.socket = io();
        this.peerConnection = null;
        this.remoteStream = null;
        this.canvas = document.getElementById('overlay');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('remoteVideo');
        this.isDebug = false;
        this.mode = 'wasm'; // Default to WASM mode for low-resource
        this.wasmInference = null;
        this.isStreamingActive = false;
        this.isPhoneConnected = false;
        
        this.metrics = {
            fps: 0,
            latency: 0,
            frameCount: 0,
            lastTime: Date.now(),
            totalObjects: 0
        };
        
        this.setupEventListeners();
    }
    
    async init() {
        console.log('🚀 Initializing WebRTC Detection Client (PC)');
        console.log('User Agent:', navigator.userAgent);
        
        // Initialize WASM inference
        this.wasmInference = new WASMInference();
        await this.wasmInference.loadModel();
        
        this.setupSocketListeners();
        this.setupWebRTC();
        this.generateQRCode();
        this.updateStatus('Ready for phone connection');
        this.updateConnectionIndicator(false);
        
        // Update mode display
        document.getElementById('mode').textContent = this.mode.toUpperCase();
    }
    
    setupEventListeners() {
        // Start/Stop Detection Button
        document.getElementById('startBtn').addEventListener('click', () => {
            this.toggleDetection();
        });
        
        document.getElementById('benchBtn').addEventListener('click', () => {
            this.runBenchmark();
        });
        
        document.getElementById('debugBtn').addEventListener('click', () => {
            this.toggleDebug();
        });
    }
    
    toggleDetection() {
        const btn = document.getElementById('startBtn');
        
        if (!this.isPhoneConnected) {
            this.updateStatus('Please connect your phone first');
            return;
        }
        
        if (this.isStreamingActive) {
            this.stopDetection();
            btn.textContent = '📹 Start Detection';
            btn.classList.remove('danger-btn');
            btn.classList.add('primary-btn');
        } else {
            if (this.remoteStream && this.video.videoWidth > 0) {
                this.startFrameCapture();
                btn.textContent = '⏹️ Stop Detection';
                btn.classList.remove('primary-btn');
                btn.classList.add('danger-btn');
            } else {
                this.updateStatus('No video stream available from phone');
            }
        }
    }
    
    startFrameCapture() {
        if (this.isStreamingActive) return;
        
        this.isStreamingActive = true;
        this.updateStatus('🔥 Detection active - processing frames');
        document.getElementById('detectionCount').textContent = 'Processing...';
        
        // Capture frames at 15 FPS for detection
        this.frameInterval = setInterval(() => {
            if (this.video.videoWidth > 0 && this.isStreamingActive) {
                this.captureAndSendFrame();
            }
        }, 1000 / 15); // 15 FPS
    }
     
    stopDetection() {
        this.isStreamingActive = false;
        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }
        
        // Clear overlay
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.updateStatus(this.isPhoneConnected ? '✅ Phone connected - ready to detect' : 'Phone disconnected');
        document.getElementById('detectionCount').textContent = this.isPhoneConnected ? '0 objects' : 'Waiting for stream...';
        document.getElementById('objectCount').textContent = '0';
    }
    
    async captureAndSendFrame() {
        if (!this.video.videoWidth || !this.isStreamingActive) return;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        
        ctx.drawImage(this.video, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        const frameId = Date.now();
        const captureTs = Date.now();
        
        const frameData = {
            frame_id: frameId,
            capture_ts: captureTs,
            image_data: imageData
        };
        
        if (this.mode === 'wasm' && this.wasmInference) {
            // Use WASM inference on client side
            try {
                const detectionResult = await this.wasmInference.detect(imageData, frameId, captureTs);
                this.drawDetections(detectionResult.detections);
                this.updateMetrics(detectionResult);
                
                // Send benchmark data to server if benchmark is running
                if (this.isBenchmarkRunning) {
                    fetch('/api/benchmark/frame', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            frame_id: frameId,
                            capture_ts: captureTs,
                            latency: Date.now() - captureTs,
                            detections: detectionResult.detections
                        })
                    }).catch(console.error);
                }
            } catch (error) {
                console.error('❌ WASM inference failed:', error);
                // Fall back to server processing
                this.socket.emit('frame-data', frameData);
            }
        } else {
            // Send to server for processing
            this.socket.emit('frame-data', frameData);
        }
    }
    
    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('📡 Connected to server');
            this.updateStatus('Connected to server - waiting for phone');
        });
        
        this.socket.on('disconnect', () => {
            console.log('📡 Disconnected from server');
            this.updateStatus('Disconnected from server');
            this.updateConnectionIndicator(false);
        });
        
        this.socket.on('detections', (data) => {
            if (this.isStreamingActive) {
                this.drawDetections(data.detections);
                this.updateMetrics(data);
            }
        });
        
        // WebRTC signaling from phone
        this.socket.on('phone-offer', async (offer) => {
            console.log('📡 Received offer from phone');
            await this.handlePhoneOffer(offer);
        });
        
        this.socket.on('phone-ice-candidate', async (candidate) => {
            console.log('🧊 Received ICE candidate from phone');
            try {
                await this.peerConnection.addIceCandidate(candidate);
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        });
    }
    
    setupWebRTC() {
        // WebRTC peer connection setup for receiving phone stream
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.peerConnection = new RTCPeerConnection(config);
        
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('📡 Sending ICE candidate to phone');
                this.socket.emit('pc-ice-candidate', event.candidate);
            }
        };
        
        this.peerConnection.ontrack = (event) => {
            console.log('📺 Received remote stream from phone');
            this.remoteStream = event.streams[0];
            this.video.srcObject = this.remoteStream;
            
            // Wait for video metadata to load
            this.video.onloadedmetadata = () => {
                console.log('📺 Video metadata loaded:', this.video.videoWidth, 'x', this.video.videoHeight);
                this.enableDetectionButton();
            };
        };
        
        this.peerConnection.onconnectionstatechange = () => {
            console.log('📡 PC Connection state:', this.peerConnection.connectionState);
            
            if (this.peerConnection.connectionState === 'connected') {
                this.isPhoneConnected = true;
                this.updateStatus('✅ Phone connected - ready to detect');
                this.updateConnectionIndicator(true);
                this.enableDetectionButton();
            } else if (this.peerConnection.connectionState === 'disconnected' || 
                      this.peerConnection.connectionState === 'failed') {
                this.isPhoneConnected = false;
                this.updateStatus('📱 Phone disconnected');
                this.updateConnectionIndicator(false);
                this.disableDetectionButton();
                this.stopDetection();
            }
        };
    }
    
    enableDetectionButton() {
        const btn = document.getElementById('startBtn');
        btn.disabled = false;
        btn.textContent = '📹 Start Detection';
        btn.classList.remove('danger-btn');
        btn.classList.add('primary-btn');
        document.getElementById('detectionCount').textContent = '0 objects';
    }
    
    disableDetectionButton() {
        const btn = document.getElementById('startBtn');
        btn.disabled = true;
        btn.textContent = '📱 Waiting for Phone...';
        btn.classList.remove('primary-btn', 'danger-btn');
        document.getElementById('detectionCount').textContent = 'Waiting for stream...';
    }
    
    updateConnectionIndicator(connected) {
        const indicator = document.getElementById('connectionIndicator');
        if (connected) {
            indicator.classList.add('connected');
        } else {
            indicator.classList.remove('connected');
        }
    }
    
    async handlePhoneOffer(offer) {
        try {
            await this.peerConnection.setRemoteDescription(offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.socket.emit('pc-answer', answer);
            this.updateStatus('🔗 Connecting to phone...');
            
        } catch (error) {
            console.error('Error handling phone offer:', error);
            this.updateStatus('❌ Failed to connect to phone');
        }
    }
    
    drawDetections(detections) {
        // Clear previous overlays
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!detections || detections.length === 0) {
            document.getElementById('detectionCount').textContent = '0 objects';
            document.getElementById('objectCount').textContent = '0';
            return;
        }
        
        // Update canvas size to match video
        if (this.video.videoWidth > 0) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
        }
        
        // Draw bounding boxes with enhanced styling
        this.ctx.strokeStyle = '#00ff41';
        this.ctx.lineWidth = 3;
        this.ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.fillStyle = '#00ff41';
        
        detections.forEach((det, index) => {
            const x = det.xmin * this.canvas.width;
            const y = det.ymin * this.canvas.height;
            const w = (det.xmax - det.xmin) * this.canvas.width;
            const h = (det.ymax - det.ymin) * this.canvas.height;
            
            // Draw box with rounded corners effect
            this.ctx.strokeRect(x, y, w, h);
            
            // Draw label with background
            const label = `${det.label} ${(det.score * 100).toFixed(0)}%`;
            const textMetrics = this.ctx.measureText(label);
            const textHeight = 20;
            
            // Label background
            this.ctx.fillStyle = 'rgba(0, 255, 65, 0.8)';
            this.ctx.fillRect(x, y - textHeight - 5, textMetrics.width + 10, textHeight + 5);
            
            // Label text
            this.ctx.fillStyle = '#000';
            this.ctx.fillText(label, x + 5, y - 8);
            
            // Reset fill style
            this.ctx.fillStyle = '#00ff41';
        });
        
        // Update detection count
        const objectText = `${detections.length} object${detections.length !== 1 ? 's' : ''}`;
        document.getElementById('detectionCount').textContent = objectText;
        document.getElementById('objectCount').textContent = detections.length;
    }
    
    updateMetrics(data) {
        const now = Date.now();
        this.metrics.frameCount++;
        this.metrics.totalObjects += data.detections?.length || 0;
        
        // Calculate FPS
        if (now - this.metrics.lastTime >= 1000) {
            this.metrics.fps = this.metrics.frameCount;
            this.metrics.frameCount = 0;
            this.metrics.lastTime = now;
        }
        
        // Calculate latency
        if (data.capture_ts) {
            this.metrics.latency = now - data.capture_ts;
        }
        
        // Update UI
        document.getElementById('fps').textContent = this.metrics.fps;
        document.getElementById('latency').textContent = this.metrics.latency + 'ms';
        
        if (this.isDebug) {
            console.log('📊 Metrics:', {
                fps: this.metrics.fps,
                latency: this.metrics.latency,
                totalObjects: this.metrics.totalObjects,
                frameId: data.frame_id
            });
        }
    }
    
    generateQRCode() {
        const phoneUrl = `${window.location.protocol}//${window.location.host}/phone`;
        document.getElementById('url').textContent = phoneUrl;
        
        // Enhanced QR code generation message
        document.getElementById('qr-container').innerHTML = `
            <h3>📱 Connect Your Phone:</h3>
            <div style="background: #f0f0f0; padding: 20px; margin: 10px 0; border-radius: 8px;">
                <p style="margin: 0; font-size: 1.2em; font-weight: bold; color: #333;">${phoneUrl}</p>
            </div>
            <p style="font-size: 0.9em; color: #666;">
                Open this URL on your phone browser to start streaming camera
            </p>
            <div style="margin-top: 15px; padding: 15px; background: #e8f5e8; border-radius: 8px;">
                <strong>Instructions:</strong>
                <ol style="text-align: left; margin: 10px 0;">
                    <li>Open the URL above on your phone</li>
                    <li>Allow camera access</li>
                    <li>Click "Connect to PC"</li>
                    <li>Click "Start Detection" here!</li>
                </ol>
            </div>
        `;
    }
    
    toggleDebug() {
        this.isDebug = !this.isDebug;
        document.getElementById('debugBtn').textContent = this.isDebug ? '🔧 Debug: ON' : '🔧 Toggle Debug';
        console.log('Debug mode:', this.isDebug ? 'enabled' : 'disabled');
    }
    
    async runBenchmark() {
        if (!this.isPhoneConnected) {
            alert('Please connect your phone first before running benchmark');
            return;
        }
        
        if (!this.isStreamingActive) {
            alert('Please start detection first before running benchmark');
            return;
        }
        
        try {
            this.updateStatus('Starting 30-second benchmark...');
            console.log('🔬 Starting benchmark...');
            
            // Start benchmark on server
            const response = await fetch('/api/benchmark/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ duration: 30, mode: this.mode })
            });
            
            if (!response.ok) {
                throw new Error('Failed to start benchmark');
            }
            
            const startData = await response.json();
            console.log('📊 Benchmark started:', startData);
            
            this.isBenchmarkRunning = true;
            this.updateStatus('Benchmark running... (30s)');
            
            // Show countdown
            let countdown = 30;
            const countdownInterval = setInterval(() => {
                countdown--;
                this.updateStatus(`Benchmark running... (${countdown}s)`);
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    this.finishBenchmark();
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ Benchmark failed:', error);
            this.updateStatus('Benchmark failed');
        }
    }
    
    async finishBenchmark() {
        try {
            this.isBenchmarkRunning = false;
            this.updateStatus('Fetching benchmark results...');
            
            // Wait a moment for server to finish processing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Fetch results from server
            const response = await fetch('/api/benchmark/results');
            
            if (!response.ok) {
                throw new Error('Failed to fetch benchmark results');
            }
            
            const results = await response.json();
            console.log('📈 Benchmark Results:', results);
            
            // Save to server's metrics.json file
            await this.saveBenchmarkToFile(results);
            
            this.updateStatus('Benchmark completed - results saved to bench/metrics.json');
            
            // Show results summary
            this.showBenchmarkSummary(results);
            
        } catch (error) {
            console.error('❌ Failed to fetch benchmark results:', error);
            this.updateStatus('Benchmark completed but failed to save results');
        }
    }
    
    async saveBenchmarkToFile(results) {
        try {
            // Send results to server to save to file
            const response = await fetch('/api/benchmark/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(results)
            });
            
            if (response.ok) {
                console.log('✅ Benchmark results saved to bench/metrics.json');
            } else {
                console.warn('⚠️ Failed to save benchmark results to file');
            }
        } catch (error) {
            console.error('❌ Error saving benchmark results:', error);
        }
    }
    
    showBenchmarkSummary(results) {
        const summary = `
📊 WebRTC Benchmark Summary:
• Duration: ${results.duration_seconds}s
• Mode: ${results.mode}
• Total Frames: ${results.total_frames}
• Processed FPS: ${results.processed_fps.toFixed(1)}
• Median Latency: ${results.e2e_latency.median_ms}ms
• P95 Latency: ${results.e2e_latency.p95_ms}ms
• Total Detections: ${results.total_detections}
• Detection Rate: ${(results.detection_rate * 100).toFixed(1)}%
        `;
        
        console.log(summary);
        alert('WebRTC Benchmark completed! Check console for detailed results or view bench/metrics.json file.');
    }
    
    updateStatus(message) {
        document.getElementById('status').textContent = message;
        console.log('🔄 PC Status:', message);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    const client = new WebRTCDetectionClient();
    client.init();
});