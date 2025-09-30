export async function getPlayerHeadshotUrl(playerName: string, sport?: string): Promise<string | null> {
  // Placeholder implementation to decouple discord-bot from apps/api internal paths.
  // Non-functional stub: return null when no known headshot mapping is available.
  // If needed later, wire this to a shared service or CDN.
  try {
    if (!playerName) return null;
    return null;
  } catch {
    return null;
  }
}

