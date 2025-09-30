import { proxyActivities, log } from '@temporalio/workflow';

export interface BackfillSportsGameOddsInput {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  sports?: string[]; // Optional: override default sports
}

export interface BackfillProgress {
  sport: string;
  currentDate: string;
  gamesProcessed: number;
  propsProcessed: number;
  errors: string[];
}

export interface SGOEvent {
  id: string;
  sport: string;
  date: string;
  teams: {
    home: { name: string; id?: string };
    away: { name: string; id?: string };
  };
  startTime: string;
  status: string;
  odds?: any[];
  props?: any[];
}

// Activity type definitions
const activities = proxyActivities<{
  fetchSGOEventsForDay(params: {
    sport: string;
    date: string;
    apiKey: string;
  }): Promise<SGOEvent[]>;

  insertGamesFromEvents(params: {
    events: SGOEvent[];
    sport: string;
    date: string;
  }): Promise<number>;

  insertPropsFromEvents(params: {
    events: SGOEvent[];
    sport: string;
    date: string;
  }): Promise<number>;

  checkExistingData(params: {
    sport: string;
    date: string;
  }): Promise<{ gamesExist: boolean; propsExist: boolean }>;
}>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 2.0,
    initialInterval: '30 seconds',
  },
});

/**
 * Production-grade SGO Backfill Workflow for 2025
 *
 * This workflow processes historical sports data from SportsGameOdds API
 * using the validated v1 endpoints with daily iteration approach.
 *
 * Features:
 * - Idempotent processing with duplicate detection
 * - Daily batching for safe concurrency
 * - Resumable with Temporal retries
 * - Comprehensive logging for monitoring
 * - Windows-safe implementation
 */
export async function BackfillSportsGameOdds(input: BackfillSportsGameOddsInput): Promise<BackfillProgress[]> {
    const { startDate, endDate } = input;
    const sports = input.sports || ['mlb', 'nba', 'nfl', 'ncaaf', 'ncaab', 'wnba', 'nhl'];

    log.info('🚀 Starting SGO Backfill Workflow', {
      startDate,
      endDate,
      sports: sports.length,
      workflowId: 'backfill-sgo-2025-all-sports'
    });

    const results: BackfillProgress[] = [];

    // Process each sport sequentially to manage API rate limits
    for (const sport of sports) {
      log.info(`🏀 Processing sport: ${sport}`, { sport });

      const sportProgress: BackfillProgress = {
        sport,
        currentDate: startDate,
        gamesProcessed: 0,
        propsProcessed: 0,
        errors: []
      };

      try {
        // Generate daily date range
        const dates = generateDailyDateRange(startDate, endDate);
        log.info(`📅 Processing ${dates.length} days for ${sport}`, {
          sport,
          dateCount: dates.length,
          firstDate: dates[0],
          lastDate: dates[dates.length - 1]
        });

        // Process each day individually for safe batching
        for (const date of dates) {
          sportProgress.currentDate = date;

          try {
            // Check if data already exists (idempotent processing)
            const existingData = await activities.checkExistingData({
              sport,
              date
            });

            if (existingData.gamesExist && existingData.propsExist) {
              log.info(`⏭️  Skipping ${sport} ${date} - data already exists`, {
                sport,
                date,
                gamesExist: existingData.gamesExist,
                propsExist: existingData.propsExist
              });
              continue;
            }

            log.info(`📡 Fetching SGO data for ${sport} ${date}`, { sport, date });

            // Fetch events from SGO v1 API with validated endpoint
            const events = await activities.fetchSGOEventsForDay({
              sport,
              date,
              apiKey: process.env['SPORTSGAMEODDS_KEY'] || ''
            });

            if (!events || events.length === 0) {
              log.info(`📋 No events found for ${sport} ${date}`, { sport, date });
              continue;
            }

            log.info(`✅ Found ${events.length} events for ${sport} ${date}`, {
              sport,
              date,
              eventCount: events.length
            });

            // Insert games into games table
            const gamesInserted = await activities.insertGamesFromEvents({
              events,
              sport,
              date
            });

            sportProgress.gamesProcessed += gamesInserted;

            // Insert props into raw_props table
            const propsInserted = await activities.insertPropsFromEvents({
              events,
              sport,
              date
            });

            sportProgress.propsProcessed += propsInserted;

            log.info(`💾 Inserted data for ${sport} ${date}`, {
              sport,
              date,
              gamesInserted,
              propsInserted,
              totalGames: sportProgress.gamesProcessed,
              totalProps: sportProgress.propsProcessed
            });

            // Rate limiting between days (important for API stability)
            if (dates.indexOf(date) < dates.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }

          } catch (dayError: any) {
            const errorMsg = `Error processing ${sport} ${date}: ${dayError.message}`;
            log.error(errorMsg, { sport, date, error: dayError.message });
            sportProgress.errors.push(errorMsg);

            // Continue with next day rather than failing entire sport
            continue;
          }
        }

        log.info(`✅ Completed ${sport} backfill`, {
          sport,
          gamesProcessed: sportProgress.gamesProcessed,
          propsProcessed: sportProgress.propsProcessed,
          errorCount: sportProgress.errors.length
        });

      } catch (sportError: any) {
        const errorMsg = `Failed to process sport ${sport}: ${sportError.message}`;
        log.error(errorMsg, { sport, error: sportError.message });
        sportProgress.errors.push(errorMsg);
      }

      results.push(sportProgress);

      // Rate limiting between sports
      if (sports.indexOf(sport) < sports.length - 1) {
        log.info(`⏱️  Rate limiting delay before next sport...`, {
          currentSport: sport,
          nextSport: sports[sports.indexOf(sport) + 1]
        });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Final summary
    const totalGames = results.reduce((sum, r) => sum + r.gamesProcessed, 0);
    const totalProps = results.reduce((sum, r) => sum + r.propsProcessed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    log.info('🎯 SGO Backfill Workflow Complete!', {
      sportsProcessed: results.length,
      totalGames,
      totalProps,
      totalErrors,
      workflowId: 'backfill-sgo-2025-all-sports'
    });

    return results;
}

/**
 * Generate array of daily dates between start and end (inclusive)
 */
function generateDailyDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (dateStr) dates.push(dateStr); // YYYY-MM-DD format
  }

  return dates;
}