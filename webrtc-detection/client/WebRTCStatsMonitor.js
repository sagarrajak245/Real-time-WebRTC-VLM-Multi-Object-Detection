// client/WebRTCStatsMonitor.js - Real-time WebRTC Bandwidth & Connection Monitoring (Corrected)
class WebRTCStatsMonitor {
    constructor(peerConnection) {
        this.peerConnection = peerConnection;
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.statsHistory = [];
        this.maxHistoryLength = 30; // Keep last 30 data points (30 seconds at 1Hz)

        // Current stats snapshot
        this.currentStats = {
            bandwidth: {
                uplink_kbps: 0,
                downlink_kbps: 0,
                uplink_packets_sent: 0,
                downlink_packets_received: 0
            },
            connection: {
                rtt_ms: 0,
                jitter_ms: 0,
                packet_loss_rate: 0,
                connection_state: 'new'
            },
            video: {
                resolution: { width: 0, height: 0 },
                fps_sent: 0,
                fps_received: 0,
                frames_sent: 0,
                frames_received: 0
            },
            timestamp: Date.now()
        };

        // Previous stats for delta calculations
        this.previousStats = null;

        console.log('📊 WebRTC Stats Monitor initialized');
    }

    /**
     * Start monitoring WebRTC stats at specified interval
     */
    startMonitoring(intervalMs = 1000) {
        if (this.isMonitoring) {
            console.warn('⚠️ Stats monitoring already running');
            return;
        }

        console.log(`📈 Starting WebRTC stats monitoring (${intervalMs}ms interval)`);
        this.isMonitoring = true;

        this.monitoringInterval = setInterval(async () => {
            try {
                await this.collectStats();
            } catch (error) {
                console.error('❌ Stats collection error:', error);
            }
        }, intervalMs);

        // Initial collection
        this.collectStats();
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;

        console.log('⏹️ Stopping WebRTC stats monitoring');
        this.isMonitoring = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Collect comprehensive WebRTC statistics
     */
    async collectStats() {
        if (!this.peerConnection || this.peerConnection.connectionState !== 'connected') {
            return;
        }

        try {
            const stats = await this.peerConnection.getStats();
            const timestamp = Date.now();

            // Parse different types of WebRTC stats
            const parsedStats = this.parseWebRTCStats(stats, timestamp);

            // Calculate bandwidth deltas
            if (this.previousStats) {
                parsedStats.bandwidth = this.calculateBandwidth(parsedStats, this.previousStats);
            }

            // Update current stats
            this.currentStats = parsedStats;

            // Add to history (keep limited history)
            this.statsHistory.push({ ...parsedStats });
            if (this.statsHistory.length > this.maxHistoryLength) {
                this.statsHistory.shift();
            }

            // Store for next delta calculation
            this.previousStats = { ...parsedStats };

            // Log key metrics (debug mode)
            if (window.webrtcDebug) {
                console.log('📊 WebRTC Stats:', {
                    uplink: `${parsedStats.bandwidth.uplink_kbps} kbps`,
                    downlink: `${parsedStats.bandwidth.downlink_kbps} kbps`,
                    rtt: `${parsedStats.connection.rtt_ms}ms`,
                    fps: `${parsedStats.video.fps_received}`
                });
            }

        } catch (error) {
            console.error('❌ Failed to collect WebRTC stats:', error);
        }
    }

    /**
     * Parse raw WebRTC stats into structured format
     */
    parseWebRTCStats(stats, timestamp) {
        const result = {
            bandwidth: { uplink_kbps: 0, downlink_kbps: 0, uplink_packets_sent: 0, downlink_packets_received: 0 },
            connection: { rtt_ms: 0, jitter_ms: 0, packet_loss_rate: 0, connection_state: this.peerConnection.connectionState },
            video: { resolution: { width: 0, height: 0 }, fps_sent: 0, fps_received: 0, frames_sent: 0, frames_received: 0 },
            raw_stats: { bytes_sent: 0, bytes_received: 0, packets_sent: 0, packets_received: 0, packets_lost: 0 },
            timestamp
        };

        stats.forEach(stat => {
            switch (stat.type) {
                case 'outbound-rtp':
                    if (stat.kind === 'video') {
                        result.raw_stats.bytes_sent += stat.bytesSent || 0;
                        result.raw_stats.packets_sent += stat.packetsSent || 0;
                        result.video.frames_sent = stat.framesEncoded || 0;
                        result.video.fps_sent = this.calculateFPS(stat.framesEncoded, 'sent');
                    }
                    break;

                case 'inbound-rtp':
                    if (stat.kind === 'video') {
                        result.raw_stats.bytes_received += stat.bytesReceived || 0;
                        result.raw_stats.packets_received += stat.packetsReceived || 0;
                        result.raw_stats.packets_lost += stat.packetsLost || 0; // ✅ Correct metric
                        result.video.frames_received = stat.framesDecoded || 0;
                        result.video.fps_received = this.calculateFPS(stat.framesDecoded, 'received');
                        result.connection.jitter_ms = (stat.jitter || 0) * 1000; // Convert to ms
                        
                        // Video resolution
                        result.video.resolution.width = stat.frameWidth || 0;
                        result.video.resolution.height = stat.frameHeight || 0;
                    }
                    break;

                case 'candidate-pair':
                    if (stat.state === 'succeeded' && stat.nominated) {
                        result.connection.rtt_ms = (stat.currentRoundTripTime || 0) * 1000;
                        // ❌ Removed incorrect packet loss calculation from here
                    }
                    break;

                case 'transport':
                    result.raw_stats.bytes_sent += stat.bytesSent || 0;
                    result.raw_stats.bytes_received += stat.bytesReceived || 0;
                    break;
            }
        });

        // ✅ Calculate final packet loss rate correctly
        const totalPackets = result.raw_stats.packets_received + result.raw_stats.packets_lost;
        if (totalPackets > 0) {
            result.connection.packet_loss_rate = result.raw_stats.packets_lost / totalPackets;
        }

        return result;
    }

    /**
     * Calculate bandwidth based on byte deltas
     */
    calculateBandwidth(current, previous) {
        const timeDelta = (current.timestamp - previous.timestamp) / 1000; // Convert to seconds

        if (timeDelta <= 0) {
            return current.bandwidth; // Return existing bandwidth if no time passed
        }

        // Calculate bytes per second, then convert to kbps
        const bytesSentDelta = current.raw_stats.bytes_sent - previous.raw_stats.bytes_sent;
        const bytesReceivedDelta = current.raw_stats.bytes_received - previous.raw_stats.bytes_received;

        const uplink_kbps = Math.max(0, (bytesSentDelta * 8) / (timeDelta * 1000)); // bits -> kbps
        const downlink_kbps = Math.max(0, (bytesReceivedDelta * 8) / (timeDelta * 1000));

        return {
            uplink_kbps: Math.round(uplink_kbps * 10) / 10, // Round to 1 decimal
            downlink_kbps: Math.round(downlink_kbps * 10) / 10,
            uplink_packets_sent: current.raw_stats.packets_sent,
            downlink_packets_received: current.raw_stats.packets_received
        };
    }

    /**
     * Calculate FPS from frame count changes
     */
    calculateFPS(currentFrames, type) {
        if (!this.previousStats) return 0;

        const previous = type === 'sent'
            ? this.previousStats.video.frames_sent
            : this.previousStats.video.frames_received;

        const timeDelta = (this.currentStats.timestamp - this.previousStats.timestamp) / 1000;
        const framesDelta = currentFrames - previous;

        return timeDelta > 0 ? Math.round((framesDelta / timeDelta) * 10) / 10 : 0;
    }

    /**
     * Get current bandwidth statistics
     */
    getBandwidthStats() {
        return {
            uplink_kbps: this.currentStats.bandwidth.uplink_kbps,
            downlink_kbps: this.currentStats.bandwidth.downlink_kbps,
            total_kbps: this.currentStats.bandwidth.uplink_kbps + this.currentStats.bandwidth.downlink_kbps,
            packets_sent: this.currentStats.bandwidth.uplink_packets_sent,
            packets_received: this.currentStats.bandwidth.downlink_packets_received
        };
    }

    /**
     * Get connection quality metrics
     */
    getConnectionStats() {
        return {
            rtt_ms: this.currentStats.connection.rtt_ms,
            jitter_ms: this.currentStats.connection.jitter_ms,
            packet_loss_rate: this.currentStats.connection.packet_loss_rate,
            connection_state: this.currentStats.connection.connection_state,
            video_resolution: `${this.currentStats.video.resolution.width}x${this.currentStats.video.resolution.height}`,
            fps: this.currentStats.video.fps_received
        };
    }

    /**
     * Get comprehensive stats for benchmark reporting
     */
    getBenchmarkStats() {
        const history = this.statsHistory.slice(-10); // Last 10 data points

        if (history.length === 0) return null;

        // Calculate averages from recent history
        const avgUplink = history.reduce((sum, stat) => sum + stat.bandwidth.uplink_kbps, 0) / history.length;
        const avgDownlink = history.reduce((sum, stat) => sum + stat.bandwidth.downlink_kbps, 0) / history.length;
        const avgRtt = history.reduce((sum, stat) => sum + stat.connection.rtt_ms, 0) / history.length;
        const avgJitter = history.reduce((sum, stat) => sum + stat.connection.jitter_ms, 0) / history.length;

        return {
            bandwidth: {
                avg_uplink_kbps: Math.round(avgUplink * 10) / 10,
                avg_downlink_kbps: Math.round(avgDownlink * 10) / 10,
                peak_uplink_kbps: Math.max(...history.map(s => s.bandwidth.uplink_kbps)),
                peak_downlink_kbps: Math.max(...history.map(s => s.bandwidth.downlink_kbps))
            },
            connection: {
                avg_rtt_ms: Math.round(avgRtt * 10) / 10,
                avg_jitter_ms: Math.round(avgJitter * 10) / 10,
                avg_packet_loss_rate: history.reduce((sum, stat) => sum + stat.connection.packet_loss_rate, 0) / history.length
            },
            video: {
                resolution: `${this.currentStats.video.resolution.width}x${this.currentStats.video.resolution.height}`,
                avg_fps: history.reduce((sum, stat) => sum + stat.video.fps_received, 0) / history.length
            }
        };
    }

    /**
     * Enable detailed debug logging
     */
    enableDebugLogging() {
        window.webrtcDebug = true;
        console.log('🔍 WebRTC debug logging enabled');
    }

    /**
     * Disable debug logging
     */
    disableDebugLogging() {
        window.webrtcDebug = false;
        console.log('🔇 WebRTC debug logging disabled');
    }
} 

// Export for use in main app
window.WebRTCStatsMonitor = WebRTCStatsMonitor;  
