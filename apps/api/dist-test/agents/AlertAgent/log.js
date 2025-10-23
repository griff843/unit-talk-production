"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAlertRecord = logAlertRecord;
exports.logAlertOutcome = logAlertOutcome;
exports.getAlertPerformanceMetrics = getAlertPerformanceMetrics;
exports.getTopPerformingAdvicePatterns = getTopPerformingAdvicePatterns;
async function logAlertRecord(supabase, pick, advice, processingTimeMs) {
    try {
        const logEntry = {
            bet_id: pick.id,
            player: pick.player_id,
            market: pick.stat_type,
            odds: pick.odds,
            line: pick.line,
            advice_given: advice,
            tier: pick.tier,
            confidence: pick.confidence,
            sport: pick.sport,
            league: pick.league,
            alert_priority: determineAlertPriority(pick),
            ...(processingTimeMs !== undefined && { processing_time_ms: processingTimeMs }),
            created_at: new Date().toISOString(),
        };
        const { error } = await supabase
            .from('unit_talk_alerts_log')
            .insert([logEntry]);
        if (error) {
            console.error('Failed to log alert record:', error);
            throw error;
        }
    }
    catch (error) {
        console.error('Error in logAlertRecord:', error);
        // Don't throw here to prevent alert failures due to logging issues
    }
}
async function logAlertOutcome(supabase, betId, outcome, actualValue, profitLoss, closingLine) {
    try {
        const outcomeEntry = {
            bet_id: betId,
            outcome,
            ...(actualValue !== undefined && { actual_value: actualValue }),
            ...(profitLoss !== undefined && { profit_loss: profitLoss }),
            ...(closingLine !== undefined && { closing_line: closingLine }),
            settled_at: new Date().toISOString(),
        };
        // Add closing_line_value only if it's not undefined
        if (closingLine !== undefined) {
            const closingLineValue = calculateClosingLineValue(closingLine, actualValue);
            if (closingLineValue !== undefined) {
                outcomeEntry.closing_line_value = closingLineValue;
            }
        }
        const { error } = await supabase
            .from('unit_talk_alert_outcomes')
            .insert([outcomeEntry]);
        if (error) {
            console.error('Failed to log alert outcome:', error);
        }
    }
    catch (error) {
        console.error('Error in logAlertOutcome:', error);
    }
}
async function getAlertPerformanceMetrics(supabase, timeframe = 'week') {
    try {
        const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeframeDays);
        const { data: alerts, error } = await supabase
            .from('unit_talk_alerts_log')
            .select(`
        *,
        unit_talk_alert_outcomes (
          outcome,
          profit_loss,
          closing_line_value
        )
      `)
            .gte('created_at', startDate.toISOString());
        if (error) {
            console.error('Failed to fetch alert performance metrics:', error);
            return getEmptyMetrics();
        }
        return calculatePerformanceMetrics(alerts || []);
    }
    catch (error) {
        console.error('Error in getAlertPerformanceMetrics:', error);
        return getEmptyMetrics();
    }
}
async function getTopPerformingAdvicePatterns(supabase, limit = 10) {
    try {
        const { data: alerts, error } = await supabase
            .from('unit_talk_alerts_log')
            .select(`
        advice_given,
        confidence,
        unit_talk_alert_outcomes (
          outcome,
          profit_loss
        )
      `)
            .not('unit_talk_alert_outcomes', 'is', null)
            .limit(1000); // Limit to recent data for performance
        if (error || !alerts) {
            return [];
        }
        const patterns = analyzeAdvicePatterns(alerts);
        return patterns
            .sort((a, b) => b.avgROI - a.avgROI)
            .slice(0, limit);
    }
    catch (error) {
        console.error('Error in getTopPerformingAdvicePatterns:', error);
        return [];
    }
}
function determineAlertPriority(pick) {
    const confidence = pick.confidence || 50;
    const tier = pick.tier;
    if (tier === 'S+' && confidence >= 85) {
        return 'URGENT';
    }
    if (tier === 'S' || (tier === 'A+' && confidence >= 80)) {
        return 'HIGH';
    }
    if (['A+', 'A'].includes(tier)) {
        return 'MEDIUM';
    }
    return 'LOW';
}
function calculateClosingLineValue(closingLine, actualValue) {
    if (!actualValue) {
        return undefined;
    }
    return actualValue - closingLine;
}
function getEmptyMetrics() {
    return {
        totalAlerts: 0,
        winRate: 0,
        avgROI: 0,
        profitLoss: 0,
        byTier: {},
        byAdvice: {},
    };
}
function calculatePerformanceMetrics(alerts) {
    const settledAlerts = alerts.filter(alert => alert.unit_talk_alert_outcomes && alert.unit_talk_alert_outcomes.length > 0);
    if (settledAlerts.length === 0) {
        return getEmptyMetrics();
    }
    const wins = settledAlerts.filter(alert => alert.unit_talk_alert_outcomes[0].outcome === 'win').length;
    const totalProfitLoss = settledAlerts.reduce((sum, alert) => sum + (alert.unit_talk_alert_outcomes[0].profit_loss || 0), 0);
    const winRate = (wins / settledAlerts.length) * 100;
    const avgROI = (totalProfitLoss / settledAlerts.length) * 100;
    // Group by tier
    const byTier = groupAndCalculateMetrics(settledAlerts, 'tier');
    // Group by advice type (extract HOLD/HEDGE/FADE from advice_given)
    const byAdvice = groupAndCalculateMetrics(settledAlerts.map(alert => ({
        ...alert,
        advice_type: extractAdviceType(alert.advice_given)
    })), 'advice_type');
    return {
        totalAlerts: alerts.length,
        winRate,
        avgROI,
        profitLoss: totalProfitLoss,
        byTier,
        byAdvice,
    };
}
function groupAndCalculateMetrics(alerts, groupBy) {
    const groups = alerts.reduce((acc, alert) => {
        const key = alert[groupBy];
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(alert);
        return acc;
    }, {});
    const result = {};
    for (const [key, groupAlerts] of Object.entries(groups)) {
        const wins = groupAlerts.filter((alert) => alert.unit_talk_alert_outcomes[0].outcome === 'win').length;
        const totalPL = groupAlerts.reduce((sum, alert) => sum + (alert.unit_talk_alert_outcomes[0].profit_loss || 0), 0);
        result[key] = {
            count: groupAlerts.length,
            winRate: (wins / groupAlerts.length) * 100,
            roi: (totalPL / groupAlerts.length) * 100,
        };
    }
    return result;
}
function extractAdviceType(advice) {
    const match = advice.match(/^(HOLD|HEDGE|FADE)/i);
    return match?.[1]?.toUpperCase() || 'OTHER';
}
function analyzeAdvicePatterns(alerts) {
    const patterns = {};
    for (const alert of alerts) {
        const pattern = extractAdviceType(alert.advice_given);
        if (!patterns[pattern]) {
            patterns[pattern] = {
                advicePattern: pattern,
                count: 0,
                wins: 0,
                totalPL: 0,
                totalConfidence: 0,
            };
        }
        patterns[pattern].count++;
        patterns[pattern].totalConfidence += alert.confidence || 50;
        if (alert.unit_talk_alert_outcomes && alert.unit_talk_alert_outcomes.length > 0) {
            const outcome = alert.unit_talk_alert_outcomes[0];
            if (outcome.outcome === 'win') {
                patterns[pattern].wins++;
            }
            patterns[pattern].totalPL += outcome.profit_loss || 0;
        }
    }
    return Object.values(patterns).map((pattern) => ({
        advicePattern: pattern.advicePattern,
        count: pattern.count,
        winRate: (pattern.wins / pattern.count) * 100,
        avgROI: (pattern.totalPL / pattern.count) * 100,
        confidence: pattern.totalConfidence / pattern.count,
    }));
}
