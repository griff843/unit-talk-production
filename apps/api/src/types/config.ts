
import { BaseConfig } from './common';

export interface AgentConfig extends BaseConfig {
  interval?: number;
  retries?: number;
  timeout?: number;
}

export interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  timeout?: number;
}

export interface APIConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  retries?: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  port?: number;
  metricsPath?: string;
}
