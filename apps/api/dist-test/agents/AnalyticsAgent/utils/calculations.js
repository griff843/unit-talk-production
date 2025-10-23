"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateROI = calculateROI;
exports.calculateTrend = calculateTrend;
exports.calculatePerformance = calculatePerformance;
function calculateROI(picks) {
    const wins = picks.filter(p => p.result === 'win').length;
    const volume = picks.reduce((sum, p) => sum + p.stake, 0);
    const profit = picks.reduce((sum, p) => sum + (p.result === 'win' ? p.payout - p.stake : -p.stake), 0);
    return {
        capper_id: picks[0]?.capper_id,
        timeframe_days: 0, // Set by caller
        total_picks: picks.length,
        wins,
        losses: picks.length - wins,
        win_rate: picks.length > 0 ? wins / picks.length : 0,
        roi: volume > 0 ? (profit / volume) * 100 : 0,
        volume,
        avg_odds: picks.reduce((sum, p) => sum + p.odds, 0) / picks.length,
        profit_loss: profit,
        analyzed_at: new Date().toISOString()
    };
}
function calculateTrend(picks) {
    const values = picks.map(p => p.actual_value);
    const direction = determineTrendDirection(values);
    const volatility = calculateVolatility(values);
    const avgPerformance = values.reduce((a, b) => a + b, 0) / values.length;
    return {
        player_id: picks[0]?.player_id,
        stat_type: picks[0]?.stat_type,
        trend_direction: direction,
        streak_length: calculateStreakLength(values),
        avg_performance: avgPerformance,
        edge_volatility: volatility,
        confidence: calculateConfidence(values.length, volatility),
        analyzed_at: new Date().toISOString()
    };
}
function calculatePerformance(roiAnalysis, statTypePerformance) {
    const statTypes = Object.entries(statTypePerformance);
    const [bestStat] = statTypes.reduce((a, b) => (a[1].wins / a[1].total) > (b[1].wins / b[1].total) ? a : b);
    const [worstStat] = statTypes.reduce((a, b) => (a[1].wins / a[1].total) < (b[1].wins / b[1].total) ? a : b);
    return {
        capper_id: roiAnalysis.capper_id,
        tier: '', // Set by caller
        ticket_type: '', // Set by caller
        total_volume: roiAnalysis.volume,
        win_rate: roiAnalysis.win_rate,
        roi: roiAnalysis.roi,
        best_stat_type: bestStat,
        worst_stat_type: worstStat,
        streak_info: {
            current_streak: 0, // Set by caller
            longest_win_streak: 0, // Set by caller
            longest_loss_streak: 0 // Set by caller
        },
        analyzed_at: new Date().toISOString()
    };
}
function determineTrendDirection(values) {
    let ups = 0;
    let downs = 0;
    for (let i = 1; i < values.length; i++) {
        const current = values[i];
        const previous = values[i - 1];
        if (current !== undefined && previous !== undefined) {
            if (current > previous) {
                ups++;
            }
            else if (current < previous) {
                downs++;
            }
        }
    }
    if (ups > downs * 1.5) {
        return 'up';
    }
    if (downs > ups * 1.5) {
        return 'down';
    }
    return 'neutral';
}
function calculateVolatility(values) {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}
function calculateStreakLength(values) {
    if (values.length < 2) {
        return 0;
    }
    let streak = 1;
    const first = values[0];
    const second = values[1];
    if (first === undefined || second === undefined) {
        return 0;
    }
    const direction = second > first;
    for (let i = 2; i < values.length; i++) {
        const current = values[i];
        const previous = values[i - 1];
        if (current !== undefined && previous !== undefined) {
            if ((current > previous) === direction) {
                streak++;
            }
            else {
                break;
            }
        }
        else {
            break;
        }
    }
    return streak;
}
function calculateConfidence(streakLength, volatility) {
    return Math.min((streakLength * 10) / (volatility + 1), 100);
}
