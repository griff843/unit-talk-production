// Command usage tracking service
export class CommandUsageService {
  private usageCache = new Map<string, number>();

  async getUsageCount(userId: string, command: string, date: string): Promise<number> {
    const key = `${userId}_${command}_${date}`;
    return this.usageCache.get(key) || 0;
  }

  async incrementUsage(userId: string, command: string, date: string): Promise<void> {
    const key = `${userId}_${command}_${date}`;
    const current = this.usageCache.get(key) || 0;
    this.usageCache.set(key, current + 1);
  }

  async setCooldown(key: string, timestamp: number): Promise<void> {
    // Simple in-memory cooldown tracking
    this.usageCache.set(`cooldown_${key}`, timestamp);
  }

  async getCooldown(key: string): Promise<number | null> {
    return this.usageCache.get(`cooldown_${key}`) || null;
  }
}