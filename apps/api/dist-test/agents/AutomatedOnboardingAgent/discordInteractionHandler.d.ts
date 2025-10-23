import { Logger } from '../../shared/logger/types';
/**
 * 🎮 Discord Interaction Handler
 * Manages sophisticated Discord interactions for the onboarding system
 * Handles embeds, reactions, buttons, forms, and progressive learning flows
 */
export declare class DiscordInteractionHandler {
    private logger;
    private activeInteractions;
    private embedTemplates;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    isHealthy(): Promise<boolean>;
    /**
     * Creates a welcome interaction for new users
     */
    createWelcomeInteraction(userId: string, userProfile: any): Promise<DiscordInteraction>;
    /**
     * Creates a learning step interaction
     */
    createLearningStepInteraction(userId: string, stepData: any, userProgress: any): Promise<DiscordInteraction>;
    /**
     * Processes user response to an interaction
     */
    processInteractionResponse(interactionId: string, responseType: string, responseData: any): Promise<InteractionResult>;
    /**
     * Creates adaptive follow-up interactions based on user behavior
     */
    createAdaptiveFollowUp(userId: string, behaviorData: any, adaptationRecommendation: any): Promise<DiscordInteraction | null>;
    private initializeEmbedTemplates;
    private loadInteractionTemplates;
    private setupReactionTracking;
    private createWelcomeEmbed;
    private createWelcomeButtons;
    private createStepEmbed;
    private createStepComponents;
    private getExpectedResponses;
    private analyzeResponse;
    private determineNextAction;
    private assessResponseQuality;
    private checkCompletionCriteria;
    private calculateEngagementScore;
    private suggestNextAction;
    private createRetryInteraction;
    private createAdaptiveEmbed;
    private createAdaptiveComponents;
    private generateUserFeedback;
    cleanup(): Promise<void>;
}
export interface DiscordInteraction {
    id: string;
    userId: string;
    type: 'welcome' | 'learning_step' | 'quiz' | 'assessment' | 'adaptive_followup';
    embed: any;
    components: any[];
    expectedResponses: string[];
    timeout: number;
    createdAt: string;
    metadata?: any;
}
export interface ActiveInteraction {
    interaction: DiscordInteraction;
    startTime: number;
    responses: InteractionResponse[];
    completed: boolean;
}
export interface InteractionResponse {
    type: string;
    data: any;
    timestamp: string;
}
export interface InteractionResult {
    success: boolean;
    analysisResult?: ResponseAnalysis;
    nextAction?: string;
    nextInteraction?: any;
    feedback?: string;
    error?: string;
}
export interface ResponseAnalysis {
    quality: number;
    engagementScore: number;
    responseTime: number;
    meetsCompletion: boolean;
    nextSuggestion: string;
}
export interface NextActionResult {
    type: 'complete' | 'continue' | 'retry' | 'escalate';
    confidence: number;
    reasoning: string;
    nextInteraction?: any;
}
export interface EmbedTemplate {
    title: string;
    description: string;
    color: number;
    fields: any[];
    footer: {
        text: string;
    };
}
//# sourceMappingURL=discordInteractionHandler.d.ts.map