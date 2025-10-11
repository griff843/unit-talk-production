import { DMService } from '../../services/dmService';

export class MessageScheduler {
  constructor(private dm: DMService) {}

  scheduleDM(discordId: string, content: any, delaySec: number) {
    setTimeout(() => {
      void this.dm
        .sendTierBasedDM(discordId, 'member', 'onboarding', content, { bypassTierCheck: true })
        .catch(() => undefined);
    }, Math.max(0, delaySec) * 1000);
  }
}

