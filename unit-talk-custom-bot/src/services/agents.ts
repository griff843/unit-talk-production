import axios from 'axios';
import { botConfig } from '../config';
import { logger } from '../utils/logger';

export interface AgentHealthCheck {
  status: 'healthy' | 'unhealthy';
  details?: string;
  timestamp: Date;
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class AgentService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = botConfig.agents?.baseUrl || 'http://localhost:3001';
    this.apiKey = botConfig.agents?.apiKey || '';
  }

  /**
   * Health check for agent service
   */
  async healthCheck(): Promise<AgentHealthCheck> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      if (response.status === 200) {
        return {
          status: 'healthy',
          timestamp: new Date()
        };
      } else {
        return {
          status: 'unhealthy',
          details: `HTTP ${response.status}`,
          timestamp: new Date()
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  /**
   * Send request to specific agent
   */
  async sendToAgent(agentName: string, action: string, data: any): Promise<AgentResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/agents/${agentName}/${action}`, data, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error(`Agent ${agentName} request failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get agent status
   */
  async getAgentStatus(agentName: string): Promise<AgentResponse> {
    return this.sendToAgent(agentName, 'status', {});
  }

  /**
   * Restart agent
   */
  async restartAgent(agentName: string): Promise<AgentResponse> {
    return this.sendToAgent(agentName, 'restart', {});
  }

  /**
   * Get all agents status
   */
  async getAllAgentsStatus(): Promise<AgentResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/agents/status`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Failed to get all agents status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send notification to OperatorAgent
   */
  async notifyOperator(message: string, severity: 'info' | 'warning' | 'error' = 'info'): Promise<AgentResponse> {
    return this.sendToAgent('OperatorAgent', 'notify', {
      message,
      severity,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Request recap generation
   */
  async requestRecap(options: any): Promise<AgentResponse> {
    return this.sendToAgent('RecapAgent', 'generate', options);
  }

  /**
   * Request alert generation
   */
  async requestAlert(options: any): Promise<AgentResponse> {
    return this.sendToAgent('AlertAgent', 'generate', options);
  }

  /**
   * Request analytics data
   */
  async requestAnalytics(options: any): Promise<AgentResponse> {
    return this.sendToAgent('AnalyticsAgent', 'analyze', options);
  }

  /**
   * Request grading
   */
  async requestGrading(options: any): Promise<AgentResponse> {
    return this.sendToAgent('GradingAgent', 'grade', options);
  }

  /**
   * Request contest update
   */
  async requestContestUpdate(options: any): Promise<AgentResponse> {
    return this.sendToAgent('ContestAgent', 'update', options);
  }

  /**
   * Request notification
   */
  async requestNotification(options: any): Promise<AgentResponse> {
    return this.sendToAgent('NotificationAgent', 'send', options);
  }
}

export const agentService = new AgentService();