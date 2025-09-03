 // Agent task input type
 export interface AgentTaskInput {
   task_id: string;
   agent: string;
   data: unknown;
 }

 // Agent task result type
 export interface AgentTaskResult {
   success: boolean;
   data?: unknown;
   error?: Error;
 }

 // Agent status enum
 export enum AgentStatus {
   OK = 'ok',
   WARN = 'warn',
   ERROR = 'error'
 }

 // Health check result type
 export interface HealthCheckResult {
   status: AgentStatus;
   details?: {
     errors?: string[];
     warnings?: string[];
     info?: string[];
   };
 }

 // Agent command type
 export interface AgentCommand {
   type: string;
   payload?: unknown;
 }

 // Agent configuration type
 export interface AgentConfig {
   name: string;
   enabled: boolean;
   healthCheckIntervalMs?: number;
   metricsIntervalMs?: number;
   [key: string]: unknown;
 } 