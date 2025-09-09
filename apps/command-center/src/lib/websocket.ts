/**
 * WebSocket Client for Real-Time Data Streaming
 * Provides real-time updates for agent status, system metrics, and alerts
 */

export interface WebSocketMessage {
  type:
    | 'agent-status'
    | 'system-metrics'
    | 'alert'
    | 'user-activity'
    | 'pick-update'
    | 'connection';
  payload: any;
  timestamp: string;
  id?: string;
}

export interface SystemMetrics {
  timestamp: number;
  agents: {
    [agentId: string]: {
      status: 'healthy' | 'warning' | 'error' | 'inactive';
      cpu: number;
      memory: number;
      uptime: number;
      operations: number;
    };
  };
  system: {
    cpu: number;
    memory: number;
    disk: number;
    network: {
      bytesIn: number;
      bytesOut: number;
    };
  };
  business: {
    activeUsers: number;
    picksProcessed: number;
    alertsSent: number;
    revenue: number;
  };
}

class CommandCenterWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private connectionId: string | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(private url?: string) {
    this.url = url || this.getWebSocketUrl();
  }

  private getWebSocketUrl(): string {
    // In development, use localhost. In production, use the domain
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env['NODE_ENV'] === 'development' ? 'localhost:3010' : window.location.host;
    return `${protocol}//${host}/api/websocket`;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting to WebSocket:', this.url);
        this.ws = new WebSocket(this.url!);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.reconnectAttempts = 0;
          this.startPingTimer();

          // Send connection info
          this.send('connection', {
            type: 'command-center',
            timestamp: new Date().toISOString(),
          });

          resolve();
        };

        this.ws.onmessage = event => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = event => {
          console.log('🔌 WebSocket disconnected:', event.code, event.reason);
          this.cleanup();

          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = error => {
          console.error('❌ WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        console.error('❌ WebSocket connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    console.log('🔌 Disconnecting WebSocket');
    this.cleanup();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Send message to WebSocket server
   */
  send(type: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type: type as any,
        payload,
        timestamp: new Date().toISOString(),
        id: this.generateId(),
      };

      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket not connected, message queued:', type);
    }
  }

  /**
   * Subscribe to specific message types
   */
  subscribe(messageType: string, callback: (data: any) => void) {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, new Set());
    }

    this.listeners.get(messageType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const typeListeners = this.listeners.get(messageType);
      if (typeListeners) {
        typeListeners.delete(callback);
        if (typeListeners.size === 0) {
          this.listeners.delete(messageType);
        }
      }
    };
  }

  /**
   * Get connection status
   */
  getStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (!this.ws) return 'disconnected';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSED:
        return 'disconnected';
      case WebSocket.CLOSING:
        return 'disconnected';
      default:
        return 'error';
    }
  }

  /**
   * Request real-time agent monitoring
   */
  startAgentMonitoring() {
    this.send('start-monitoring', {
      type: 'agents',
      interval: 5000, // 5 second updates
    });
  }

  /**
   * Stop real-time agent monitoring
   */
  stopAgentMonitoring() {
    this.send('stop-monitoring', {
      type: 'agents',
    });
  }

  /**
   * Request system metrics updates
   */
  startSystemMetrics() {
    this.send('start-monitoring', {
      type: 'system-metrics',
      interval: 10000, // 10 second updates
    });
  }

  /**
   * Stop system metrics updates
   */
  stopSystemMetrics() {
    this.send('stop-monitoring', {
      type: 'system-metrics',
    });
  }

  private handleMessage(message: WebSocketMessage) {
    console.log('📨 WebSocket message received:', message.type);

    // Handle connection acknowledgment
    if (message.type === 'connection' && message.payload?.connectionId) {
      this.connectionId = message.payload.connectionId;
      console.log('🆔 WebSocket connection ID:', this.connectionId);
    }

    // Notify subscribers
    const typeListeners = this.listeners.get(message.type);
    if (typeListeners) {
      typeListeners.forEach(callback => {
        try {
          callback(message.payload);
        } catch (error) {
          console.error(`❌ Error in WebSocket callback for ${message.type}:`, error);
        }
      });
    }
  }

  private attemptReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `🔄 Attempting WebSocket reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('❌ WebSocket reconnect failed:', error);

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Max WebSocket reconnect attempts reached');
        }
      });
    }, delay);
  }

  private startPingTimer() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }

    // Send ping every 30 seconds to keep connection alive
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send('ping', { timestamp: new Date().toISOString() });
      }
    }, 30000);
  }

  private cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const commandCenterWS = new CommandCenterWebSocket();

// Auto-connect in browser environment
if (typeof window !== 'undefined') {
  // Connect when the module loads
  commandCenterWS.connect().catch(error => {
    console.warn('⚠️ Initial WebSocket connection failed:', error);
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    commandCenterWS.disconnect();
  });
}

export { CommandCenterWebSocket };
