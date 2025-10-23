import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';
export declare class AutomatedOnboardingAgent extends BaseAgent {
    private behaviorTracker;
    private conversationEngine;
    private userProfileManager;
    private interventionSystem;
    private onboardingMetrics;
    private learningPaths;
    private userProfiles;
    private adaptiveLearningEngine;
    private discordInteractionHandler;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    private setupDiscordListeners;
    protected process(): Promise<void>;
    private handleNewUser;
    private handleMessage;
    private handleReaction;
    private handlePresenceUpdate;
    private processPendingInterventions;
    private analyzeUserBehaviors;
    private updateUserProfiles;
    private checkConversionOpportunities;
    private generateOnboardingInsights;
    private triggerIntervention;
    private executeIntervention;
    private _handleOnboardingInteraction;
    private sendUserMessage;
    protected cleanup(): Promise<void>;
    protected collectMetrics(): Promise<BaseMetrics>;
    checkHealth(): Promise<any>;
    private initializeProfessionalLearningPaths;
    private loadExistingUserProfiles;
    private validateLearningPaths;
    private calculateAverageCompletion;
    private getAdaptationAccuracy;
}
//# sourceMappingURL=index.d.ts.map