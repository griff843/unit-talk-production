/**
 * Betting API Types
 * Placeholder type definitions for live testing betting API integration
 */

export interface BettingAPIRequest {
  id: string;
  type: string;
  data: any;
}

export interface BettingAPIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Add more types as needed
export type BettingAPIStatus = 'pending' | 'completed' | 'failed';