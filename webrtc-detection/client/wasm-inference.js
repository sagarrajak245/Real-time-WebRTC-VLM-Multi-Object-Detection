// WASM-based Object Detection using ONNX Runtime Web
class WASMInference {
    constructor() {
        this.session = null;
        this.isLoaded = false;
        this.modelUrl = '/models/yolov5n.onnx';
        this.inputSize = 320; // Low-resource mode: 320x320
        this.isDebug = false; // Enable for debugging
        this.classes = [
            'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
            'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
            'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
            'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
            'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
            'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
            'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
            'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
            'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
            'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
        ];
    }

    async loadModel() {
        try {
            console.log('🧠 Loading ONNX model for WASM inference...');

            // Import ONNX Runtime Web
            if (typeof ort === 'undefined') {
                console.log('📦 Loading ONNX Runtime Web...');
                await this.loadONNXRuntime();
            }

            // Configure ONNX Runtime for WASM
            ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/';
            ort.env.wasm.numThreads = 1; // Low-resource mode

            // Load the model
            this.session = await ort.InferenceSession.create(this.modelUrl, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all'
            });

            this.isLoaded = true;
            console.log('✅ WASM model loaded successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to load WASM model:', error);
            console.log('🔄 Falling back to mock detections...');
            this.isLoaded = false;
            return false;
        }
    }

    async loadONNXRuntime() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/ort.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async detect(imageData, frameId, captureTs) {
        const startTime = Date.now();

        if (!this.isLoaded) {
            // Return mock detection for demo purposes
            return this.getMockDetection(frameId, captureTs, startTime);
        }

        try {
            // Preprocess image
            const tensor = await this.preprocessImage(imageData);

            // Run inference
            const results = await this.session.run({ images: tensor });

            // Get the first output (YOLOv5 typically has one output)
            const outputName = Object.keys(results)[0];
            const output = results[outputName];

            // Debug: Log output info
            if (this.isDebug) {
                console.log('🔍 ONNX Output:', outputName, output.dims);
            }

            // Post-process results
            const detections = this.postprocessResults(output.data, output.dims);

            return {
                frame_id: frameId,
                capture_ts: captureTs,
                recv_ts: startTime,
                inference_ts: Date.now(),
                detections: detections
            };

        } catch (error) {
            console.error('❌ WASM inference failed:', error);

            // Debug: Show available outputs
            if (error.message.includes('output0')) {
                console.log('🔍 Available outputs:', Object.keys(results || {}));
            }

            return this.getMockDetection(frameId, captureTs, startTime);
        }
    }

    async preprocessImage(imageData) {
        // Create canvas for image processing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size to model input size (320x320 for low-resource)
        canvas.width = this.inputSize;
        canvas.height = this.inputSize;

        // Draw and resize image
        const img = new Image();
        img.src = imageData;

        return new Promise((resolve) => {
            img.onload = () => {
                // Draw image to canvas with resize
                ctx.drawImage(img, 0, 0, this.inputSize, this.inputSize);

                // Get image data
                const imageData = ctx.getImageData(0, 0, this.inputSize, this.inputSize);
                const data = imageData.data;

                // Convert to RGB and normalize [0-1]
                const input = new Float32Array(3 * this.inputSize * this.inputSize);

                for (let i = 0; i < this.inputSize * this.inputSize; i++) {
                    input[i] = data[i * 4] / 255.0;     // R
                    input[i + this.inputSize * this.inputSize] = data[i * 4 + 1] / 255.0; // G
                    input[i + 2 * this.inputSize * this.inputSize] = data[i * 4 + 2] / 255.0; // B
                }

                // Create tensor
                const tensor = new ort.Tensor('float32', input, [1, 3, this.inputSize, this.inputSize]);
                resolve(tensor);
            };
        });
    }

    postprocessResults(output, dims) {
        const detections = [];
        const [batchSize, numDetections, numClasses] = dims;

        // YOLOv5 output format: [x, y, w, h, confidence, class_scores...]
        for (let i = 0; i < numDetections; i++) {
            const offset = i * numClasses;

            // Extract box coordinates and confidence
            const x = output[offset];
            const y = output[offset + 1];
            const w = output[offset + 2];
            const h = output[offset + 3];
            const confidence = output[offset + 4];

            // Skip low confidence detections
            if (confidence < 0.5) continue;

            // Find best class
            let bestClass = 0;
            let bestScore = 0;

            for (let j = 5; j < numClasses; j++) {
                const score = output[offset + j];
                if (score > bestScore) {
                    bestScore = score;
                    bestClass = j - 5;
                }
            }

            // Convert to normalized coordinates [0-1]
            const xmin = Math.max(0, (x - w / 2) / this.inputSize);
            const ymin = Math.max(0, (y - h / 2) / this.inputSize);
            const xmax = Math.min(1, (x + w / 2) / this.inputSize);
            const ymax = Math.min(1, (y + h / 2) / this.inputSize);

            detections.push({
                label: this.classes[bestClass] || 'object',
                score: confidence * bestScore,
                xmin: xmin,
                ymin: ymin,
                xmax: xmax,
                ymax: ymax
            });
        }

        // Apply Non-Maximum Suppression
        return this.applyNMS(detections, 0.4);
    }

    applyNMS(detections, iouThreshold) {
        // Sort by confidence
        detections.sort((a, b) => b.score - a.score);

        const keep = [];

        for (let i = 0; i < detections.length; i++) {
            const current = detections[i];
            let shouldKeep = true;

            for (const kept of keep) {
                const iou = this.calculateIoU(current, kept);
                if (iou > iouThreshold) {
                    shouldKeep = false;
                    break;
                }
            }

            if (shouldKeep) {
                keep.push(current);
            }
        }

        return keep;
    }

    calculateIoU(box1, box2) {
        const x1 = Math.max(box1.xmin, box2.xmin);
        const y1 = Math.max(box1.ymin, box2.ymin);
        const x2 = Math.min(box1.xmax, box2.xmax);
        const y2 = Math.min(box1.ymax, box2.ymax);

        if (x2 <= x1 || y2 <= y1) return 0;

        const intersection = (x2 - x1) * (y2 - y1);
        const area1 = (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin);
        const area2 = (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin);
        const union = area1 + area2 - intersection;

        return intersection / union;
    }

    getMockDetection(frameId, captureTs, startTime) {
        // Mock detection for demo when model isn't loaded
        const mockObjects = [
            { label: 'person', score: 0.85, xmin: 0.1, ymin: 0.1, xmax: 0.3, ymax: 0.6 },
            { label: 'chair', score: 0.72, xmin: 0.5, ymin: 0.4, xmax: 0.8, ymax: 0.9 },
            { label: 'bottle', score: 0.68, xmin: 0.7, ymin: 0.1, xmax: 0.85, ymax: 0.4 }
        ];

        // Randomly show 0-2 objects for realistic demo
        const numObjects = Math.floor(Math.random() * 3);
        const detections = mockObjects.slice(0, numObjects);

        return {
            frame_id: frameId,
            capture_ts: captureTs,
            recv_ts: startTime,
            inference_ts: Date.now(),
            detections: detections
        };
    }
}

// Export for use in main app
window.WASMInference = WASMInference;