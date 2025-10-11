import { Client } from 'discord.js';
import { InviteIntentService } from './InviteIntentService';

// Lightweight wrapper for invite-intent based onboarding
export class OnboardingService {
  private client: Client;
  private inviteIntent: InviteIntentService;

  constructor(client: Client) {
    this.client = client;
    this.inviteIntent = new InviteIntentService();
  }

  getInviteService() {
    return this.inviteIntent;
  }
}

