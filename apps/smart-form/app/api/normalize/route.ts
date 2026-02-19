import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase';
import { createRouteLogger, logDatabaseOperation } from '@/lib/logger';

const log = createRouteLogger('POST /api/normalize', 'POST');

const NormalizeSchema = z.object({
  type: z.enum(['team', 'player']),
  query: z.string().min(1, 'query is required'),
  sport: z.string().optional(),
  team: z.string().optional(), // For player normalization, optionally require team match
});

interface NormalizedResult {
  found: boolean;
  canonical: string | null;
  id: string | null;
  confidence: number;
  alternatives: Array<{
    name: string;
    id: string;
    score: number;
  }>;
}

/**
 * V1.1 COMPLIANCE: Normalization Endpoint
 *
 * Per Section 4 - Auto-Normalization Contract:
 * - "Celtics" / "Boston" / "BOS" → "Boston Celtics"
 * - Player nicknames / abbreviations / partial names must normalize
 *
 * Per Section 5 - Manual Mode V1.1:
 * - Manual mode still validates team belongs to sport
 * - Manual mode still validates player belongs to team
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const validation = NormalizeSchema.safeParse(body);

    if (!validation.success) {
      log.warn({ validation_errors: validation.error.errors }, 'Invalid request body');
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { type, query, sport, team } = validation.data;
    const queryLower = query.toLowerCase().trim();

    log.info({ type, query, sport, team }, 'Normalizing input');

    const sb = supabaseServer();
    let result: NormalizedResult = {
      found: false,
      canonical: null,
      id: null,
      confidence: 0,
      alternatives: [],
    };

    if (type === 'team') {
      result = await normalizeTeam(sb, queryLower, sport);
    } else if (type === 'player') {
      result = await normalizePlayer(sb, queryLower, sport, team);
    }

    log.info({
      type,
      query,
      found: result.found,
      canonical: result.canonical,
      confidence: result.confidence,
      duration_ms: Date.now() - startTime,
    }, result.found ? 'Normalization successful' : 'No match found');

    return NextResponse.json({
      ...result,
      meta: {
        query,
        type,
        sport: sport || null,
        team: team || null,
        source: 'database',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : 'Unknown error' },
      'Normalization failed');
    return NextResponse.json(
      { error: 'Normalization failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

async function normalizeTeam(
  sb: ReturnType<typeof supabaseServer>,
  query: string,
  sport?: string
): Promise<NormalizedResult> {
  // Build query for teams
  let dbQuery = sb
    .from('teams')
    .select('id, name, abbr, sport, team_uuid')
    .order('name');

  if (sport) {
    dbQuery = dbQuery.eq('sport', sport.toUpperCase());
  }

  const { data: allTeams, error } = await dbQuery;

  if (error || !allTeams) {
    log.error({ error: error?.message }, 'Failed to fetch teams for normalization');
    return { found: false, canonical: null, id: null, confidence: 0, alternatives: [] };
  }

  // Score each team against the query
  const scoredTeams = (allTeams as any[]).map(team => {
    const nameLower = team.name?.toLowerCase() || '';
    const abbrLower = team.abbr?.toLowerCase() || '';

    let score = 0;

    // Exact match on name
    if (nameLower === query) {
      score = 100;
    }
    // Exact match on abbreviation
    else if (abbrLower === query) {
      score = 95;
    }
    // Name contains query as a word
    else if (nameLower.split(/\s+/).includes(query)) {
      score = 90;
    }
    // Name starts with query
    else if (nameLower.startsWith(query)) {
      score = 85;
    }
    // Name contains query
    else if (nameLower.includes(query)) {
      score = 75;
    }
    // Abbreviation contains query
    else if (abbrLower.includes(query)) {
      score = 70;
    }
    // Query contains name word (e.g., "boston celtics" contains "celtics")
    else if (query.includes(nameLower.split(/\s+/).pop() || '')) {
      score = 65;
    }

    return { ...team, score };
  }).filter(t => t.score > 0);

  // Sort by score descending
  scoredTeams.sort((a, b) => b.score - a.score);

  if (scoredTeams.length === 0) {
    return { found: false, canonical: null, id: null, confidence: 0, alternatives: [] };
  }

  const best = scoredTeams[0];
  const alternatives = scoredTeams.slice(1, 4).map(t => ({
    name: t.name,
    id: t.id,
    score: t.score,
  }));

  return {
    found: true,
    canonical: best.name,
    id: best.team_uuid || best.id,
    confidence: best.score / 100,
    alternatives,
  };
}

async function normalizePlayer(
  sb: ReturnType<typeof supabaseServer>,
  query: string,
  sport?: string,
  team?: string
): Promise<NormalizedResult> {
  // Query players from raw_props (which has player_name + team)
  let dbQuery = sb
    .from('raw_props')
    .select('player_name, team, sport')
    .not('player_name', 'is', null)
    .ilike('player_name', `%${query}%`)
    .limit(50);

  if (sport) {
    dbQuery = dbQuery.eq('sport', sport.toUpperCase());
  }

  const { data: props, error } = await dbQuery;

  if (error || !props) {
    log.error({ error: error?.message }, 'Failed to fetch players for normalization');
    return { found: false, canonical: null, id: null, confidence: 0, alternatives: [] };
  }

  // Deduplicate by player_name + team
  const playerMap = new Map<string, { name: string; team: string; sport: string }>();
  for (const prop of props as any[]) {
    if (prop.player_name) {
      const key = `${prop.player_name}|${prop.team || ''}`;
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          name: prop.player_name,
          team: prop.team || '',
          sport: prop.sport || '',
        });
      }
    }
  }

  const players = Array.from(playerMap.values());

  // Score each player
  const scoredPlayers = players.map(player => {
    const nameLower = player.name.toLowerCase();
    const teamLower = player.team?.toLowerCase() || '';

    let score = 0;

    // Exact match
    if (nameLower === query) {
      score = 100;
    }
    // Name starts with query
    else if (nameLower.startsWith(query)) {
      score = 90;
    }
    // Last name matches
    else if (nameLower.split(/\s+/).pop() === query) {
      score = 85;
    }
    // First name matches
    else if (nameLower.split(/\s+/)[0] === query) {
      score = 80;
    }
    // Name contains query
    else if (nameLower.includes(query)) {
      score = 70;
    }

    // V1.1 COMPLIANCE: If team specified, boost matches and penalize mismatches
    if (team) {
      const teamQueryLower = team.toLowerCase();
      if (teamLower.includes(teamQueryLower) || teamQueryLower.includes(teamLower)) {
        score += 10; // Boost for team match
      } else if (score > 0) {
        score -= 20; // Penalize team mismatch (but don't go negative)
        if (score < 0) score = 0;
      }
    }

    return { ...player, score };
  }).filter(p => p.score > 0);

  // Sort by score descending
  scoredPlayers.sort((a, b) => b.score - a.score);

  if (scoredPlayers.length === 0) {
    return { found: false, canonical: null, id: null, confidence: 0, alternatives: [] };
  }

  const best = scoredPlayers[0];
  const alternatives = scoredPlayers.slice(1, 4).map(p => ({
    name: `${p.name} (${p.team})`,
    id: p.name, // Use name as ID for now
    score: p.score,
  }));

  return {
    found: true,
    canonical: best.name,
    id: best.name, // Players don't have UUIDs in raw_props currently
    confidence: best.score / 100,
    alternatives,
  };
}
