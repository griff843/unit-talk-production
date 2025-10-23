import { User } from 'discord.js';
type UserTier = 'free' | 'vip' | 'vip_plus' | 'capper' | 'staff' | 'admin';
export declare class OnboardingService {
    private activeSequences;
    constructor();
    handleUserOnboarding(user: User, tier: UserTier, testMode?: boolean): Promise<void>;
    private cancelOnboarding;
    private sendTestSequence;
    private sendSequenceWithDelays;
    private createOnboardingSequence;
    private createVIPPlusSequence;
    private createVIPSequence;
    private createCapperSequence;
    private createStaffSequence;
    private createFreeSequence;
}
export {};
//# sourceMappingURL=onboardingService.d.ts.map