/**
 * WebSocket Client for Smart Form
 *
 * Lightweight WebSocket client for emitting pick submission events
 * to Command Center for real-time feed updates.
 */

interface PickSubmittedEvent {
  type: 'pick.submitted';
  pickId: string;
  userId: string;
  league: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

class SmartFormWebSocketClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: PickSubmittedEvent[] = [];

  constructor() {
    // Auto-connect in browser environment only
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  /**
   * Connect to WebSocket server with fallback handling
   */
  connect(): void {
    if (typeof window === 'undefined') return;

    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[SmartForm WS] Connected to Command Center');
        this.connected = true;
        this.processMessageQueue();
      };

      this.ws.onerror = (error) => {
        console.warn('[SmartForm WS] Connection error (non-blocking):', error);
        // Non-blocking: continue without WebSocket if unavailable
      };

      this.ws.onclose = () => {
        console.log('[SmartForm WS] Disconnected');
        this.connected = false;

        // Auto-reconnect after 5 seconds
        this.reconnectTimer = setTimeout(() => {
          console.log('[SmartForm WS] Attempting to reconnect...');
          this.connect();
        }, 5000);
      };
    } catch (error) {
      console.warn('[SmartForm WS] Failed to connect (non-blocking):', error);
      // Non-blocking: Smart Form continues to work without WebSocket
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
  }

  /**
   * Emit pick submission event
   *
   * This is non-blocking - if WebSocket is unavailable, the event is queued
   * or silently dropped. The Smart Form continues to function normally.
   */
  emitPickSubmitted(event: Omit<PickSubmittedEvent, 'type' | 'timestamp'>): void {
    const fullEvent: PickSubmittedEvent = {
      type: 'pick.submitted',
      timestamp: new Date().toISOString(),
      ...event,
    };

    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(fullEvent));
        console.log('[SmartForm WS] Pick submission event emitted', {
          pickId: event.pickId,
          userId: event.userId,
          league: event.league,
        });
      } catch (error) {
        console.warn('[SmartForm WS] Failed to send event (non-blocking):', error);
        this.messageQueue.push(fullEvent);
      }
    } else {
      // Queue for later if not connected
      this.messageQueue.push(fullEvent);
      console.log('[SmartForm WS] Event queued (not connected)', {
        queueSize: this.messageQueue.length,
      });
    }
  }

  /**
   * Process queued messages when connection is restored
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`[SmartForm WS] Processing ${this.messageQueue.length} queued messages`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach(event => {
      try {
        this.ws?.send(JSON.stringify(event));
      } catch (error) {
        console.warn('[SmartForm WS] Failed to send queued message:', error);
      }
    });
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// Singleton instance
export const wsClient = new SmartFormWebSocketClient();

// Export type for use in other modules
export type { PickSubmittedEvent };
