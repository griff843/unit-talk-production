/**
 * gatewayStatus.ts
 *
 * Singleton that tracks the Discord WebSocket gateway connection state.
 * Updated by the bot's ready/disconnect/error events; read by the health check.
 *
 * This separates gateway connectivity truth from Discord REST API reachability.
 * Webhook posting (DiscordPromotionAgent) does NOT depend on this bot's gateway
 * connection — it uses a standalone webhook URL via the API service.
 */

export type GatewayState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface GatewayStatusSnapshot {
  state: GatewayState;
  connectedAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

let currentState: GatewayState = 'disconnected';
let connectedAt: string | null = null;
let lastErrorAt: string | null = null;
let lastError: string | null = null;

export function setGatewayConnected(): void {
  currentState = 'connected';
  connectedAt = new Date().toISOString();
  lastError = null;
}

export function setGatewayDisconnected(): void {
  currentState = 'disconnected';
}

export function setGatewayConnecting(): void {
  currentState = 'connecting';
}

export function setGatewayError(error: string): void {
  currentState = 'error';
  lastErrorAt = new Date().toISOString();
  lastError = error;
}

export function getGatewayStatus(): GatewayStatusSnapshot {
  return {
    state: currentState,
    connectedAt,
    lastErrorAt,
    lastError,
  };
}

export function isGatewayConnected(): boolean {
  return currentState === 'connected';
}
