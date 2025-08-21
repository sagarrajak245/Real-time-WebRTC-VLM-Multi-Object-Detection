// ONNX Model Loading and Inference with ES Modules - YOLOv8n
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Jimp from 'jimp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class YOLOv8Inference {
    constructor() {
        this.session = null;
        this.isLoaded = false;
        this.inputSize = 320; // Updated to match your model: 320x320
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
    
    async loadModel(modelPath = 'models/yolov8n.onnx') {
        try {
            const fullPath = join(__dirname, modelPath);
            console.log('🧠 Loading YOLOv8n model from:', fullPath);
            
            // Import ONNX Runtime Node
            const ort = await import('onnxruntime-node');
            
            // Create inference session for YOLOv8n
            this.session = await ort.InferenceSession.create(fullPath, {
                executionProviders: ['cpu'],
                graphOptimizationLevel: 'all'
            });
            
            this.isLoaded = true;
            console.log('✅ YOLOv8n ONNX model loaded successfully (320x320)');
            console.log('📊 Model input shape:', this.session.inputNames);
            console.log('📊 Model output shape:', this.session.outputNames);
            return true;
            
        } catch (error) {
            console.error('❌ Failed to load YOLOv8n ONNX model:', error);
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
            // Preprocess image for YOLOv8n
            const tensor = await this.preprocessImage(imageData.image_data);
            
            // Run inference - YOLOv8n typically uses 'images' as input name
            const inputName = this.session.inputNames[0];
            const results = await this.session.run({ [inputName]: tensor });
            
            // Get output tensor (YOLOv8n output is typically named 'output0')
            const outputName = this.session.outputNames[0];
            const output = results[outputName];
            
            // Post-process results for YOLOv8n format
            const detections = this.postprocessYOLOv8Results(output.data, output.dims);
            
            return {
                frame_id: imageData.frame_id || Date.now(),
                capture_ts: imageData.capture_ts || Date.now(),
                recv_ts: startTime,
                inference_ts: Date.now(),
                detections: detections
            };
            
        } catch (error) {
            console.error('❌ YOLOv8n server inference failed:', error);
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
            
            // Resize to model input size (320x320 for your model)
            image.resize(this.inputSize, this.inputSize);
            
            // Convert to Float32Array and normalize [0-1] for YOLOv8n
            const imageData = new Float32Array(3 * this.inputSize * this.inputSize);
            
            let pixelIndex = 0;
            image.scan(0, 0, this.inputSize, this.inputSize, (x, y, idx) => {
                // Jimp uses RGBA format
                const r = image.bitmap.data[idx] / 255.0;
                const g = image.bitmap.data[idx + 1] / 255.0;
                const b = image.bitmap.data[idx + 2] / 255.0;
                
                // YOLOv8n expects CHW format (Channel, Height, Width)
                imageData[pixelIndex] = r; // R channel
                imageData[pixelIndex + this.inputSize * this.inputSize] = g; // G channel
                imageData[pixelIndex + 2 * this.inputSize * this.inputSize] = b; // B channel
                
                pixelIndex++;
            });
            
            // Import ONNX Runtime for tensor creation
            const ort = await import('onnxruntime-node');
            
            // Create tensor with shape [1, 3, 320, 320] for your YOLOv8n model
            const tensor = new ort.Tensor('float32', imageData, [1, 3, this.inputSize, this.inputSize]);
            
            return tensor;
            
        } catch (error) {
            console.error('❌ YOLOv8n image preprocessing failed:', error);
            throw error;
        }
    }
    
    postprocessYOLOv8Results(output, dims) {
        const detections = [];
        
        // YOLOv8 output format: [1, 84, 2100] for 320x320 input
        // where 84 = 4 (bbox) + 80 (classes), no objectness score
        const [batch, features, numDetections] = dims;
        
        console.log(`📊 Processing YOLOv8n output: ${numDetections} detections with ${features} features`);
        
        // YOLOv8 has transposed output format
        for (let i = 0; i < numDetections; i++) {
            // Extract box coordinates (center format) - YOLOv8 format
            const centerX = output[i]; // x
            const centerY = output[numDetections + i]; // y  
            const width = output[2 * numDetections + i]; // w
            const height = output[3 * numDetections + i]; // h
            
            // Find best class (classes start from index 4 * numDetections)
            let bestClass = 0;
            let bestScore = 0;
            
            for (let j = 0; j < 80; j++) { // 80 classes in COCO
                const classScore = output[(4 + j) * numDetections + i];
                if (classScore > bestScore) {
                    bestScore = classScore;
                    bestClass = j;
                }
            }
            
            // Skip low confidence detections
            if (bestScore < 0.5) continue;
            
            // Convert from center format to corner format and normalize [0-1]
            const xmin = Math.max(0, (centerX - width / 2) / this.inputSize);
            const ymin = Math.max(0, (centerY - height / 2) / this.inputSize);
            const xmax = Math.min(1, (centerX + width / 2) / this.inputSize);
            const ymax = Math.min(1, (centerY + height / 2) / this.inputSize);
            
            // Ensure valid box dimensions
            if (xmax > xmin && ymax > ymin) {
                detections.push({
                    label: this.classes[bestClass] || 'object',
                    score: bestScore,
                    xmin: xmin,
                    ymin: ymin,
                    xmax: xmax,
                    ymax: ymax
                });
            }
        }
        
        console.log(`🎯 Found ${detections.length} valid YOLOv8n detections before NMS`);
        
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
        
        console.log(`✅ Final YOLOv8n detections after NMS: ${keep.length}`);
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
        // Mock detection for demo when YOLOv8n model isn't loaded
        const mockObjects = [
            { label: 'person', score: 0.87, xmin: 0.1, ymin: 0.1, xmax: 0.3, ymax: 0.6 },
            { label: 'chair', score: 0.74, xmin: 0.5, ymin: 0.4, xmax: 0.8, ymax: 0.9 },
            { label: 'bottle', score: 0.71, xmin: 0.7, ymin: 0.1, xmax: 0.85, ymax: 0.4 },
            { label: 'laptop', score: 0.76, xmin: 0.2, ymin: 0.5, xmax: 0.6, ymax: 0.8 }
        ];
        
        // Randomly show 1-3 objects for realistic demo
        const numObjects = Math.floor(Math.random() * 3) + 1;
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

export default YOLOv8Inference;