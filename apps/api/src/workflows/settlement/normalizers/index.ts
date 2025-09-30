import { createLogger } from '../../../utils/logger';

const logger = createLogger('MarketNormalizer');

/**
 * Normalize market values from raw player stats to standardized format
 * @param league The league/sport (MLB, NFL, NBA, etc.)
 * @param market The market type (e.g., 'total_bases', 'passing_yards')
 * @param playerStats Raw player statistics from adapter
 * @returns Normalized stat value or null if unknown
 */
export function normalizeMarket(
  league: string,
  market: string,
  playerStats: Record<string, number>
): number | null {
  const normalizer = getNormalizer(league);
  if (!normalizer) {
    logger.warn('No normalizer found for league', { league });
    return null;
  }

  return normalizer(market, playerStats);
}

function getNormalizer(league: string): ((market: string, stats: Record<string, number>) => number | null) | null {
  switch (league.toUpperCase()) {
    case 'MLB':
      return normalizeMLB;
    case 'NFL':
      return normalizeNFL;
    case 'NBA':
      return normalizeNBA;
    case 'NCAAF':
      return normalizeNCAA;
    case 'NCAAB':
      return normalizeNCAA;
    case 'WNBA':
      return normalizeWNBA;
    default:
      return null;
  }
}

function normalizeMLB(market: string, stats: Record<string, number>): number | null {
  const marketUpper = market.toUpperCase().replace(/[\s_-]/g, '');
  
  switch (marketUpper) {
    // Batting markets
    case 'TOTALBASES':
    case 'TB':
      return stats.TB ?? null;
    case 'HITS':
    case 'H':
      return stats.H ?? null;
    case 'HOMERUNS':
    case 'HR':
    case 'HOMERS':
      return stats.HR ?? null;
    case 'RUNS':
    case 'R':
    case 'RUNSSCORED':
      return stats.R ?? null;
    case 'RBI':
    case 'RBIS':
    case 'RUNSBATTEDIN':
      return stats.RBI ?? null;
    case 'WALKS':
    case 'BB':
    case 'BASEONBALLS':
      return stats.BB ?? null;
    case 'STRIKEOUTS':
    case 'SO':
    case 'KS':
      return stats.SO ?? null;
    case 'STOLENBASES':
    case 'SB':
      return stats.SB ?? null;
    case 'DOUBLES':
    case '2B':
      return stats['2B'] ?? null;
    case 'TRIPLES':
    case '3B':
      return stats['3B'] ?? null;
    case 'HITSRUNSRBIS':
    case 'H+R+RBI':
      return (stats.H ?? 0) + (stats.R ?? 0) + (stats.RBI ?? 0);
      
    // Pitching markets
    case 'PITCHINGOUTS':
    case 'OUTS':
      return stats.OUTS ?? null;
    case 'EARNEDRUNSALLOWED':
    case 'ER':
      return stats.ER ?? null;
    case 'PITCHINGSTRIKEOUTS':
    case 'K':
    case 'PITCHERK':
      return stats.K ?? null;
    case 'WALKSALLOWED':
    case 'BBALLOWED':
      return stats.BB_ALLOWED ?? null;
    case 'HITSALLOWED':
    case 'HALLOWED':
      return stats.H_ALLOWED ?? null;
    case 'PITCHES':
    case 'PITCHESTHROWN':
      return stats.PITCHES ?? null;
      
    default:
      logger.warn('Unknown MLB market', { market });
      return null;
  }
}

function normalizeNFL(market: string, stats: Record<string, number>): number | null {
  const marketUpper = market.toUpperCase().replace(/[\s_-]/g, '');
  
  switch (marketUpper) {
    // Passing markets
    case 'PASSINGYARDS':
    case 'PASSYDS':
    case 'PASSYARDS':
      return stats.PASS_YDS ?? null;
    case 'PASSINGTOUCHDOWNS':
    case 'PASSTD':
    case 'PASSTDS':
      return stats.PASS_TD ?? null;
    case 'INTERCEPTIONS':
    case 'INT':
    case 'PASSINT':
      return stats.PASS_INT ?? null;
    case 'COMPLETIONS':
    case 'PASSCOMP':
      return stats.PASS_COMP ?? null;
    case 'ATTEMPTS':
    case 'PASSATT':
      return stats.PASS_ATT ?? null;
      
    // Rushing markets
    case 'RUSHINGYARDS':
    case 'RUSHYDS':
    case 'RUSHYARDS':
      return stats.RUSH_YDS ?? null;
    case 'RUSHINGTOUCHDOWNS':
    case 'RUSHTD':
    case 'RUSHTDS':
      return stats.RUSH_TD ?? null;
    case 'RUSHATTEMPTS':
    case 'CARRIES':
    case 'RUSHATT':
      return stats.RUSH_ATT ?? null;
      
    // Receiving markets
    case 'RECEIVINGYARDS':
    case 'RECYDS':
    case 'RECYARDS':
      return stats.REC_YDS ?? null;
    case 'RECEPTIONS':
    case 'REC':
    case 'CATCHES':
      return stats.REC ?? null;
    case 'RECEIVINGTOUCHDOWNS':
    case 'RECTD':
    case 'RECTDS':
      return stats.REC_TD ?? null;
    case 'TARGETS':
      return stats.TARGETS ?? null;
      
    // Combined markets
    case 'TOTALYARDS':
    case 'ALLYARDS':
      return stats.TOTAL_YDS ?? null;
    case 'TOTALTOUCHDOWNS':
    case 'ALLTOUCHDOWNS':
    case 'ANYTIMETD':
      return stats.TOTAL_TD ?? null;
    case 'RUSHRECYARDS':
    case 'RUSH+RECYARDS':
      return (stats.RUSH_YDS ?? 0) + (stats.REC_YDS ?? 0);
      
    // Defensive markets
    case 'TACKLES':
    case 'TOTALTACKLES':
      return stats.TACKLES ?? null;
    case 'SACKS':
      return stats.SACKS ?? null;
    case 'TACKLESFORLOSS':
    case 'TFL':
      return stats.TFL ?? null;
    case 'QBHITS':
      return stats.QB_HITS ?? null;
      
    // Kicking markets
    case 'FIELDGOALSMADE':
    case 'FGMADE':
      return stats.FG_MADE ?? null;
    case 'EXTRAPOINTSMADE':
    case 'XPMADE':
      return stats.XP_MADE ?? null;
    case 'KICKINGPOINTS':
    case 'KICKPTS':
      return stats.KICK_PTS ?? null;
      
    default:
      logger.warn('Unknown NFL market', { market });
      return null;
  }
}

function normalizeNBA(market: string, stats: Record<string, number>): number | null {
  const marketUpper = market.toUpperCase().replace(/[\s_-]/g, '');
  
  switch (marketUpper) {
    // Basic stats
    case 'POINTS':
    case 'PTS':
      return stats.PTS ?? null;
    case 'REBOUNDS':
    case 'REB':
    case 'TOTALREBOUNDS':
      return stats.REB ?? null;
    case 'ASSISTS':
    case 'AST':
      return stats.AST ?? null;
    case 'STEALS':
    case 'STL':
      return stats.STL ?? null;
    case 'BLOCKS':
    case 'BLK':
      return stats.BLK ?? null;
    case 'TURNOVERS':
    case 'TO':
      return stats.TO ?? null;
      
    // Shooting stats
    case '3POINTERSMADE':
    case '3PM':
    case 'THREES':
    case 'THREESMADE':
      return stats['3PM'] ?? null;
    case '3POINTERSATTEMPTED':
    case '3PA':
      return stats['3PA'] ?? null;
    case 'FIELDGOALSMADE':
    case 'FGM':
      return stats.FGM ?? null;
    case 'FIELDGOALSATTEMPTED':
    case 'FGA':
      return stats.FGA ?? null;
    case 'FREETHROWSMADE':
    case 'FTM':
      return stats.FTM ?? null;
    case 'FREETHROWSATTEMPTED':
    case 'FTA':
      return stats.FTA ?? null;
      
    // Combined stats
    case 'POINTSREBOUNDS':
    case 'PTS+REB':
    case 'POINTSANDREBOUNDS':
      return stats['PTS+REB'] ?? null;
    case 'POINTSASSISTS':
    case 'PTS+AST':
    case 'POINTSANDASSISTS':
      return stats['PTS+AST'] ?? null;
    case 'REBOUNDSASSISTS':
    case 'REB+AST':
    case 'REBOUNDSANDASSISTS':
      return stats['REB+AST'] ?? null;
    case 'POINTSREBOUNDSASSISTS':
    case 'PTS+REB+AST':
    case 'PRA':
      return stats['PTS+REB+AST'] ?? null;
    case 'STEALSBLOCKS':
    case 'STL+BLK':
    case 'STOCKSS':
      return stats['STL+BLK'] ?? null;
      
    // Special markets
    case 'DOUBLEDOUBLE':
      return stats.DOUBLE_DOUBLE ?? null;
    case 'TRIPLEDOUBLE':
      return stats.TRIPLE_DOUBLE ?? null;
    case 'MINUTES':
    case 'MIN':
      return stats.MIN ?? null;
      
    default:
      logger.warn('Unknown NBA market', { market });
      return null;
  }
}

function normalizeNCAA(market: string, stats: Record<string, number>): number | null {
  // NCAA uses same stat structure as NFL/NBA
  const marketUpper = market.toUpperCase().replace(/[\s_-]/g, '');
  
  // Check if it's a basketball market (typically has NBA-style stats)
  const basketballMarkets = ['POINTS', 'PTS', 'REBOUNDS', 'REB', 'ASSISTS', 'AST', '3PM', 'THREES'];
  if (basketballMarkets.some(m => marketUpper.includes(m))) {
    return normalizeNBA(market, stats);
  }
  
  // Otherwise treat as football
  return normalizeNFL(market, stats);
}

function normalizeWNBA(market: string, stats: Record<string, number>): number | null {
  // WNBA uses same stat structure as NBA
  return normalizeNBA(market, stats);
}

/**
 * Get all supported markets for a league
 */
export function getSupportedMarkets(league: string): string[] {
  switch (league.toUpperCase()) {
    case 'MLB':
      return [
        'total_bases', 'hits', 'home_runs', 'runs', 'rbis', 'walks',
        'strikeouts', 'stolen_bases', 'pitching_outs', 'earned_runs',
        'pitching_strikeouts', 'hits_allowed'
      ];
    case 'NFL':
      return [
        'passing_yards', 'passing_touchdowns', 'interceptions',
        'rushing_yards', 'rushing_touchdowns', 'receiving_yards',
        'receptions', 'receiving_touchdowns', 'total_yards',
        'total_touchdowns', 'tackles', 'sacks'
      ];
    case 'NBA':
    case 'WNBA':
      return [
        'points', 'rebounds', 'assists', 'steals', 'blocks',
        'turnovers', '3_pointers_made', 'points_rebounds',
        'points_assists', 'rebounds_assists', 'points_rebounds_assists'
      ];
    case 'NCAAF':
      return [
        'passing_yards', 'rushing_yards', 'receiving_yards',
        'total_touchdowns', 'receptions'
      ];
    case 'NCAAB':
      return [
        'points', 'rebounds', 'assists', '3_pointers_made',
        'points_rebounds_assists'
      ];
    default:
      return [];
  }
}