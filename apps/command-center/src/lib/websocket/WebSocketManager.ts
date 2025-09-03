/**
 * Enhanced WebSocket Manager with Error Boundaries and Reconnection Logic
 * Provides robust real-time communication with automatic recovery
 */

import { useState, useEffect } from 'react';

interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  timeout?: number;
}

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  id: string;
}

interface WebSocketStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  lastConnected: Date | null;
  messagesReceived: number;
  messagesSent: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private status: WebSocketStatus;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private errorBoundaries: Map<string, (error: Error) => void> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      timeout: 10000,
      ...config,
    };

    this.status = {
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
      lastConnected: null,
      messagesReceived: 0,
      messagesSent: 0,
    };
  }

  /**
   * Connect to WebSocket with error handling
   */
  async connect(): Promise<boolean> {
    if (this.status.connected || this.status.connecting) {
      return this.status.connected;
    }

    this.status.connecting = true;
    this.status.error = null;

    try {
      console.log(`🔗 Connecting to WebSocket: ${this.config.url}`);

      this.ws = new WebSocket(this.config.url, this.config.protocols);

      // Set up connection timeout
      const connectTimeout = setTimeout(() => {
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          this.ws.close();
          this.handleConnectionError(new Error('Connection timeout'));
        }
      }, this.config.timeout);

      this.ws.onopen = () => {
        clearTimeout(connectTimeout);
        this.handleConnectionOpen();
      };

      this.ws.onmessage = event => {
        this.handleMessage(event);
      };

      this.ws.onerror = error => {
        clearTimeout(connectTimeout);
        this.handleConnectionError(new Error('WebSocket error'));
      };

      this.ws.onclose = event => {
        clearTimeout(connectTimeout);
        this.handleConnectionClose(event);
      };

      // Wait for connection or timeout
      return new Promise(resolve => {
        const checkConnection = () => {
          if (this.status.connected) {
            resolve(true);
          } else if (!this.status.connecting) {
            resolve(false);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    } catch (error) {
      this.handleConnectionError(error as Error);
      return false;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('🔌 Disconnecting WebSocket');
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }

    this.status.connected = false;
    this.status.connecting = false;
  }

  /**
   * Send message with error boundary protection
   */
  send(type: string, payload: any): boolean {
    try {
      const message: WebSocketMessage = {
        type,
        payload,
        timestamp: Date.now(),
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      if (this.status.connected && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
        this.status.messagesSent++;
        return true;
      } else {
        // Queue message for later if not connected
        this.messageQueue.push(message);
        console.warn(`⚠️ WebSocket not connected, queuing message: ${type}`);
        return false;
      }
    } catch (error) {
      this.handleMessageError(type, error as Error);
      return false;
    }
  }

  /**
   * Subscribe to message types with error boundaries
   */
  on(messageType: string, handler: Function, errorBoundary?: (error: Error) => void): void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, []);
    }

    this.listeners.get(messageType)!.push(handler);

    if (errorBoundary) {
      this.errorBoundaries.set(`${messageType}_${handler.toString()}`, errorBoundary);
    }
  }

  /**
   * Unsubscribe from message types
   */
  off(messageType: string, handler?: Function): void {
    const handlers = this.listeners.get(messageType);
    if (!handlers) return;

    if (handler) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        this.errorBoundaries.delete(`${messageType}_${handler.toString()}`);
      }
    } else {
      this.listeners.delete(messageType);
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): WebSocketStatus {
    return { ...this.status };
  }

  /**
   * Enable automatic reconnection
   */
  enableAutoReconnect(): void {
    if (
      !this.status.connected &&
      this.status.reconnectAttempts < this.config.maxReconnectAttempts!
    ) {
      const delay = this.config.reconnectInterval! * Math.pow(2, this.status.reconnectAttempts);

      console.log(
        `🔄 Attempting reconnection in ${delay}ms (attempt ${this.status.reconnectAttempts + 1}/${this.config.maxReconnectAttempts})`
      );

      this.reconnectTimer = setTimeout(async () => {
        this.status.reconnectAttempts++;
        const connected = await this.connect();

        if (!connected) {
          this.enableAutoReconnect();
        }
      }, delay);
    }
  }

  /**
   * Handle successful connection
   */
  private handleConnectionOpen(): void {
    console.log('✅ WebSocket connected successfully');

    this.status.connected = true;
    this.status.connecting = false;
    this.status.error = null;
    this.status.reconnectAttempts = 0;
    this.status.lastConnected = new Date();

    // Send queued messages
    this.processMessageQueue();

    // Start heartbeat
    this.startHeartbeat();

    // Emit connection event
    this.emit('connected', { status: this.status });
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: Error): void {
    console.error('❌ WebSocket connection error:', error);

    this.status.connecting = false;
    this.status.connected = false;
    this.status.error = error.message;

    this.emit('error', { error: error.message, status: this.status });

    // Auto-reconnect if enabled
    if (this.status.reconnectAttempts < this.config.maxReconnectAttempts!) {
      this.enableAutoReconnect();
    }
  }

  /**
   * Handle connection close
   */
  private handleConnectionClose(event: CloseEvent): void {
    console.log(`🔌 WebSocket disconnected: ${event.code} - ${event.reason}`);

    this.status.connected = false;
    this.status.connecting = false;
    this.clearTimers();

    this.emit('disconnected', { code: event.code, reason: event.reason, status: this.status });

    // Auto-reconnect unless it was a manual disconnect
    if (event.code !== 1000) {
      this.enableAutoReconnect();
    }
  }

  /**
   * Handle incoming messages with error boundaries
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.status.messagesReceived++;

      const handlers = this.listeners.get(message.type) || [];

      handlers.forEach(handler => {
        try {
          handler(message.payload, message);
        } catch (error) {
          this.handleHandlerError(message.type, error as Error, handler);
        }
      });
    } catch (error) {
      console.error('❌ Failed to parse WebSocket message:', error);
      this.emit('parse_error', { error: (error as Error).message, data: event.data });
    }
  }

  /**
   * Handle message handler errors
   */
  private handleHandlerError(messageType: string, error: Error, handler: Function): void {
    console.error(`❌ Error in ${messageType} handler:`, error);

    const errorBoundary = this.errorBoundaries.get(`${messageType}_${handler.toString()}`);
    if (errorBoundary) {
      try {
        errorBoundary(error);
      } catch (boundaryError) {
        console.error('❌ Error boundary failed:', boundaryError);
      }
    }

    this.emit('handler_error', { messageType, error: error.message });
  }

  /**
   * Handle message sending errors
   */
  private handleMessageError(messageType: string, error: Error): void {
    console.error(`❌ Failed to send ${messageType} message:`, error);
    this.emit('send_error', { messageType, error: error.message });
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`📤 Processing ${this.messageQueue.length} queued messages`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach(message => {
      this.send(message.type, message.payload);
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.status.connected) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval!);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Emit events to listeners
   */
  private emit(eventType: string, data: any): void {
    const handlers = this.listeners.get(eventType) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`❌ Error in ${eventType} event handler:`, error);
      }
    });
  }
}

// Export singleton instance for application use
export const websocketManager = new WebSocketManager({
  url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
  reconnectInterval: 3000,
  maxReconnectAttempts: 15,
  heartbeatInterval: 30000,
  timeout: 10000,
});

// React hook for using WebSocket in components
export function useWebSocket() {
  const [status, setStatus] = useState(websocketManager.getStatus());

  useEffect(() => {
    const updateStatus = () => setStatus(websocketManager.getStatus());

    websocketManager.on('connected', updateStatus);
    websocketManager.on('disconnected', updateStatus);
    websocketManager.on('error', updateStatus);

    return () => {
      websocketManager.off('connected', updateStatus);
      websocketManager.off('disconnected', updateStatus);
      websocketManager.off('error', updateStatus);
    };
  }, []);

  return {
    status,
    send: websocketManager.send.bind(websocketManager),
    on: websocketManager.on.bind(websocketManager),
    off: websocketManager.off.bind(websocketManager),
    connect: websocketManager.connect.bind(websocketManager),
    disconnect: websocketManager.disconnect.bind(websocketManager),
  };
}

export default WebSocketManager;
