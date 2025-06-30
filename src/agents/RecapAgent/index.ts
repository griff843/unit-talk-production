import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies } from '../BaseAgent/types';
import { RecapState } from './recapStateManager';
import { RecapService } from './recapService';
import { RecapFormatter } from './recapFormatter';

// Define missing types
interface MicroRecapData {
  summary: string;
  picks: any[];
  performance: {
    winRate: number;
    roi: number;
    totalPicks: number;
  };
  timestamp: string;
}

interface RecapStateManager {
  loadState(): Promise<RecapState>;
  saveState(state: RecapState): Promise<void>;
  updateState(updates: Partial<RecapState>): Promise<boolean>;
}

export interface RecapAgentType {
  processRecap(): Promise<void>;
  generateRecap(): Promise<MicroRecapData>;
  triggerDailyRecap(dateStr?: string): Promise<void>;
  triggerWeeklyRecap(): Promise<void>;
  triggerMonthlyRecap(): Promise<void>;
  getRecapService(): RecapService;
  getRecapFormatter(): RecapFormatter;
  getRecapState(): RecapState;
  updateRecapState(newState: Partial<RecapState>): Promise<void>;
  
  // Remove explicit recapState property
  // Add a getter for recapState
  get recapState(): RecapState;
}

export class RecapAgent extends BaseAgent implements RecapAgentType {
  private recapService: RecapService;
  private recapFormatter: RecapFormatter;
  private stateManager: RecapStateManager;
  private _recapState: RecapState;

  constructor(
    config: BaseAgentConfig,
    dependencies: BaseAgentDependencies,
    recapService: RecapService,
    recapFormatter: RecapFormatter,
    stateManager: RecapStateManager
  ) {
    super(config, dependencies);

    this.recapService = recapService;
    this.recapFormatter = recapFormatter;
    this.stateManager = stateManager;
    this._recapState = {
      manualTriggers: {
        daily: 0,
        weekly: 0,
        monthly: 0
      }
    };
    // Load state asynchronously in initialize method
  }

  // Getter for recapState
  public get recapState(): RecapState {
    return this._recapState;
  }

  public getRecapState(): RecapState {
    return this._recapState;
  }

  public async updateRecapState(newState: Partial<RecapState>): Promise<void> {
    this._recapState = { ...this._recapState, ...newState };
    await this.stateManager.updateState(this._recapState);
  }

  public async processRecap(): Promise<void> {
    const currentState = await this.stateManager.loadState();
    this._recapState = currentState || this._recapState;
    await this.updateRecapState(this._recapState);
  }

  public async generateRecap(): Promise<MicroRecapData> {
    const currentState = await this.stateManager.loadState();
    this._recapState = currentState || this._recapState;
    return {} as MicroRecapData;
  }

  public async triggerDailyRecap(dateStr?: string): Promise<void> {
    const updatedState: Partial<RecapState> = {
      manualTriggers: {
        ...this._recapState.manualTriggers,
        daily: (this._recapState.manualTriggers?.daily || 0) + 1
      }
    };

    if (dateStr) {
      updatedState.lastDailyRecap = dateStr;
    } else {
      updatedState.lastDailyRecap = new Date().toISOString().split('T')[0]!;
    }

    await this.updateRecapState(updatedState);
    await this.processRecap();
  }

  public async triggerWeeklyRecap(): Promise<void> {
    const updatedState: Partial<RecapState> = {
      lastWeeklyRecap: new Date().toISOString(),
      manualTriggers: {
        ...this._recapState.manualTriggers,
        weekly: (this._recapState.manualTriggers?.weekly || 0) + 1
      }
    };
    await this.updateRecapState(updatedState);
    await this.processRecap();
  }

  public async triggerMonthlyRecap(): Promise<void> {
    const updatedState: Partial<RecapState> = {
      lastMonthlyRecap: new Date().toISOString(),
      manualTriggers: {
        ...this._recapState.manualTriggers,
        monthly: (this._recapState.manualTriggers?.monthly || 0) + 1
      }
    };
    await this.updateRecapState(updatedState);
    await this.processRecap();
  }

  public getRecapService(): RecapService {
    return this.recapService;
  }

  public getRecapFormatter(): RecapFormatter {
    return this.recapFormatter;
  }

  // Implement abstract methods from BaseAgent
  public async initialize(): Promise<void> {
    // Initialize recap agent
    this.logger.info('Initializing RecapAgent');
  }

  public async process(): Promise<void> {
    // Main processing logic - delegate to processRecap
    await this.processRecap();
  }

  public async cleanup(): Promise<void> {
    // Cleanup logic
    this.logger.info('Cleaning up RecapAgent');
  }

  public async checkHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: any }> {
    // Health check logic
    return {
      status: 'healthy',
      details: {
        lastRecapState: this._recapState,
        timestamp: new Date().toISOString()
      }
    };
  }

  public async collectMetrics(): Promise<any> {
    // Collect metrics
    return {
      agentName: 'RecapAgent',
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024,
      lastRecapTriggers: this._recapState.manualTriggers
    };
  }
}