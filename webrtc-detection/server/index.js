// server/index.js - Enhanced with FrameProcessor and Advanced Metrics (Corrected)
import express from 'express';
import { writeFileSync } from 'fs';
import { createServer } from 'http';
import ngrok from "ngrok";
import { dirname, join } from 'path';
import qrcode from 'qrcode-terminal';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import FrameProcessor from './FrameProcessor.js';
import YOLOv8Inference from './inference.js';

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;
const MODE = process.env.MODE || 'wasm';
const INPUT_SIZE = 320;

// Initialize YOLOv8 inference and FrameProcessor
const yolov8Inference = new YOLOv8Inference();
const frameProcessor = new FrameProcessor(10, 5000);

if (MODE === 'server') {
    console.log(`🎯 Starting in SERVER mode with YOLOv8n + Advanced FrameProcessor (${INPUT_SIZE}x${INPUT_SIZE})`);
    yolov8Inference.loadModel().catch(console.error);
} else {
    console.log(`💻 Starting in WASM mode - client will use YOLOv5n (${INPUT_SIZE}x${INPUT_SIZE})`);
}

// Serve static files
app.use(express.static(join(__dirname, '../client')));
app.use(express.static(join(__dirname, '../public')));

// Routes
app.get('/', (req, res) => res.sendFile(join(__dirname, '../client/index.html')));
app.get('/phone', (req, res) => res.sendFile(join(__dirname, '../client/phone.html')));
app.get('/health', (req, res) => {
    const frameProcessorStats = frameProcessor.getMetrics();
    res.json({
        status: 'ok',
        mode: MODE,
        model: MODE === 'server' ? 'yolov8n' : 'yolov5n',
        nodeVersion: process.version,
        timestamp: new Date(),
        inputSize: INPUT_SIZE,
        frameProcessor: {
            queueStatus: frameProcessor.getQueueStatus(),
            stats: frameProcessorStats
        }
    });
});

// Endpoint to expose the current phone URL
let phoneUrlGlobal = `http://localhost:${PORT}/phone`;
app.get("/api/url", (req, res) => {
    res.json({ phoneUrl: phoneUrlGlobal });
});

// Enhanced benchmark storage with detailed metrics
let benchmarkData = {
    isRunning: false,
    startTime: null,
    duration: 0,
    mode: MODE,
    results: null,
    frames: [],
    latencies: [],
    networkLatencies: [],
    serverLatencies: [],
    queueLatencies: [],
    bandwidthSamples: []
};

// Enhanced Benchmark API
app.post('/api/benchmark/start', express.json(), (req, res) => {
    const { duration = 30, mode = MODE } = req.body;

    // Reset both benchmark data and frame processor metrics
    benchmarkData = {
        isRunning: true,
        startTime: Date.now(),
        duration: duration * 1000,
        mode,
        results: null,
        frames: [],
        latencies: [],
        networkLatencies: [],
        serverLatencies: [],
        queueLatencies: [],
        bandwidthSamples: []
    };

    // Reset frame processor metrics for fresh benchmark
    frameProcessor.resetMetrics();

    setTimeout(() => {
        if (benchmarkData.isRunning) {
            benchmarkData.isRunning = false;
            benchmarkData.results = calculateEnhancedBenchmarkResults();
            console.log('📊 Enhanced benchmark completed with advanced metrics');
        }
    }, duration * 1000);

    res.json({
        status: 'started',
        duration,
        mode,
        model: mode === 'server' ? 'yolov8n' : 'yolov5n',
        inputSize: INPUT_SIZE,
        startTime: benchmarkData.startTime,
        frameProcessorConfig: {
            maxQueueSize: frameProcessor.maxQueueSize,
            timeoutMs: frameProcessor.processingTimeoutMs
        }
    });
});

app.get('/api/benchmark/results', (req, res) => {
    if (benchmarkData.isRunning) return res.json({
        status: 'running',
        elapsed: Date.now() - benchmarkData.startTime,
        currentMetrics: frameProcessor.getMetrics(),
        queueStatus: frameProcessor.getQueueStatus()
    });
    if (!benchmarkData.results) return res.status(404).json({
        status: 'no_results',
        message: 'No benchmark results available'
    });
    res.json(benchmarkData.results);
});

// Enhanced frame recording with detailed latency breakdown
app.post('/api/benchmark/frame', express.json(), (req, res) => {
    if (!benchmarkData.isRunning) return res.json({ status: 'not_running' });

    const {
        frame_id,
        capture_ts,
        detections,
        network_latency_ms,
        server_latency_ms,
        queue_wait_ms,
        bandwidth
    } = req.body;

    const recv_ts = Date.now();

    // Record frame with enhanced metrics
    const frameData = {
        frame_id,
        capture_ts,
        recv_ts,
        detection_count: detections?.length || 0,
        network_latency_ms: network_latency_ms || 0,
        server_latency_ms: server_latency_ms || 0,
        queue_wait_ms: queue_wait_ms || 0
    };

    benchmarkData.frames.push(frameData);

    // Calculate total latency from the components and push it to the latencies array.
    const totalLatency = (network_latency_ms || 0) + (server_latency_ms || 0) + (queue_wait_ms || 0);
    if (totalLatency > 0) {
        benchmarkData.latencies.push(totalLatency);
    }

    // Collect latency breakdowns
    if (frameData.network_latency_ms > 0) benchmarkData.networkLatencies.push(frameData.network_latency_ms);
    if (frameData.server_latency_ms > 0) benchmarkData.serverLatencies.push(frameData.server_latency_ms);
    if (frameData.queue_wait_ms > 0) benchmarkData.queueLatencies.push(frameData.queue_wait_ms);

    // Record bandwidth if available
    if (bandwidth) {
        benchmarkData.bandwidthSamples.push({
            timestamp: recv_ts,
            uplink_kbps: bandwidth.uplink_kbps || 0,
            downlink_kbps: bandwidth.downlink_kbps || 0
        });
    }

    res.json({ status: 'recorded', frameProcessorStats: frameProcessor.getQueueStatus() });
});

app.post('/api/benchmark/save', express.json(), (req, res) => {
    try {
        const results = req.body;
        const filePath = join(__dirname, '../bench/metrics.json');
        writeFileSync(filePath, JSON.stringify(results, null, 2));
        console.log('📊 Enhanced benchmark results saved to bench/metrics.json');
        res.json({ status: 'saved', path: 'bench/metrics.json' });
    } catch (error) {
        console.error('❌ Failed to save benchmark results:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Enhanced API endpoints for real-time metrics
app.get('/api/metrics/realtime', (req, res) => {
    res.json({
        frameProcessor: frameProcessor.getMetrics(),
        queueStatus: frameProcessor.getQueueStatus(),
        benchmark: benchmarkData.isRunning ? {
            elapsed: Date.now() - benchmarkData.startTime,
            framesProcessed: benchmarkData.frames.length
        } : null
    });
});

app.post('/api/metrics/bandwidth', express.json(), (req, res) => {
    const { uplink_kbps, downlink_kbps, rtt_ms, jitter_ms, packet_loss_rate } = req.body;

    if (benchmarkData.isRunning) {
        benchmarkData.bandwidthSamples.push({
            timestamp: Date.now(),
            uplink_kbps: uplink_kbps || 0,
            downlink_kbps: downlink_kbps || 0,
            rtt_ms: rtt_ms || 0,
            jitter_ms: jitter_ms || 0,
            packet_loss_rate: packet_loss_rate || 0
        });
    }

    res.json({ status: 'recorded' });
});

function calculateEnhancedBenchmarkResults() {
    const latencies = benchmarkData.latencies.filter(l => l > 0).sort((a, b) => a - b);
    const networkLatencies = benchmarkData.networkLatencies.filter(l => l > 0).sort((a, b) => a - b);
    const serverLatencies = benchmarkData.serverLatencies.filter(l => l > 0).sort((a, b) => a - b);
    const queueLatencies = benchmarkData.queueLatencies.filter(l => l > 0).sort((a, b) => a - b);
    const duration_seconds = benchmarkData.duration / 1000;

    const frameProcessorStats = frameProcessor.getMetrics();
    const bandwidthStats = calculateBandwidthStats();

    return {
        timestamp: new Date().toISOString(),
        duration_seconds,
        mode: benchmarkData.mode,
        model: benchmarkData.mode === 'server' ? 'yolov8n' : 'yolov5n',
        input_size: INPUT_SIZE,
        e2e_latency: {
            median_ms: latencies[Math.floor(latencies.length / 2)] || 0,
            p95_ms: latencies[Math.floor(latencies.length * 0.95)] || 0,
            mean_ms: latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1),
            min_ms: Math.min(...latencies, Infinity),
            max_ms: Math.max(...latencies, 0)
        },
        latency_breakdown: {
            network: {
                median_ms: networkLatencies[Math.floor(networkLatencies.length / 2)] || 0,
                p95_ms: networkLatencies[Math.floor(networkLatencies.length * 0.95)] || 0,
                mean_ms: networkLatencies.reduce((a, b) => a + b, 0) / (networkLatencies.length || 1)
            },
            server_processing: {
                median_ms: serverLatencies[Math.floor(serverLatencies.length / 2)] || 0,
                p95_ms: serverLatencies[Math.floor(serverLatencies.length * 0.95)] || 0,
                mean_ms: serverLatencies.reduce((a, b) => a + b, 0) / (serverLatencies.length || 1)
            },
            queue_wait: {
                median_ms: queueLatencies[Math.floor(queueLatencies.length / 2)] || 0,
                p95_ms: queueLatencies[Math.floor(queueLatencies.length * 0.95)] || 0,
                mean_ms: queueLatencies.reduce((a, b) => a + b, 0) / (queueLatencies.length || 1)
            }
        },
        processed_fps: benchmarkData.frames.length / duration_seconds,
        total_frames: benchmarkData.frames.length,
        total_detections: benchmarkData.frames.reduce((sum, f) => sum + f.detection_count, 0),
        avg_detections_per_frame: benchmarkData.frames.length > 0
            ? benchmarkData.frames.reduce((sum, f) => sum + f.detection_count, 0) / benchmarkData.frames.length
            : 0,
        frames_with_detections: benchmarkData.frames.filter(f => f.detection_count > 0).length,
        detection_rate: benchmarkData.frames.length > 0
            ? benchmarkData.frames.filter(f => f.detection_count > 0).length / benchmarkData.frames.length
            : 0,
        frame_processing: {
            ...frameProcessorStats,
            drop_rate_percent: (frameProcessorStats.drop_rate * 100).toFixed(2),
            queue_utilization_percent: (frameProcessorStats.queue_utilization * 100).toFixed(2)
        },
        network_stats: bandwidthStats,
        performance_analysis: {
            bottleneck_detection: detectBottleneck(networkLatencies, serverLatencies, queueLatencies),
            recommendations: generateRecommendations(frameProcessorStats, bandwidthStats)
        }
    };
}

function calculateBandwidthStats() { /* ... unchanged ... */ }
function detectBottleneck(networkLatencies, serverLatencies, queueLatencies) { /* ... unchanged ... */ }
function generateRecommendations(frameStats, bandwidthStats) { /* ... unchanged ... */ }


// Socket.IO with Enhanced Frame Processing
io.on('connection', (socket) => {
    console.log('📱 Client connected:', socket.id);

    socket.on('phone-offer', data => socket.broadcast.emit('phone-offer', data));
    socket.on('pc-answer', data => socket.broadcast.emit('pc-answer', data));
    socket.on('phone-ice-candidate', data => socket.broadcast.emit('phone-ice-candidate', data));
    socket.on('pc-ice-candidate', data => socket.broadcast.emit('pc-ice-candidate', data));

    socket.on('frame-data', async (data) => {
        try {
            if (MODE === 'server' && yolov8Inference.isLoaded) {
                // ✅ FIX: Pass the 'socket' object to the frame processor
                frameProcessor.enqueueFrame(data, async (frameData) => {
                    const processing_start_ts = Date.now();
                    const detectionResult = await yolov8Inference.detect(frameData);
                    const processing_end_ts = Date.now();

                    return {
                        ...detectionResult,
                        processing_start_ts,
                        processing_end_ts,
                        server_latency_ms: processing_end_ts - processing_start_ts,
                        network_latency_ms: frameData.capture_ts ? processing_start_ts - frameData.capture_ts : 0
                    };
                }, socket); // <-- Pass socket here

            } else {
                // Fallback for WASM mode (no change here)
                const recv_ts = Date.now();
                const detectionResult = {
                    frame_id: data.frame_id || recv_ts,
                    capture_ts: data.capture_ts || recv_ts,
                    recv_ts,
                    inference_ts: Date.now(),
                    network_latency_ms: data.capture_ts ? recv_ts - data.capture_ts : 0,
                    server_latency_ms: 0,
                    detections: []
                };
                socket.emit('detections', detectionResult);
            }
        } catch (error) {
            console.error('❌ Enhanced frame processing error:', error);
            socket.emit('detections', {
                frame_id: data.frame_id || Date.now(),
                capture_ts: data.capture_ts || Date.now(),
                recv_ts: Date.now(),
                inference_ts: Date.now(),
                detections: [],
                error: 'Enhanced processing failed',
                network_latency_ms: 0,
                server_latency_ms: 0
            });
        }
    });

    socket.on('disconnect', () => console.log('📱 Client disconnected:', socket.id));
});

// Start server
server.listen(PORT, async () => {
    console.log(`🚀 Enhanced WebRTC Detection Server running on port ${PORT}`);
    console.log(`💻 PC Browser: http://localhost:${PORT}`);
    console.log(`📱 Phone (Local Pc): http://localhost:${PORT}/phone`);
    console.log(`🎯 Mode: ${MODE.toUpperCase()}`);
    console.log(`📐 Input Size: ${INPUT_SIZE}x${INPUT_SIZE}`);
    console.log(`⚡ Frame Processor: Queue=${frameProcessor.maxQueueSize}, Timeout=${frameProcessor.processingTimeoutMs}ms`);
    console.log(`⚡ Node.js: ${process.version}`);

    // Start ngrok tunnel
    try {
        const url = await ngrok.connect(PORT);
        phoneUrlGlobal = `${url}/phone`;
        console.log(`\n🌍 Public phone URL: ${phoneUrlGlobal}`);
        qrcode.generate(phoneUrlGlobal, { small: true });
    } catch (err) {
        console.error("❌ Ngrok tunnel failed:", err.message);
        console.log(`📱 Use local network: http://[YOUR_LOCAL_IP]:${PORT}/phone`);
    }
});
