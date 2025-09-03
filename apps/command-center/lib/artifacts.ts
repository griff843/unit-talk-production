import { promises as fs } from 'fs';
import path from 'path';
import { formatDistanceToNow } from 'date-fns';

/**
 * Reads JSON artifact from out/ops directory with graceful error handling
 * @param relPath - Relative path from out/ops (e.g., "temporal-health.json")
 * @returns Parsed JSON or null if file doesn't exist or parse fails
 */
export async function safeReadJson<T>(relPath: string): Promise<T | null> {
  try {
    // Resolve path from repo root, Windows-safe
    const repoRoot = path.resolve(process.cwd(), '../..');
    const fullPath = path.join(repoRoot, 'out', 'ops', relPath);
    
    const content = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    // Gracefully return null for missing files or parse errors
    console.debug(`[artifacts] Could not read ${relPath}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Gets the modification time of an artifact file
 * @param relPath - Relative path from out/ops
 * @returns Date of last modification or null if file doesn't exist
 */
export async function getArtifactMtime(relPath: string): Promise<Date | null> {
  try {
    const repoRoot = path.resolve(process.cwd(), '../..');
    const fullPath = path.join(repoRoot, 'out', 'ops', relPath);
    
    const stats = await fs.stat(fullPath);
    return stats.mtime;
  } catch (error) {
    console.debug(`[artifacts] Could not stat ${relPath}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Formats a date as a relative time string (e.g., "2 minutes ago")
 * @param date - Date to format or null
 * @returns Formatted string or "No data yet" if date is null
 */
export function formatAgo(date: Date | null): string {
  if (!date) {
    return 'No data yet — run ops checks';
  }
  
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Unknown time';
  }
}

/**
 * Common artifact types for type safety
 */
export interface TemporalHealthArtifact {
  // Old shape support
  ok?: boolean;
  serverVersion?: string;
  roundTripMs?: number;
  
  // New shape
  httpOk?: boolean;
  grpcOk?: boolean;
  namespace?: string;
}

export interface HealthApiArtifact {
  ok?: boolean;
  httpOk?: boolean;
  version?: string;
  uptime?: number;
}

export interface HealthWorkerArtifact {
  ok: boolean;
  workers?: string[];
  timestamp?: string;
}

export interface DbPreflightArtifact {
  ok: boolean;
  counts?: {
    users?: number;
    picks?: number;
    props?: number;
  };
  version?: string;
}

export interface RuntimeModeArtifact {
  mode: 'production' | 'shadow' | 'maintenance';
  bot_publish: boolean;
  smartform_writes: boolean;
  ingestion_enabled: boolean;
  promoter_enabled: boolean;
  alerts_enabled: boolean;
}