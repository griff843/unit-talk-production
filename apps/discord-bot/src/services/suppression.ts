/**
 * Short-lived suppression utility to prevent duplicate onboarding triggers
 * when multiple subsystems react to the same role change.
 */
export const Suppression = (() => {
  const map = new Map<string, number>(); // userId -> expiresAt (ms)

  function mark(userId: string, ms: number = 15000): void {
    const expiresAt = Date.now() + ms;
    map.set(userId, expiresAt);
  }

  function isActive(userId: string): boolean {
    const expiresAt = map.get(userId);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      map.delete(userId);
      return false;
    }
    return true;
  }

  function cleanup(): void {
    const now = Date.now();
    for (const [userId, expiresAt] of map.entries()) {
      if (expiresAt <= now) map.delete(userId);
    }
  }

  return { mark, isActive, cleanup };
})();

