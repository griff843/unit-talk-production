"use strict";
/**
 * Utility functions for recap formatting and calculations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatUnits = formatUnits;
exports.formatROI = formatROI;
exports.formatWinRate = formatWinRate;
exports.getStreakEmoji = getStreakEmoji;
exports.getTierEmoji = getTierEmoji;
exports.getOutcomeEmoji = getOutcomeEmoji;
exports.calculateHotStreakEmoji = calculateHotStreakEmoji;
exports.formatOdds = formatOdds;
exports.calculateImpliedProbability = calculateImpliedProbability;
exports.formatMarketType = formatMarketType;
exports.getCapperDisplayName = getCapperDisplayName;
exports.calculateStreak = calculateStreak;
exports.formatPickDescription = formatPickDescription;
exports.calculateParlayOdds = calculateParlayOdds;
exports.formatParlayOdds = formatParlayOdds;
exports.getDateRangeLabel = getDateRangeLabel;
exports.calculateProfitDollars = calculateProfitDollars;
exports.getPerformanceColor = getPerformanceColor;
exports.truncateText = truncateText;
exports.groupPicksByParlay = groupPicksByParlay;
exports.calculateWinRate = calculateWinRate;
exports.calculateROI = calculateROI;
exports.formatNumber = formatNumber;
exports.getTimePeriodLabel = getTimePeriodLabel;
exports.validatePickData = validatePickData;
exports.sortCappersByPerformance = sortCappersByPerformance;
exports.getMedalEmoji = getMedalEmoji;
exports.calculateAverageEdge = calculateAverageEdge;
/**
 * Format units with proper decimal places and sign
 */
function formatUnits(units) {
    const formatted = Math.abs(units).toFixed(1);
    if (units > 0) {
        return `+${formatted}`;
    }
    else if (units < 0) {
        return `-${formatted}`;
    }
    return formatted;
}
/**
 * Format ROI as percentage
 */
function formatROI(roi) {
    const formatted = Math.abs(roi).toFixed(1);
    if (roi > 0) {
        return `+${formatted}%`;
    }
    else if (roi < 0) {
        return `-${formatted}%`;
    }
    return `${formatted}%`;
}
/**
 * Format win rate as percentage
 */
function formatWinRate(winRate) {
    return `${winRate.toFixed(1)}%`;
}
/**
 * Get streak emoji based on streak length
 */
function getStreakEmoji(wins, losses) {
    const streakLength = Math.max(wins, losses);
    if (wins > losses) {
        // Win streak
        if (streakLength >= 5) {
            return '🔥🔥';
        }
        if (streakLength >= 3) {
            return '🔥';
        }
        if (streakLength >= 2) {
            return '📈';
        }
        return '✅';
    }
    else if (losses > wins) {
        // Loss streak
        if (streakLength >= 3) {
            return '❄️';
        }
        return '❌';
    }
    return '🟡'; // Even or no clear streak
}
/**
 * Get tier emoji
 */
function getTierEmoji(tier) {
    const tierEmojis = {
        'S': '💎',
        'A+': '🔥',
        'A': '⭐',
        'B': '📊',
        'C': '📈',
        'Parlay': '🎰'
    };
    return tierEmojis[tier] || '📊';
}
/**
 * Get outcome emoji
 */
function getOutcomeEmoji(outcome) {
    switch (outcome) {
        case 'win':
            return '✅';
        case 'loss':
            return '❌';
        case 'push':
            return '🟡';
        case 'pending':
            return '⏳';
        default:
            return '❓';
    }
}
/**
 * Calculate hot streak level and emoji
 */
function calculateHotStreakEmoji(streakLength) {
    if (streakLength >= 7) {
        return '🔥🔥🔥';
    }
    if (streakLength >= 5) {
        return '🔥🔥';
    }
    if (streakLength >= 3) {
        return '🔥';
    }
    return '';
}
/**
 * Format odds display
 */
function formatOdds(odds) {
    if (odds > 0) {
        return `+${odds}`;
    }
    return odds.toString();
}
/**
 * Calculate implied probability from odds
 */
function calculateImpliedProbability(odds) {
    if (odds > 0) {
        return 100 / (odds + 100);
    }
    else {
        return Math.abs(odds) / (Math.abs(odds) + 100);
    }
}
/**
 * Format market type for display
 */
function formatMarketType(marketType) {
    const marketMap = {
        'points': 'PTS',
        'rebounds': 'REB',
        'assists': 'AST',
        'player_props': 'Props',
        'spread': 'Spread',
        'total': 'O/U',
        'moneyline': 'ML'
    };
    return marketMap[marketType] || marketType.toUpperCase();
}
/**
 * Get capper display name
 */
function getCapperDisplayName(capper) {
    const capperMap = {
        'Unit Talk': 'Unit Talk',
        'Griff': 'Griff',
        'Ace': 'Ace',
        'Maya': 'Maya'
    };
    return capperMap[capper] || capper;
}
/**
 * Calculate streak type and length from recent picks
 */
function calculateStreak(picks) {
    if (picks.length === 0) {
        return { type: 'none', length: 0 };
    }
    // Sort by most recent first
    const sortedPicks = picks
        .filter(p => p.outcome && p.outcome !== 'push' && p.outcome !== 'pending')
        .sort((a, b) => new Date(b.settled_at || b.created_at).getTime() - new Date(a.settled_at || a.created_at).getTime());
    if (sortedPicks.length === 0) {
        return { type: 'none', length: 0 };
    }
    const latestOutcome = sortedPicks[0].outcome;
    let streakLength = 1;
    // Count consecutive outcomes of the same type
    for (let i = 1; i < sortedPicks.length; i++) {
        if (sortedPicks[i].outcome === latestOutcome) {
            streakLength++;
        }
        else {
            break;
        }
    }
    return {
        type: latestOutcome === 'win' ? 'win' : 'loss',
        length: streakLength
    };
}
/**
 * Format pick description for display
 */
function formatPickDescription(pick) {
    const playerOrTeam = pick.player_name || pick.team_name || 'Unknown';
    const market = formatMarketType(pick.market_type);
    const line = pick.line;
    const odds = formatOdds(pick.odds);
    return `${playerOrTeam} ${market} ${line} (${odds})`;
}
/**
 * Calculate parlay odds from individual picks
 */
function calculateParlayOdds(picks) {
    return picks.reduce((totalOdds, pick) => {
        const decimalOdds = pick.odds > 0 ? (pick.odds / 100) + 1 : (100 / Math.abs(pick.odds)) + 1;
        return totalOdds * decimalOdds;
    }, 1);
}
/**
 * Format parlay odds for display
 */
function formatParlayOdds(totalOdds) {
    if (totalOdds >= 2) {
        return `+${Math.round((totalOdds - 1) * 100)}`;
    }
    else {
        return `-${Math.round(100 / (totalOdds - 1))}`;
    }
}
/**
 * Get date range label
 */
function getDateRangeLabel(startDate, endDate, type) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    switch (type) {
        case 'daily':
            return start.toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        case 'weekly':
            return `${start.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })} — ${end.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}`;
        case 'monthly':
            return start.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long'
            });
        default:
            return startDate;
    }
}
/**
 * Calculate profit in dollars (assuming $100 per unit)
 */
function calculateProfitDollars(netUnits, unitValue = 100) {
    const profit = netUnits * unitValue;
    if (profit >= 0) {
        return `+$${profit.toFixed(0)}`;
    }
    else {
        return `-$${Math.abs(profit).toFixed(0)}`;
    }
}
/**
 * Get performance color based on units
 */
function getPerformanceColor(netUnits) {
    if (netUnits > 5) {
        return 0x00ff00;
    } // Bright green for big wins
    if (netUnits > 0) {
        return 0x90ee90;
    } // Light green for wins
    if (netUnits === 0) {
        return 0xffff00;
    } // Yellow for break-even
    if (netUnits > -5) {
        return 0xffa500;
    } // Orange for small losses
    return 0xff0000; // Red for big losses
}
/**
 * Truncate text to fit Discord embed limits
 */
function truncateText(text, maxLength = 1024) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 3) + '...';
}
/**
 * Group picks by parlay ID
 */
function groupPicksByParlay(picks) {
    const parlayMap = new Map();
    picks.forEach(pick => {
        if (pick.parlay_id) {
            if (!parlayMap.has(pick.parlay_id)) {
                parlayMap.set(pick.parlay_id, []);
            }
            parlayMap.get(pick.parlay_id).push(pick);
        }
    });
    return parlayMap;
}
/**
 * Calculate win rate with proper handling of pushes
 */
// Commented out unused pushes parameter
function calculateWinRate(wins, losses) {
    const totalDecisiveGames = wins + losses;
    if (totalDecisiveGames === 0) {
        return 0;
    }
    return (wins / totalDecisiveGames) * 100;
}
/**
 * Calculate ROI
 */
function calculateROI(netUnits, totalUnits) {
    if (totalUnits === 0) {
        return 0;
    }
    return (netUnits / totalUnits) * 100;
}
/**
 * Format large numbers with commas
 */
function formatNumber(num) {
    return num.toLocaleString();
}
/**
 * Get time period label
 */
function getTimePeriodLabel(type, date) {
    const d = new Date(date);
    switch (type) {
        case 'daily':
            return d.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        case 'weekly':
            return `Week of ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
        case 'monthly':
            return d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long'
            });
        default:
            return date;
    }
}
/**
 * Validate pick data
 */
function validatePickData(pick) {
    return !!(pick &&
        (pick.player_name || pick.team_name) &&
        pick.market_type &&
        typeof pick.line === 'number' &&
        typeof pick.odds === 'number');
}
/**
 * Sort cappers by performance
 */
function sortCappersByPerformance(cappers) {
    return cappers.sort((a, b) => {
        // Primary sort: net units (descending)
        if (b.netUnits !== a.netUnits) {
            return b.netUnits - a.netUnits;
        }
        // Secondary sort: ROI (descending)
        if (b.roi !== a.roi) {
            return b.roi - a.roi;
        }
        // Tertiary sort: win rate (descending)
        return b.winRate - a.winRate;
    });
}
/**
 * Get medal emoji for rankings
 */
function getMedalEmoji(position) {
    switch (position) {
        case 1:
            return '🥇';
        case 2:
            return '🥈';
        case 3:
            return '🥉';
        default:
            return '•';
    }
}
/**
 * Calculate average edge professional_score
 */
function calculateAverageEdge(picks) {
    const validPicks = picks.filter(p => typeof p.edge_score === 'number');
    if (validPicks.length === 0) {
        return 0;
    }
    const totalEdge = validPicks.reduce((sum, pick) => sum + pick.edge_score, 0);
    return totalEdge / validPicks.length;
}
