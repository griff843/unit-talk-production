/**
 * AutomatedOnboardingAgent Temporal Activities
 *
 * Activity functions for user behavior tracking, conversation generation,
 * and automated onboarding workflows.
 */
export declare function trackUserBehavior(data: {
    userId: string;
    action: string;
    metadata: any;
    timestamp: Date;
}): Promise<{
    success: boolean;
    behaviorId?: string;
}>;
export declare function generateConversation(data: {
    userId: string;
    context: any;
    conversationType: string;
}): Promise<{
    success: boolean;
    message?: any;
}>;
export declare function updateUserProfile(data: {
    userId: string;
    profileUpdates: any;
}): Promise<{
    success: boolean;
    profile?: any;
}>;
export declare function scheduleIntervention(data: {
    userId: string;
    interventionType: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    triggerCondition: any;
}): Promise<{
    success: boolean;
    interventionId?: string;
}>;
export declare function analyzeOnboardingProgress(data: {
    userId: string;
}): Promise<{
    success: boolean;
    analysis?: {
        completionRate: number;
        engagementScore: number;
        nextSteps: string[];
        riskFactors: string[];
    };
}>;
export declare function processConversionOpportunity(data: {
    userId: string;
    opportunityType: string;
    context: any;
}): Promise<{
    success: boolean;
    conversionStrategy?: any;
}>;
export declare function checkOnboardingAgentHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
}>;
//# sourceMappingURL=index.d.ts.map