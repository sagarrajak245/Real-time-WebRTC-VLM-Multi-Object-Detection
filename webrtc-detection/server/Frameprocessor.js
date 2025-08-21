// server/FrameProcessor.js - Advanced Frame Queue Management with Backpressure (Corrected)
export default class FrameProcessor {
    constructor(maxQueueSize = 10, processingTimeoutMs = 5000) {
        this.maxQueueSize = maxQueueSize;
        this.processingTimeoutMs = processingTimeoutMs;
        this.frameQueue = [];
        this.isProcessing = false;
        
        // Metrics and state... (rest of constructor is the same)
        this.metrics = {
            totalFramesReceived: 0,
            framesProcessed: 0,
            framesDropped: 0,
            queueDropped: 0,
            timeoutDropped: 0,
            totalQueueWaitTime: 0,
            totalServerProcessingTime: 0,
            totalNetworkLatency: 0,
            maxQueueSize: 0,
            currentQueueSize: 0
        };
        this.processingStartTime = null;
        this.lastMetricsReset = Date.now();
        console.log(`🔄 FrameProcessor initialized with max queue size: ${maxQueueSize}`);
    }

    /**
     * ✅ MODIFIED: Add a 'socket' parameter here.
     * Add frame to processing queue with smart dropping policy
     */
    enqueueFrame(frameData, inferenceFunction, socket) { // <-- Added socket
        const enqueueTime = Date.now();
        this.metrics.totalFramesReceived++;
        
        const networkLatency = frameData.capture_ts ? enqueueTime - frameData.capture_ts : 0;
        this.metrics.totalNetworkLatency += networkLatency;

        const enhancedFrameData = {
            ...frameData,
            enqueue_ts: enqueueTime,
            network_latency: networkLatency,
            inferenceFunction,
            socket // <-- Store the socket object with the frame
        };

        if (this.frameQueue.length >= this.maxQueueSize) {
            const droppedFrame = this.frameQueue.shift();
            this.metrics.framesDropped++;
            this.metrics.queueDropped++;
            console.log(`⚠️ Queue full! Dropped frame ${droppedFrame.frame_id}`);
        }

        this.frameQueue.push(enhancedFrameData);
        this.metrics.currentQueueSize = this.frameQueue.length;
        this.metrics.maxQueueSize = Math.max(this.metrics.maxQueueSize, this.frameQueue.length);

        if (!this.isProcessing) {
            this.processQueue();
        }
        // ... (rest of the function is the same)
        return {
            queued: true,
            queueSize: this.frameQueue.length,
            networkLatency: networkLatency
        };
    }

    /**
     * Process frames from queue with enhanced metrics tracking
     */
    async processQueue() {
        if (this.isProcessing || this.frameQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        
        while (this.frameQueue.length > 0) {
            const frameData = this.frameQueue.shift();
            this.metrics.currentQueueSize = this.frameQueue.length;
            
            try {
                // ✅ MODIFIED: Get the result from processing
                const result = await this.processSingleFrame(frameData);
                
                // ✅ FIX: Use the socket from the frame data to emit the result
                if (result && frameData.socket) {
                    frameData.socket.emit('detections', result);
                }

            } catch (error) {
                console.error('❌ Frame processing error:', error);
                this.metrics.framesDropped++;
            }
        }

        this.isProcessing = false;
    }

    /**
     * Process individual frame with detailed timing metrics
     */
    async processSingleFrame(frameData) {
        const processing_start_ts = Date.now();
        const queueWaitTime = processing_start_ts - frameData.enqueue_ts;
        this.metrics.totalQueueWaitTime += queueWaitTime;
        
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Processing timeout')), this.processingTimeoutMs);
            });
            
            const inferencePromise = frameData.inferenceFunction(frameData);
            const detectionResult = await Promise.race([inferencePromise, timeoutPromise]);
            
            const processing_end_ts = Date.now();
            const serverProcessingTime = processing_end_ts - processing_start_ts;
            
            this.metrics.framesProcessed++;
            this.metrics.totalServerProcessingTime += serverProcessingTime;
            
            const enhancedResult = {
                ...detectionResult,
                processing_start_ts,
                processing_end_ts,
                queue_wait_ms: queueWaitTime,
                server_latency_ms: serverProcessingTime,
                network_latency_ms: frameData.network_latency,
                total_latency_ms: processing_end_ts - frameData.capture_ts
            };
            
            console.log(`✅ Frame ${frameData.frame_id} processed (server: ${serverProcessingTime}ms)`);
            
            // Return the result so it can be emitted
            return enhancedResult; 
            
        } catch (error) {
            if (error.message === 'Processing timeout') {
                console.warn(`⏰ Frame ${frameData.frame_id} processing timeout`);
                this.metrics.timeoutDropped++;
            }
            throw error;
        }
    }
    
    // ... (getMetrics, resetMetrics, etc. remain the same)
    getMetrics() {
        const now = Date.now();
        const elapsedSeconds = (now - this.lastMetricsReset) / 1000;
        const processedFrames = Math.max(1, this.metrics.framesProcessed);
        return {
            frames_received: this.metrics.totalFramesReceived,
            frames_processed: this.metrics.framesProcessed,
            frames_dropped: this.metrics.framesDropped,
            queue_dropped: this.metrics.queueDropped,
            timeout_dropped: this.metrics.timeoutDropped,
            processing_fps: this.metrics.framesProcessed / elapsedSeconds,
            drop_rate: this.metrics.framesDropped / Math.max(1, this.metrics.totalFramesReceived),
            max_queue_size_used: this.metrics.maxQueueSize,
            current_queue_size: this.metrics.currentQueueSize,
            queue_utilization: this.metrics.maxQueueSize > 0 ? this.metrics.maxQueueSize / this.maxQueueSize : 0,
            avg_network_latency_ms: this.metrics.totalNetworkLatency / processedFrames,
            avg_queue_wait_ms: this.metrics.totalQueueWaitTime / processedFrames,
            avg_server_processing_ms: this.metrics.totalServerProcessingTime / processedFrames,
            elapsed_seconds: elapsedSeconds,
            metrics_since: this.lastMetricsReset
        };
    }
    resetMetrics() {
        console.log('🔄 Resetting FrameProcessor metrics...');
        this.metrics = {
            totalFramesReceived: 0,
            framesProcessed: 0,
            framesDropped: 0,
            queueDropped: 0,
            timeoutDropped: 0,
            totalQueueWaitTime: 0,
            totalServerProcessingTime: 0,
            totalNetworkLatency: 0,
            maxQueueSize: 0,
            currentQueueSize: this.frameQueue.length
        };
        this.lastMetricsReset = Date.now();
    }
    getQueueStatus() {
        return {
            size: this.frameQueue.length,
            maxSize: this.maxQueueSize,
            utilization: this.maxQueueSize > 0 ? (this.frameQueue.length / this.maxQueueSize * 100).toFixed(1) + '%' : '0.0%',
            isProcessing: this.isProcessing,
            oldestFrameAge: this.frameQueue.length > 0 ?
                Date.now() - this.frameQueue[0].enqueue_ts : 0
        };
    }
    updateConfig(newMaxQueueSize, newTimeoutMs) {
        console.log(`⚙️ Updating FrameProcessor config: queue ${this.maxQueueSize}→${newMaxQueueSize}, timeout ${this.processingTimeoutMs}→${newTimeoutMs}ms`);
        this.maxQueueSize = newMaxQueueSize;
        this.processingTimeoutMs = newTimeoutMs;
        while (this.frameQueue.length > this.maxQueueSize) {
            const dropped = this.frameQueue.shift();
            this.metrics.framesDropped++;
            this.metrics.queueDropped++;
            console.log(`🗑️ Dropped frame ${dropped.frame_id} due to config change`); 
        }
    }
} 