// server.js (ES Modules)
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';
import qrcode from 'qrcode-terminal';
import YOLOInference from './inference.js'; // your YOLO inference class

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

// Initialize YOLO inference for server mode
const yoloInference = new YOLOInference();
if (MODE === 'server') {
    yoloInference.loadModel().catch(console.error);
}

// Serve static files
app.use(express.static(join(__dirname, '../client')));
app.use(express.static(join(__dirname, '../public')));

// Routes
app.get('/', (req, res) => res.sendFile(join(__dirname, '../client/index.html')));
app.get('/phone', (req, res) => res.sendFile(join(__dirname, '../client/phone.html')));
app.get('/health', (req, res) => {
    res.json({ status: 'ok', mode: MODE, nodeVersion: process.version, timestamp: new Date() });
});

// Benchmark storage
let benchmarkData = {
    isRunning: false,
    startTime: null,
    duration: 0,
    mode: MODE,
    results: null,
    frames: [],
    latencies: []
};

// Benchmark API
app.post('/api/benchmark/start', express.json(), (req, res) => {
    const { duration = 30, mode = MODE } = req.body;
    benchmarkData = { isRunning: true, startTime: Date.now(), duration: duration * 1000, mode, results: null, frames: [], latencies: [] };

    setTimeout(() => {
        if (benchmarkData.isRunning) {
            benchmarkData.isRunning = false;
            benchmarkData.results = calculateBenchmarkResults();
            console.log('📊 Benchmark completed automatically');
        }
    }, duration * 1000);

    res.json({ status: 'started', duration, mode, startTime: benchmarkData.startTime });
});

app.get('/api/benchmark/results', (req, res) => {
    if (benchmarkData.isRunning) return res.json({ status: 'running', elapsed: Date.now() - benchmarkData.startTime });
    if (!benchmarkData.results) return res.status(404).json({ status: 'no_results', message: 'No benchmark results available' });
    res.json(benchmarkData.results);
});

app.post('/api/benchmark/frame', express.json(), (req, res) => {
    if (!benchmarkData.isRunning) return res.json({ status: 'not_running' });

    const { frame_id, capture_ts, latency, detections } = req.body;
    benchmarkData.frames.push({ frame_id, capture_ts, recv_ts: Date.now(), latency: latency || 0, detection_count: detections?.length || 0 });
    if (latency > 0) benchmarkData.latencies.push(latency);

    res.json({ status: 'recorded' });
});

app.post('/api/benchmark/save', express.json(), (req, res) => {
    try {
        const results = req.body;
        const filePath = join(__dirname, '../bench/metrics.json');
        writeFileSync(filePath, JSON.stringify(results, null, 2));
        console.log('📊 Benchmark results saved to bench/metrics.json');
        res.json({ status: 'saved', path: 'bench/metrics.json' });
    } catch (error) {
        console.error('❌ Failed to save benchmark results:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

function calculateBenchmarkResults() {
    const latencies = benchmarkData.latencies.filter(l => l > 0).sort((a, b) => a - b);
    const duration_seconds = benchmarkData.duration / 1000;

    return {
        timestamp: new Date().toISOString(),
        duration_seconds,
        mode: benchmarkData.mode,
        e2e_latency: {
            median_ms: latencies[Math.floor(latencies.length / 2)] || 0,
            p95_ms: latencies[Math.floor(latencies.length * 0.95)] || 0,
            mean_ms: latencies.reduce((a, b) => a + b, 0) / latencies.length || 0,
            min_ms: Math.min(...latencies) || 0,
            max_ms: Math.max(...latencies) || 0
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
            : 0
    };
}

// Socket.IO signaling & frame handling
io.on('connection', (socket) => {
    console.log('📱 Client connected:', socket.id);

    socket.on('phone-offer', data => socket.broadcast.emit('phone-offer', data));
    socket.on('pc-answer', data => socket.broadcast.emit('pc-answer', data));
    socket.on('phone-ice-candidate', data => socket.broadcast.emit('phone-ice-candidate', data));
    socket.on('pc-ice-candidate', data => socket.broadcast.emit('pc-ice-candidate', data));

    socket.on('frame-data', async (data) => {
        const recv_ts = Date.now();
        try {
            let detectionResult;

            if (MODE === 'server' && yoloInference.isLoaded) {
                detectionResult = await yoloInference.detect(data);
            } else {
                detectionResult = {
                    frame_id: data.frame_id || recv_ts,
                    capture_ts: data.capture_ts || recv_ts,
                    recv_ts,
                    inference_ts: Date.now(),
                    detections: [{ label: "person", score: 0.85, xmin: 0.1, ymin: 0.1, xmax: 0.3, ymax: 0.6 }]
                };
            }

            if (benchmarkData.isRunning) {
                const latency = data.capture_ts ? recv_ts - data.capture_ts : 0;
                benchmarkData.frames.push({
                    frame_id: detectionResult.frame_id,
                    capture_ts: data.capture_ts,
                    recv_ts,
                    latency,
                    detection_count: detectionResult.detections.length
                });
                if (latency > 0) benchmarkData.latencies.push(latency);
            }

            socket.emit('detections', detectionResult);
        } catch (error) {
            console.error('❌ Frame processing error:', error);
            socket.emit('detections', { frame_id: data.frame_id || recv_ts, capture_ts: data.capture_ts || recv_ts, recv_ts, inference_ts: Date.now(), detections: [], error: 'Processing failed' });
        }
    });

    socket.on('disconnect', () => console.log('📱 Client disconnected:', socket.id));
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 WebRTC Detection Server running on port ${PORT}`);
    console.log(`💻 PC Browser: http://localhost:${PORT}`);
    console.log(`📱 Phone: http://localhost:${PORT}/phone`);
    console.log(`🎯 Mode: ${MODE}`);
    console.log(`⚡ Node.js: ${process.version}`);

    const phoneUrl = `http://localhost:${PORT}/phone`;
    console.log('\n📱 Scan this QR code with your phone:');
    qrcode.generate(phoneUrl, { small: true });
});
