/**
 * Cappers API Routes — Capper performance stats for Command Center
 *
 * SPRINT-075-LAYER3-PHASE10-CC-CAPPER-DASHBOARD
 */

import express, { Router } from 'express';

import { supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('CapperRouter');
const router: Router = express.Router();

router.use((_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache' });
  next();
});

/**
 * GET /api/cappers
 *
 * Returns per-capper rolling performance stats.
 * Queries mv_capper_daily_rollup (aggregated daily stats) and
 * v_capper_streaks (current streak), then joins against users table.
 *
 * Query params:
 *   ?window=10       rolling window in days (default 10)
 *   ?capper_id=<id>  optional: filter to a single capper
 */
router.get('/', async (req, res) => {
  const correlationId = `cappers-${Date.now()}`;

  try {
    const { capper_id, window: windowParam = '10' } = req.query;
    const windowDays = Math.max(1, Math.min(90, parseInt(String(windowParam), 10) || 10));

    logger.info('Fetching capper performance', { correlationId, windowDays, capper_id });

    // 1. Fetch active cappers
    let cappersQuery = supabaseClient
      .from('users')
      .select('id, username, active, tier, capper_tier')
      .eq('role', 'capper')
      .eq('active', true)
      .order('username', { ascending: true });

    if (capper_id && typeof capper_id === 'string') {
      cappersQuery = cappersQuery.eq('id', capper_id);
    }

    const { data: cappers, error: cappersError } = await cappersQuery;
    if (cappersError) throw new Error(`Cappers query failed: ${cappersError.message}`);

    const capperIds = (cappers || []).map((c: { id: string }) => c.id);

    // 2. Fetch rolling window rollups from materialized view
    let rollupsQuery = supabaseClient
      .from('mv_capper_daily_rollup')
      .select('capper_id, day, picks, wins, losses, pushes, units_wagered, units_profit, roi')
      .order('day', { ascending: false })
      .limit(windowDays * Math.max(capperIds.length, 1));

    if (capper_id && typeof capper_id === 'string') {
      rollupsQuery = rollupsQuery.eq('capper_id', capper_id);
    } else if (capperIds.length > 0) {
      rollupsQuery = rollupsQuery.in('capper_id', capperIds);
    }

    const { data: rollups } = await rollupsQuery;

    // 3. Fetch current streaks
    let streaksQuery = supabaseClient
      .from('v_capper_streaks')
      .select('capper_id, current_streak_type, current_streak_len');

    if (capper_id && typeof capper_id === 'string') {
      streaksQuery = streaksQuery.eq('capper_id', capper_id);
    } else if (capperIds.length > 0) {
      streaksQuery = streaksQuery.in('capper_id', capperIds);
    }

    const { data: streaks } = await streaksQuery;

    // 4. Aggregate per capper
    const rollupsArr = rollups || [];
    const streaksArr = streaks || [];

    const summaries = (cappers || []).map(
      (capper: {
        id: string;
        username: string;
        tier: string;
        capper_tier: string;
        active: boolean;
      }) => {
        const capperRollups = rollupsArr.filter(
          (r: { capper_id: string }) => r.capper_id === capper.id
        );
        const capperStreak = streaksArr.find(
          (s: { capper_id: string }) => s.capper_id === capper.id
        );

        const picks = capperRollups.reduce(
          (s: number, r: { picks: number }) => s + (r.picks || 0),
          0
        );
        const wins = capperRollups.reduce((s: number, r: { wins: number }) => s + (r.wins || 0), 0);
        const losses = capperRollups.reduce(
          (s: number, r: { losses: number }) => s + (r.losses || 0),
          0
        );
        const pushes = capperRollups.reduce(
          (s: number, r: { pushes: number }) => s + (r.pushes || 0),
          0
        );
        const unitsWagered = capperRollups.reduce(
          (s: number, r: { units_wagered: string }) => s + parseFloat(r.units_wagered || '0'),
          0
        );
        const unitsProfit = capperRollups.reduce(
          (s: number, r: { units_profit: string }) => s + parseFloat(r.units_profit || '0'),
          0
        );
        const decidedPicks = picks - pushes;
        const winRate = decidedPicks > 0 ? Math.round((wins / decidedPicks) * 1000) / 10 : 0;
        const roi = unitsWagered > 0 ? Math.round((unitsProfit / unitsWagered) * 1000) / 10 : 0;

        return {
          capper_id: capper.id,
          username: capper.username,
          tier: capper.capper_tier || capper.tier || 'C',
          active: capper.active,
          rolling_window_days: windowDays,
          stats: {
            picks,
            wins,
            losses,
            pushes,
            units_wagered: Math.round(unitsWagered * 100) / 100,
            units_profit: Math.round(unitsProfit * 100) / 100,
            win_rate: winRate,
            roi,
          },
          streak: capperStreak
            ? { type: capperStreak.current_streak_type, length: capperStreak.current_streak_len }
            : null,
        };
      }
    );

    logger.info('Capper performance fetched', { correlationId, count: summaries.length });

    res.json({
      success: true,
      data: summaries,
      metadata: {
        count: summaries.length,
        window_days: windowDays,
        timestamp: new Date().toISOString(),
        correlationId,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch capper performance', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch capper performance',
      details: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
