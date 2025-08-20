// ONNX Model Loading and Inference with ES Modules
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Jimp from 'jimp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class YOLOInference {
    constructor() {
        this.session = null;
        this.isLoaded = false;
        this.inputSize = 640; // YOLOv5 standard input size
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
    
    async loadModel(modelPath = 'models/yolov5n.onnx') {
        try {
            const fullPath = join(__dirname, modelPath);
            console.log('🧠 Loading YOLO model from:', fullPath);
            
            // Import ONNX Runtime Node
            const ort = await import('onnxruntime-node');
            
            // Create inference session
            this.session = await ort.InferenceSession.create(fullPath, {
                executionProviders: ['cpu'],
                graphOptimizationLevel: 'all'
            });
            
            this.isLoaded = true;
            console.log('✅ Server ONNX model loaded successfully');
            console.log('📊 Model input shape:', this.session.inputNames);
            return true;
            
        } catch (error) {
            console.error('❌ Failed to load ONNX model:', error);
            console.log('🔄 Falling back to mock detections...');
            this.isLoaded = false;
            return false;
        }
    }
    
    async detect(imageData) {
        const startTime = Date.now();
        
        if (!this.isLoaded) {
            // Return mock detection when model isn't loaded
            return this.getMockDetection(imageData, startTime);
        }
        
        try {
            // Preprocess image
            const tensor = await this.preprocessImage(imageData.image_data);
            
            // Run inference
            const results = await this.session.run({ images: tensor });
            
            // Get output tensor (YOLOv5 output is typically named 'output' or 'output0')
            const outputName = this.session.outputNames[0];
            const output = results[outputName];
            
            // Post-process results
            const detections = this.postprocessResults(output.data, output.dims);
            
            return {
                frame_id: imageData.frame_id || Date.now(),
                capture_ts: imageData.capture_ts || Date.now(),
                recv_ts: startTime,
                inference_ts: Date.now(),
                detections: detections
            };
            
        } catch (error) {
            console.error('❌ Server inference failed:', error);
            return this.getMockDetection(imageData, startTime);
        }
    }
    
    async preprocessImage(imageDataUrl) {
        try {
            // Remove data URL prefix
            const base64Data = imageDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Load image with Jimp
            const image = await Jimp.read(buffer);
            
            // Resize to model input size (640x640) and convert to RGB
            image.resize(this.inputSize, this.inputSize);
            
            // Convert to Float32Array and normalize [0-1]
            const imageData = new Float32Array(3 * this.inputSize * this.inputSize);
            
            let pixelIndex = 0;
            image.scan(0, 0, this.inputSize, this.inputSize, (x, y, idx) => {
                // Jimp uses RGBA format
                const r = image.bitmap.data[idx] / 255.0;
                const g = image.bitmap.data[idx + 1] / 255.0;
                const b = image.bitmap.data[idx + 2] / 255.0;
                
                // YOLOv5 expects CHW format (Channel, Height, Width)
                imageData[pixelIndex] = r; // R channel
                imageData[pixelIndex + this.inputSize * this.inputSize] = g; // G channel
                imageData[pixelIndex + 2 * this.inputSize * this.inputSize] = b; // B channel
                
                pixelIndex++;
            });
            
            // Import ONNX Runtime for tensor creation
            const ort = await import('onnxruntime-node');
            
            // Create tensor with shape [1, 3, 640, 640]
            const tensor = new ort.Tensor('float32', imageData, [1, 3, this.inputSize, this.inputSize]);
            
            return tensor;
            
        } catch (error) {
            console.error('❌ Image preprocessing failed:', error);
            throw error;
        }
    }
    
    postprocessResults(output, dims) {
        const detections = [];
        
        // YOLOv5 output format: [batch, detections, 85] where 85 = 4 (bbox) + 1 (conf) + 80 (classes)
        const [batch, numDetections, numFeatures] = dims;
        
        for (let i = 0; i < numDetections; i++) {
            const offset = i * numFeatures;
            
            // Extract box coordinates (center_x, center_y, width, height)
            const centerX = output[offset];
            const centerY = output[offset + 1];
            const width = output[offset + 2];
            const height = output[offset + 3];
            const confidence = output[offset + 4];
            
            // Skip low confidence detections
            if (confidence < 0.5) continue;
            
            // Find best class
            let bestClass = 0;
            let bestScore = 0;
            
            for (let j = 5; j < numFeatures; j++) {
                const classScore = output[offset + j];
                if (classScore > bestScore) {
                    bestScore = classScore;
                    bestClass = j - 5;
                }
            }
            
            // Final confidence is objectness * class confidence
            const finalScore = confidence * bestScore;
            
            // Skip low final scores
            if (finalScore < 0.5) continue;
            
            // Convert from center format to corner format and normalize [0-1]
            const xmin = Math.max(0, (centerX - width / 2) / this.inputSize);
            const ymin = Math.max(0, (centerY - height / 2) / this.inputSize);
            const xmax = Math.min(1, (centerX + width / 2) / this.inputSize);
            const ymax = Math.min(1, (centerY + height / 2) / this.inputSize);
            
            detections.push({
                label: this.classes[bestClass] || 'object',
                score: finalScore,
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
        // Sort by confidence score (descending)
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
    
    getMockDetection(imageData, startTime) {
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
            frame_id: imageData.frame_id || Date.now(),
            capture_ts: imageData.capture_ts || Date.now(),
            recv_ts: startTime,
            inference_ts: Date.now(),
            detections: detections
        };
    }
}

export default YOLOInference;
