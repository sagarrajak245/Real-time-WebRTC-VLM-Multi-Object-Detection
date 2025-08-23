// client/app.js - Complete Enhanced WebRTC Detection Client with Advanced Metrics

class WebRTCDetectionClient {
    constructor() {
        this.socket = io();
        this.peerConnection = null;
        this.remoteStream = null;
        this.canvas = document.getElementById('overlay');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('remoteVideo');
        this.isDebug = false;
        this.mode = 'wasm';
        this.wasmInference = null;
        this.isStreamingActive = false;
        this.isPhoneConnected = false;

        // Enhanced metrics tracking
        this.metrics = {
            fps: 0,
            latency: 0,
            frameCount: 0,
            lastTime: Date.now(),
            totalObjects: 0,
            networkLatency: 0,
            serverLatency: 0,
            queueLatency: 0,
            framesDropped: 0
        };

        // WebRTC Stats Monitor integration
        this.webrtcStatsMonitor = null;
        this.isBenchmarkRunning = false;
        this.bandwidthMonitoringEnabled = false;

        // Latency tracking arrays for detailed analysis
        this.latencyHistory = {
            network: [],
            server: [],
            queue: [],
            total: []
        };

        // Frame processing tracking
        this.frameProcessingStats = {
            queueSize: 0,
            maxQueueSize: 10,
            dropRate: 0,
            processingFps: 0,
            utilization: 0
        };

        this.setupEventListeners();
    }

    async getServerConfig() {
        try {
            console.log('Fetching server config from /health...');
            const response = await fetch('/health');
            const config = await response.json();

            console.log('Server config received:', config);

            this.mode = config.mode || 'wasm';
            console.log(`Setting client mode to: ${this.mode.toUpperCase()}`);

            // Update UI with frame processor info
            if (config.frameProcessor) {
                this.updateFrameProcessorUI(config.frameProcessor);
            }

            this.updateModeDisplay();
            return config;
        } catch (error) {
            console.warn('Could not get server config, defaulting to WASM mode:', error);
            this.mode = 'wasm';
            this.updateModeDisplay();
            return null;
        }
    }

    updateModeDisplay() {
        const modeElement = document.getElementById('mode');
        if (modeElement) {
            const displayMode = this.mode.toUpperCase();
            modeElement.textContent = displayMode;
            console.log(`UI mode updated to: ${displayMode}`);

            if (this.isPhoneConnected) {
                this.updateStatus(`Phone connected - ready to detect (${displayMode} mode)`);
            } else {
                this.updateStatus(`Ready for phone connection (${displayMode} mode)`);
            }
        }
    }

    updateFrameProcessorUI(frameProcessorData) {
        // Update frame processor status in UI
        const queueStatusEl = document.getElementById('queueSize');
        const dropRateEl = document.getElementById('frameDropRate');
        const utilizationEl = document.getElementById('queueUtilization');
        const processingFpsEl = document.getElementById('processingFps');

        if (queueStatusEl && frameProcessorData.queueStatus) {
            queueStatusEl.textContent = `${frameProcessorData.queueStatus.size}/${frameProcessorData.queueStatus.maxSize}`;
        }

        if (dropRateEl && frameProcessorData.stats) {
            const dropPercent = (frameProcessorData.stats.drop_rate * 100).toFixed(1);
            dropRateEl.textContent = `${dropPercent}%`;
        }

        if (utilizationEl && frameProcessorData.stats) {
            const utilPercent = (frameProcessorData.stats.queue_utilization * 100).toFixed(1);
            utilizationEl.textContent = `${utilPercent}%`;
        }

        if (processingFpsEl && frameProcessorData.stats) {
            processingFpsEl.textContent = frameProcessorData.stats.processing_fps.toFixed(1);
        }
    }

    async init() {
        console.log('Initializing Enhanced WebRTC Detection Client');

        // Get server configuration first
        await this.getServerConfig();

        // Initialize WASM inference only if in WASM mode
        if (this.mode === 'wasm') {
            console.log('Initializing WASM inference...');
            this.wasmInference = new WASMInference();
            await this.wasmInference.loadModel();
        } else {
            console.log('Running in SERVER mode - inference will be done on server');
        }

        this.setupSocketListeners();
        this.setupWebRTC();
        this.generateQRCode();
        this.updateStatus(`Ready for phone connection (${this.mode.toUpperCase()} mode)`);
        this.updateConnectionIndicator(false);

        // Start real-time metrics polling
        this.startMetricsPolling();

        // Initialize WebRTC Stats Monitor
        this.initializeWebRTCStatsMonitor();

        // Setup benchmark status indicator
        this.setupBenchmarkStatusIndicator();
    }

    initializeWebRTCStatsMonitor() {
        // WebRTC Stats Monitor will be initialized when peer connection is established
        console.log('WebRTC Stats Monitor will be initialized after peer connection');
    }

    setupBenchmarkStatusIndicator() {
        const benchmarkStatus = document.getElementById('benchmarkStatus');
        if (benchmarkStatus) {
            benchmarkStatus.style.display = 'none';
        }
    }

    startMetricsPolling() {
        // Poll server metrics every 2 seconds for real-time updates
        setInterval(async () => {
            if (this.isStreamingActive) {
                try {
                    const response = await fetch('/api/metrics/realtime');
                    const metrics = await response.json();
                    this.updateRealtimeMetricsUI(metrics);
                } catch (error) {
                    // Silent fail - don't spam console
                }
            }
        }, 2000);

        // Update bandwidth metrics every second if monitoring is enabled
        setInterval(() => {
            if (this.bandwidthMonitoringEnabled && this.webrtcStatsMonitor) {
                this.updateBandwidthUI();
            }
        }, 1000);
    }

    updateRealtimeMetricsUI(serverMetrics) {
        // Update frame processor metrics in UI
        if (serverMetrics.frameProcessor) {
            const stats = serverMetrics.frameProcessor;

            // Update queue metrics
            document.getElementById('queueSize').textContent =
                `${serverMetrics.queueStatus.size}/${serverMetrics.queueStatus.maxSize}`;
            document.getElementById('queueUtilization').textContent =
                `${(stats.queue_utilization * 100).toFixed(1)}%`;
            document.getElementById('frameDropRate').textContent =
                `${(stats.drop_rate * 100).toFixed(1)}%`;
            document.getElementById('processingFps').textContent =
                stats.processing_fps.toFixed(1);

            // Update latency breakdown
            document.getElementById('avgNetworkLatency').textContent =
                `${stats.avg_network_latency_ms.toFixed(0)}ms`;
            document.getElementById('avgServerLatency').textContent =
                `${stats.avg_server_processing_ms.toFixed(0)}ms`;
            document.getElementById('avgQueueLatency').textContent =
                `${stats.avg_queue_wait_ms.toFixed(0)}ms`;

            // Update frame processing stats
            this.frameProcessingStats = {
                queueSize: serverMetrics.queueStatus.size,
                maxQueueSize: serverMetrics.queueStatus.maxSize,
                dropRate: stats.drop_rate,
                processingFps: stats.processing_fps,
                utilization: stats.queue_utilization
            };
        }
    }

    updateBandwidthUI() {
        if (!this.webrtcStatsMonitor) return;

        const bandwidthStats = this.webrtcStatsMonitor.getBandwidthStats();
        const connectionStats = this.webrtcStatsMonitor.getConnectionStats();

        // Update bandwidth display
        document.getElementById('uplinkBandwidth').textContent =
            `${bandwidthStats.uplink_kbps.toFixed(1)} kbps`;
        document.getElementById('downlinkBandwidth').textContent =
            `${bandwidthStats.downlink_kbps.toFixed(1)} kbps`;
        document.getElementById('totalBandwidth').textContent =
            `${bandwidthStats.total_kbps.toFixed(1)} kbps`;

        // Update connection quality
        document.getElementById('rtt').textContent =
            `${connectionStats.rtt_ms.toFixed(0)}ms`;
        document.getElementById('jitter').textContent =
            `${connectionStats.jitter_ms.toFixed(1)}ms`;
        document.getElementById('packetLoss').textContent =
            `${(connectionStats.packet_loss_rate * 100).toFixed(2)}%`;
        document.getElementById('videoResolution').textContent =
            connectionStats.video_resolution;
        document.getElementById('videoFps').textContent =
            connectionStats.fps.toFixed(1);
    }

    setupEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => {
            this.toggleDetection();
        });

        document.getElementById('benchBtn').addEventListener('click', () => {
            this.runBenchmark();
        });

        document.getElementById('debugBtn').addEventListener('click', () => {
            this.toggleDebug();
        });

        // Add bandwidth monitoring toggle
        document.getElementById('bandwidthBtn')?.addEventListener('click', () => {
            this.toggleBandwidthMonitoring();
        });

        // Add WebRTC stats monitoring toggle
        document.getElementById('webrtcStatsBtn')?.addEventListener('click', () => {
            this.toggleWebRTCStats();
        });
    }

    toggleBandwidthMonitoring() {
        this.bandwidthMonitoringEnabled = !this.bandwidthMonitoringEnabled;
        const btn = document.getElementById('bandwidthBtn');

        if (this.bandwidthMonitoringEnabled) {
            btn.textContent = '📊 Stop Bandwidth Monitor';
            btn.classList.add('danger-btn');
            btn.classList.remove('primary-btn');
            console.log('📊 Bandwidth monitoring enabled');
        } else {
            btn.textContent = '📊 Start Bandwidth Monitor';
            btn.classList.remove('danger-btn');
            btn.classList.add('primary-btn');
            console.log('📊 Bandwidth monitoring disabled');
        }
    }

    toggleWebRTCStats() {
        if (!this.webrtcStatsMonitor) {
            console.warn('WebRTC Stats Monitor not available - initializing peer connection first');
            alert('Please connect your phone first to enable WebRTC stats monitoring');
            return;
        }

        const btn = document.getElementById('webrtcStatsBtn');

        if (this.webrtcStatsMonitor.isMonitoring) {
            this.webrtcStatsMonitor.stopMonitoring();
            btn.textContent = '📈 Start WebRTC Stats';
            btn.classList.remove('danger-btn');
            btn.classList.add('primary-btn');
        } else {
            this.webrtcStatsMonitor.startMonitoring(1000);
            btn.textContent = '📈 Stop WebRTC Stats';
            btn.classList.add('danger-btn');
            btn.classList.remove('primary-btn');
        }
    }

    setupSocketListeners() {
        // WebRTC signaling
        this.socket.on('phone-offer', async (data) => {
            console.log('📱 Received offer from phone');
            await this.handleOffer(data);
        });

        this.socket.on('phone-ice-candidate', async (data) => {
            // Check for 'data' itself, and use it directly
            if (this.peerConnection && data) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
            }
        });
        // Enhanced detection results with detailed metrics
        this.socket.on('detections', (data) => {
            this.handleEnhancedDetections(data);
        });

        // Connection status
        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
        });
    }

    handleEnhancedDetections(data) {
        // Draw detections on overlay
        this.drawDetections(data.detections);

        // Update enhanced metrics with latency breakdown
        this.updateEnhancedMetrics(data);

        // Send benchmark data if benchmark is running
        if (this.isBenchmarkRunning) {
            this.sendBenchmarkData(data);
        }
    }

    updateEnhancedMetrics(detectionData) {
        const now = Date.now();
        const timeDelta = (now - this.metrics.lastTime) / 1000;

        // Update FPS
        this.metrics.frameCount++;
        if (timeDelta >= 1.0) {
            this.metrics.fps = this.metrics.frameCount / timeDelta;
            this.metrics.frameCount = 0;
            this.metrics.lastTime = now;
        }

        // Update latency metrics from detection data
        if (detectionData.network_latency_ms !== undefined) {
            this.metrics.networkLatency = detectionData.network_latency_ms;
            this.latencyHistory.network.push(detectionData.network_latency_ms);
        }

        if (detectionData.server_latency_ms !== undefined) {
            this.metrics.serverLatency = detectionData.server_latency_ms;
            this.latencyHistory.server.push(detectionData.server_latency_ms);
        }

        if (detectionData.queue_wait_ms !== undefined) {
            this.metrics.queueLatency = detectionData.queue_wait_ms;
            this.latencyHistory.queue.push(detectionData.queue_wait_ms);
        }

        // Calculate total latency
        const totalLatency = (detectionData.inference_ts || now) - (detectionData.capture_ts || now);
        this.metrics.latency = Math.abs(totalLatency);
        this.latencyHistory.total.push(this.metrics.latency);

        // Keep history limited
        const maxHistory = 100;
        Object.keys(this.latencyHistory).forEach(key => {
            if (this.latencyHistory[key].length > maxHistory) {
                this.latencyHistory[key] = this.latencyHistory[key].slice(-maxHistory);
            }
        });

        // Update object count
        this.metrics.totalObjects = detectionData.detections ? detectionData.detections.length : 0;

        // Update UI
        this.updateMetricsUI();
    }

    updateMetricsUI() {
        // Update main metrics display
        document.getElementById('fps').textContent = this.metrics.fps.toFixed(1);
        document.getElementById('latency').textContent = `${this.metrics.latency.toFixed(0)}ms`;
        document.getElementById('objectCount').textContent = this.metrics.totalObjects;
        document.getElementById('detectionCount').textContent =
            this.isStreamingActive ? `${this.metrics.totalObjects} objects` : 'Waiting for stream...';

        // Update latency breakdown if elements exist
        if (document.getElementById('currentNetworkLatency')) {
            document.getElementById('currentNetworkLatency').textContent =
                `${this.metrics.networkLatency.toFixed(0)}ms`;
        }
        if (document.getElementById('currentServerLatency')) {
            document.getElementById('currentServerLatency').textContent =
                `${this.metrics.serverLatency.toFixed(0)}ms`;
        }
        if (document.getElementById('currentQueueLatency')) {
            document.getElementById('currentQueueLatency').textContent =
                `${this.metrics.queueLatency.toFixed(0)}ms`;
        }
    }

    setupWebRTC() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.peerConnection = new RTCPeerConnection(configuration);

        // Initialize WebRTC Stats Monitor
        if (window.WebRTCStatsMonitor) {
            this.webrtcStatsMonitor = new window.WebRTCStatsMonitor(this.peerConnection);
            console.log('✅ WebRTC Stats Monitor initialized');

            // Enable WebRTC stats button now that monitor is available
            const webrtcStatsBtn = document.getElementById('webrtcStatsBtn');
            if (webrtcStatsBtn) {
                webrtcStatsBtn.disabled = false;
            }
        } else {
            console.warn('⚠️ WebRTCStatsMonitor not found - bandwidth monitoring disabled');
        }

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('pc-ice-candidate', { candidate: event.candidate });
            }
        };

        this.peerConnection.ontrack = (event) => {
            console.log('📹 Received remote stream');
            this.remoteStream = event.streams[0];
            this.video.srcObject = this.remoteStream;
            this.isPhoneConnected = true;
            this.updateConnectionIndicator(true);

            // Start WebRTC monitoring when stream is connected
            if (this.webrtcStatsMonitor && this.bandwidthMonitoringEnabled) {
                this.webrtcStatsMonitor.startMonitoring(1000);
            }

            this.updateStatus(`Phone connected - ready to detect (${this.mode.toUpperCase()} mode)`);

            const startBtn = document.getElementById('startBtn');
            startBtn.disabled = false;
            startBtn.textContent = '🔍 Start Detection';
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('📡 Connection state:', this.peerConnection.connectionState);

            if (this.peerConnection.connectionState === 'disconnected') {
                this.isPhoneConnected = false;
                this.updateConnectionIndicator(false);
                this.stopDetection();
                this.updateStatus('Phone disconnected');
            }
        };
    }

    async handleOffer(data) {
        try {
            // Use 'data' directly, not 'data.offer'
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.socket.emit('pc-answer', answer); // Also send the answer directly
        } catch (error) {
            console.error('❌ Error handling offer:', error);
        }
    }

    toggleDetection() {
        const btn = document.getElementById('startBtn');

        if (!this.isPhoneConnected) {
            this.updateStatus('Please connect your phone first');
            return;
        }

        if (this.isStreamingActive) {
            this.stopDetection();
            btn.textContent = '🔍 Start Detection';
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
        this.updateStatus(`Detection active - processing frames (${this.mode.toUpperCase()} mode)`);
        document.getElementById('detectionCount').textContent = 'Processing...';

        // Start WebRTC stats monitoring if available
        if (this.webrtcStatsMonitor && !this.webrtcStatsMonitor.isMonitoring) {
            this.webrtcStatsMonitor.startMonitoring(1000); // 1 second intervals
        }


        this.frameInterval = setInterval(() => {
            if (this.video.videoWidth > 0 && this.isStreamingActive) {
                this.captureAndSendFrame();
            }
        }, 1000 / 8);        //{sagar made this chnage}  i tried sending 15 frame but it was creating bottleneck so i chnaged to 8
    }

    stopDetection() {
        this.isStreamingActive = false;
        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }

        // Stop WebRTC monitoring
        if (this.webrtcStatsMonitor && this.webrtcStatsMonitor.isMonitoring) {
            this.webrtcStatsMonitor.stopMonitoring();
        }

        // Clear overlay
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.updateStatus(this.isPhoneConnected ?
            `Phone connected - ready to detect (${this.mode.toUpperCase()} mode)` :
            'Phone disconnected'
        );
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
            // Use WASM inference with enhanced metrics tracking
            try {
                console.log('Processing frame with WASM inference...');
                const detectionResult = await this.wasmInference.detect(imageData, frameId, captureTs);

                // Correctly calculate local processing time
                const localProcessingTime = Date.now() - captureTs;
                // Add enhanced timing metrics for WASM mode
                const processedResult = {
                    ...detectionResult,
                    network_latency_ms: 0, // No network for WASM
                    server_latency_ms: localProcessingTime,
                    queue_wait_ms: 0 // No queue for WASM
                };

                this.handleEnhancedDetections(processedResult);

                // Send benchmark data to server if benchmark is running
                if (this.isBenchmarkRunning) {
                    await this.sendBenchmarkData(processedResult);
                }
            } catch (error) {
                console.error('WASM inference failed:', error);
                console.log('Falling back to server processing...');
                this.socket.emit('frame-data', frameData);
            }
        } else {
            // Send to server for processing (SERVER mode)
            console.log('Sending frame to server for processing (SERVER mode)');
            this.socket.emit('frame-data', frameData);
        }
    }

    async sendBenchmarkData(detectionResult) {
        try {
            // Get WebRTC bandwidth stats if available
            const bandwidthStats = this.webrtcStatsMonitor ?
                this.webrtcStatsMonitor.getBandwidthStats() : null;

            await fetch('/api/benchmark/frame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    frame_id: detectionResult.frame_id,
                    capture_ts: detectionResult.capture_ts,
                    detections: detectionResult.detections,
                    network_latency_ms: detectionResult.network_latency_ms || 0,
                    server_latency_ms: detectionResult.server_latency_ms || 0,
                    queue_wait_ms: detectionResult.queue_wait_ms || 0,
                    bandwidth: bandwidthStats
                })
            });

            // Also send bandwidth data separately
            if (bandwidthStats && this.webrtcStatsMonitor) {
                const connectionStats = this.webrtcStatsMonitor.getConnectionStats();
                await fetch('/api/metrics/bandwidth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uplink_kbps: bandwidthStats.uplink_kbps,
                        downlink_kbps: bandwidthStats.downlink_kbps,
                        rtt_ms: connectionStats.rtt_ms,
                        jitter_ms: connectionStats.jitter_ms,
                        packet_loss_rate: connectionStats.packet_loss_rate
                    })
                });
            }
        } catch (error) {
            console.error('Failed to send benchmark data:', error);
        }
    }

    drawDetections(detections) {
        if (!detections || !this.canvas) return;

        // Clear previous detections
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Match canvas size to video
        if (this.video.videoWidth > 0) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
        }

        const scaleX = this.canvas.width;
        const scaleY = this.canvas.height;

        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = '#00ff00';

        detections.forEach(detection => {
            const x = detection.xmin * scaleX;
            const y = detection.ymin * scaleY;
            const width = (detection.xmax - detection.xmin) * scaleX;
            const height = (detection.ymax - detection.ymin) * scaleY;

            // Draw bounding box
            this.ctx.strokeRect(x, y, width, height);

            // Draw label
            const label = `${detection.label} (${(detection.score * 100).toFixed(1)}%)`;
            this.ctx.fillText(label, x, y - 5);
        });
    }

    async runBenchmark() {
        if (this.isBenchmarkRunning) {
            console.log('❌ Benchmark already running');
            return;
        }

        if (!this.isStreamingActive) {
            console.log('❌ Please start detection first');
            this.updateStatus('Please start detection before running benchmark');
            return;
        }

        const benchBtn = document.getElementById('benchBtn');
        const benchmarkStatus = document.getElementById('benchmarkStatus');

        benchBtn.disabled = true;
        benchBtn.textContent = '⏳ Running Benchmark...';
        benchmarkStatus.classList.add('active');

        try {
            // Start 30-second benchmark
            const response = await fetch('/api/benchmark/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ duration: 30, mode: this.mode })
            });

            if (!response.ok) throw new Error('Failed to start benchmark');

            this.isBenchmarkRunning = true;
            console.log('📊 Benchmark started - 30 seconds');

            // Enable bandwidth monitoring during benchmark if not already enabled
            if (this.webrtcStatsMonitor && !this.bandwidthMonitoringEnabled) {
                this.toggleBandwidthMonitoring();
            }

            // Update benchmark status every 5 seconds
            let timeRemaining = 30;
            const statusInterval = setInterval(() => {
                timeRemaining -= 5;
                if (timeRemaining > 0) {
                    benchBtn.textContent = `⏳ Benchmark: ${timeRemaining}s left`;
                }
            }, 5000);

            // Wait for benchmark completion
            setTimeout(async () => {
                clearInterval(statusInterval);
                this.isBenchmarkRunning = false;
                benchmarkStatus.classList.remove('active');
                await this.completeBenchmark();

                benchBtn.disabled = false;
                benchBtn.textContent = '📊 Run 30s Benchmark';
            }, 30000);

        } catch (error) {
            console.error('❌ Benchmark failed:', error);
            this.isBenchmarkRunning = false;
            benchBtn.disabled = false;
            benchBtn.textContent = '📊 Run 30s Benchmark';
            benchmarkStatus.classList.remove('active');
            this.updateStatus('Benchmark failed: ' + error.message);
        }
    }

    async completeBenchmark() {
        try {
            // Get final results
            const response = await fetch('/api/benchmark/results');
            const results = await response.json();

            console.log('📊 Benchmark Results:', results);

            // Save results
            await fetch('/api/benchmark/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(results)
            });

            // Display results summary
            const resultMessage = `
Benchmark Complete! 🎉

Mode: ${results.mode?.toUpperCase()}
Processed FPS: ${results.processed_fps?.toFixed(1)}
Median Latency: ${results.e2e_latency?.median_ms?.toFixed(0)}ms
P95 Latency: ${results.e2e_latency?.p95_ms?.toFixed(0)}ms
Total Frames: ${results.total_frames}
Drop Rate: ${(results.drop_rate * 100)?.toFixed(1)}%

Results saved to bench/metrics.json`;

            alert(resultMessage);

            this.updateStatus('Benchmark completed - results saved');

        } catch (error) {
            console.error('❌ Failed to complete benchmark:', error);
            this.updateStatus('Failed to complete benchmark: ' + error.message);
        }
    }

    toggleDebug() {
        this.isDebug = !this.isDebug;
        const btn = document.getElementById('debugBtn');
        const debugPanel = document.getElementById('debugPanel');

        if (this.isDebug) {
            btn.textContent = '🔧 Debug: ON';
            btn.classList.add('danger-btn');
            debugPanel.classList.add('active');
            console.log('🔍 Debug mode enabled');

            // Enable WebRTC debug logging
            if (this.webrtcStatsMonitor) {
                this.webrtcStatsMonitor.enableDebugLogging();
            }

            // Start debug info updates
            this.startDebugUpdates();
        } else {
            btn.textContent = '🔧 Debug: OFF';
            btn.classList.remove('danger-btn');
            debugPanel.classList.remove('active');
            console.log('🔍 Debug mode disabled');

            // Disable WebRTC debug logging
            if (this.webrtcStatsMonitor) {
                this.webrtcStatsMonitor.disableDebugLogging();
            }

            // Stop debug updates
            this.stopDebugUpdates();
        }
    }

    startDebugUpdates() {
        this.debugInterval = setInterval(() => {
            if (this.isDebug) {
                this.updateDebugInfo();
            }
        }, 1000);
    }

    stopDebugUpdates() {
        if (this.debugInterval) {
            clearInterval(this.debugInterval);
            this.debugInterval = null;
        }
    }

    updateDebugInfo() {
        const debugContent = document.getElementById('debugContent');
        if (!debugContent) return;

        const debugInfo = {
            timestamp: new Date().toLocaleTimeString(),
            connection_state: this.peerConnection?.connectionState || 'not-initialized',
            ice_connection: this.peerConnection?.iceConnectionState || 'not-initialized',
            signaling_state: this.peerConnection?.signalingState || 'not-initialized',
            is_streaming: this.isStreamingActive,
            is_phone_connected: this.isPhoneConnected,
            video_dimensions: `${this.video.videoWidth}x${this.video.videoHeight}`,
            mode: this.mode.toUpperCase(),
            frame_processing: this.frameProcessingStats,
            bandwidth_monitoring: this.bandwidthMonitoringEnabled,
            benchmark_running: this.isBenchmarkRunning
        };

        // Add WebRTC stats if available
        if (this.webrtcStatsMonitor && this.webrtcStatsMonitor.isMonitoring) {
            debugInfo.webrtc_bandwidth = this.webrtcStatsMonitor.getBandwidthStats();
            debugInfo.webrtc_connection = this.webrtcStatsMonitor.getConnectionStats();
        }

        debugContent.innerHTML = `<pre>${JSON.stringify(debugInfo, null, 2)}</pre>`;
    }

    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
            console.log('📋 Status:', message);
        }
    }

    updateConnectionIndicator(connected) {
        const indicator = document.getElementById('connectionIndicator');
        if (indicator) {
            if (connected) {
                indicator.classList.add('connected');
            } else {
                indicator.classList.remove('connected');
            }
        }
    }

    generateQRCode() {
        // QR code generation would be handled by the server
        // This is just a placeholder for the URL display
        console.log('📱 QR Code generated for phone connection');
    }
}

// Initialize the client when page loads
window.client = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing WebRTC Detection Client...');
    window.client = new WebRTCDetectionClient();
    await window.client.init();
    console.log('✅ WebRTC Detection Client ready');
});

// Export for debugging
window.WebRTCDetectionClient = WebRTCDetectionClient; 