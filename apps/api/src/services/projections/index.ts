/**
 * Projections Service Stub
 * STUB: Created during main-consolidation-2026-02-16 to fix missing module error
 * TODO: Implement full projection engine when projections feature is ready
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProjectionResult {
  player: string;
  marketType: string;
  projectedLine?: number;
  confidence?: number;
  source?: string;
  timestamp?: string;
}

export class ProjectionEngine {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get projection for a player/market combination
   * STUB: Returns null until projections feature is implemented
   */
  async getProjection(
    player: string,
    marketType: string,
    _options?: { sport?: string; date?: string }
  ): Promise<ProjectionResult | null> {
    // TODO: Implement actual projection lookup
    // For now, return null to indicate no projection available
    return null;
  }

  /**
   * Check if projections are available for a sport
   * STUB: Returns false until projections feature is implemented
   */
  isAvailable(_sport: string): boolean {
    return false;
  }
}

let _projectionEngine: ProjectionEngine | null = null;

export function getProjectionEngine(supabase: SupabaseClient): ProjectionEngine {
  if (!_projectionEngine) {
    _projectionEngine = new ProjectionEngine(supabase);
  }
  return _projectionEngine;
}
