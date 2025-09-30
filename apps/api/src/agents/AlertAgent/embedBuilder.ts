import { EmbedBuilder } from 'discord.js';

import { UnifiedPick } from '../../types/picks';

import { getPlayerHeadshotUrl } from './parlayEmbedBuilder';

interface AlertPriority {
  level: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  color: number;
  emoji: string;
}

function getPickTypeEmoji(_marketType: string, isLive: boolean = false): string {
  if (isLive) return '🔴';
  return '📊';
}

function getSystemGradeEmoji(tier: string): string {
  // Enhanced tier emojis for professional system
  if (tier === 'S+') return '🔥'; // Fire for S+ elite
  if (tier === 'S') return '🏆';   // Trophy for S tier
  if (['A+', 'A'].includes(tier)) return '🎯'; // Target for A tier
  if (['B+', 'B'].includes(tier)) return '📈'; // Chart for B tier
  if (tier === 'C') return '⚡';   // Lightning for C tier
  if (tier === 'D') return '📊';   // Chart for D tier
  return '📊'; // Default chart
}

function getAlertPriority(pick: UnifiedPick): AlertPriority {
  const confidence = typeof pick.confidence === 'number' ? pick.confidence : 50;
  const tier = pick.tier;
  
  // Urgent: S+ tier with high confidence
  if (tier === 'S+' && confidence >= 85) {
    return { level: 'URGENT', color: 0xFF0000, emoji: '🚨' };
  }
  
  // High: S tier or high confidence A+
  if (tier === 'S' || (tier === 'A+' && confidence >= 80)) {
    return { level: 'HIGH', color: 0xFF6600, emoji: '⚡' };
  }
  
  // Medium: A tier picks
  if (['A+', 'A'].includes(tier)) {
    return { level: 'MEDIUM', color: 0x00FF99, emoji: '📈' };
  }
  
  // Low: B and C tier
  return { level: 'LOW', color: 0x808080, emoji: '📊' };
}

function formatOdds(odds: number): string {
  if (odds > 0) {return `+${odds}`;}
  return odds.toString();
}


function formatAdvice(advice: string): string {
  // Extract recommendation and reasoning
  const match = advice.match(/^(HOLD|HEDGE|FADE):\s*(.+)$/i);
  if (match) {
    const [, recommendation, reasoning] = match;
    if (recommendation) {
      return `**${recommendation.toUpperCase()}**\n${reasoning || ''}`;
    }
  }
  return advice;
}

export function buildAlertEmbed(pick: UnifiedPick | any, advice: string, playerImageUrl?: string): EmbedBuilder {
  // Check if this is a new alert type (steam, injury, settlement, etc.)
  if (pick.bet_type && ['steam_alert', 'injury_alert', 'settlement_alert', 'line_shopping_alert', 'arbitrage_alert'].includes(pick.bet_type)) {
    return buildAdvancedAlertEmbed(pick, advice);
  }

  // Check if this is an approved pick from Command Center (workflow_stage = 'approved')
  if (pick.workflow_stage === 'approved') {
    return buildProfessionalApprovedEmbed(pick, advice, playerImageUrl);
  }

  // Original pick alert logic
  const priority = getAlertPriority(pick);
  const isLive = pick.market_type === 'live';
  const pickTypeEmoji = getPickTypeEmoji(pick.market_type || 'pregame', isLive);
  const systemGradeEmoji = getSystemGradeEmoji(pick.tier);
  
  // Standardized title format
  const pickType = 'SINGLE'; // Default since ticket_type is not in interface
  const title = `${pickTypeEmoji} ${isLive ? 'LIVE' : 'PREGAME'} • ${pickType} PICK`;
  
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(priority.color)
    .setTimestamp(new Date(pick.created_at));

  // Add player headshot - use provided URL or get from player enrichment
  let headshotUrl = playerImageUrl;
  if (!headshotUrl && pick.player_name) {
    headshotUrl = getPlayerHeadshotUrl('', '', pick.player_name) || undefined;
  }
  
  if (headshotUrl) {
    embed.setThumbnail(headshotUrl);
  }

  // Header info: Capper • League
  const headerInfo = `**${pick.capper || 'System'}** • Unknown League`;
  embed.setDescription(headerInfo);

  // Main pick details - standardized format
  embed.addFields(
    { 
      name: '🎯 Selection', 
      value: `**${pick.player_name || 'Unknown Player'}**${pick.outcome ? `\n${pick.outcome}` : ''}`, 
      inline: false 
    },
    { 
      name: `${systemGradeEmoji} System Grade • 🎯 Units`, 
      value: `**${pick.tier}**-tier • **${pick.units || 1}** ${(pick.units || 1) === 1 ? 'unit' : 'units'}`, 
      inline: true 
    },
    { 
      name: '📈 Line & Odds', 
      value: `**${pick.line || 'N/A'}** @ **${formatOdds(pick.odds || 0)}**`, 
      inline: true 
    }
  );

  // AI Analysis section
  embed.addFields({
    name: '🧠 AI Analysis',
    value: formatAdvice(advice),
    inline: false
  });

  // Metrics section - simplified for all tiers
  const edgeScore = pick.edge_score || 0;
  
  embed.addFields({
    name: '📊 Metrics',
    value: `**Edge Score:** ${edgeScore > 0 ? edgeScore.toFixed(1) + '%' : 'N/A'}`,
    inline: false
  });

  // Footer with branding
  embed.setFooter({ 
    text: 'Unit Talk Intelligence System • Fortune 100 Analytics',
    iconURL: 'https://i.imgur.com/unit-talk-logo.png' // You can add logo URL here
  });

  return embed;
}

// Advanced alert embed builder for new alert types
function buildAdvancedAlertEmbed(alert: any, advice: string): EmbedBuilder {
  const alertType = alert.bet_type;

  switch (alertType) {
    case 'steam_alert':
      return buildSteamAlertEmbed(alert, advice);
    case 'injury_alert':
      return buildInjuryAlertEmbed(alert, advice);
    case 'settlement_alert':
      return buildSettlementAlertEmbed(alert, advice);
    case 'line_shopping_alert':
      return buildLineShoppingAlertEmbed(alert, advice);
    case 'arbitrage_alert':
      return buildArbitrageAlertEmbed(alert, advice);
    default:
      // Fallback to standard alert
      return new EmbedBuilder()
        .setTitle('🔔 System Alert')
        .setColor(0x0099FF)
        .setDescription('Unknown alert type')
        .setTimestamp();
  }
}

// Steam Movement Alert
function buildSteamAlertEmbed(alert: any, advice: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🌊 STEAM MOVEMENT DETECTED')
    .setColor(0xFF6600) // Orange for steam alerts
    .setTimestamp(new Date(alert.created_at));

  // Header info
  embed.setDescription(`**${alert.player_name || 'Player'}** • ${alert.league || 'League'}`);

  // Steam movement details
  embed.addFields(
    {
      name: '🎯 Market & Movement',
      value: `**${alert.market_type || 'Market'}** ${alert.line || 'N/A'}\n**Direction:** ${alert.direction || 'Unknown'}\n**Magnitude:** ${alert.magnitude || 'N/A'}%`,
      inline: true
    },
    {
      name: '📊 Line Movement',
      value: `**From:** ${alert.original_line || 'N/A'} @ ${formatOdds(alert.original_odds || 0)}\n**To:** ${alert.new_line || 'N/A'} @ ${formatOdds(alert.new_odds || 0)}`,
      inline: true
    },
    {
      name: '⚡ Steam Metrics',
      value: `**Volume:** ${alert.volume_indicator || 'N/A'}\n**Speed:** ${alert.movement_speed || 'N/A'}\n**Confidence:** ${alert.confidence_score || 'N/A'}%`,
      inline: false
    }
  );

  // AI Analysis
  if (advice) {
    embed.addFields({
      name: '🧠 Steam Analysis',
      value: formatAdvice(advice),
      inline: false
    });
  }

  embed.setFooter({
    text: 'Unit Talk Steam Detection • Real-time line monitoring',
    iconURL: 'https://i.imgur.com/steam-icon.png'
  });

  return embed;
}

// Injury Impact Alert
function buildInjuryAlertEmbed(alert: any, advice: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🏥 INJURY IMPACT ALERT')
    .setColor(0xFF0000) // Red for injury alerts
    .setTimestamp(new Date(alert.created_at));

  // Header info
  embed.setDescription(`**${alert.player_name || 'Player'}** • ${alert.team || 'Team'} • ${alert.league || 'League'}`);

  // Injury details
  embed.addFields(
    {
      name: '🩹 Injury Details',
      value: `**Type:** ${alert.injury_type || 'Unknown'}\n**Severity:** ${alert.severity || 'N/A'}\n**Status:** ${alert.status || 'Unknown'}`,
      inline: true
    },
    {
      name: '📈 Market Impact',
      value: `**Impact Score:** ${alert.impact_score || 'N/A'}/100\n**Affected Markets:** ${alert.affected_markets || 'N/A'}\n**Expected Return:** ${alert.expected_return_days || 'Unknown'} days`,
      inline: true
    }
  );

  // Related players/props affected
  if (alert.related_props) {
    embed.addFields({
      name: '🎯 Affected Props',
      value: alert.related_props.slice(0, 3).map((prop: any) =>
        `• ${prop.player_name} ${prop.market_type} ${prop.line}`
      ).join('\n') || 'No related props found',
      inline: false
    });
  }

  // AI Analysis
  if (advice) {
    embed.addFields({
      name: '🧠 Injury Analysis',
      value: formatAdvice(advice),
      inline: false
    });
  }

  embed.setFooter({
    text: 'Unit Talk Injury Intelligence • Real-time impact analysis',
    iconURL: 'https://i.imgur.com/injury-icon.png'
  });

  return embed;
}

// Settlement Alert
function buildSettlementAlertEmbed(alert: any, advice: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('✅ SETTLEMENT PROCESSED')
    .setColor(alert.result === 'WIN' ? 0x00FF00 : alert.result === 'LOSS' ? 0xFF0000 : 0x808080)
    .setTimestamp(new Date(alert.created_at));

  // Header info
  embed.setDescription(`**${alert.player_name || 'Player'}** • ${alert.league || 'League'}`);

  // Settlement details
  embed.addFields(
    {
      name: '🎯 Pick Details',
      value: `**Market:** ${alert.market_type || 'N/A'}\n**Line:** ${alert.line || 'N/A'} @ ${formatOdds(alert.odds || 0)}\n**Units:** ${alert.units || 1}`,
      inline: true
    },
    {
      name: '📊 Settlement Result',
      value: `**Outcome:** ${alert.result || 'PENDING'}\n**Actual Value:** ${alert.actual_value || 'N/A'}\n**Settlement Method:** ${alert.settlement_method || 'Auto'}`,
      inline: true
    }
  );

  // Performance impact
  if (alert.performance_impact) {
    embed.addFields({
      name: '📈 Performance Impact',
      value: `**ROI Impact:** ${alert.performance_impact.roi_change || 'N/A'}%\n**Win Rate:** ${alert.performance_impact.win_rate || 'N/A'}%\n**Units P&L:** ${alert.performance_impact.units_change || 'N/A'}`,
      inline: false
    });
  }

  // AI Analysis
  if (advice) {
    embed.addFields({
      name: '🧠 Settlement Analysis',
      value: formatAdvice(advice),
      inline: false
    });
  }

  embed.setFooter({
    text: 'Unit Talk Settlement Engine • Automated resolution',
    iconURL: 'https://i.imgur.com/settlement-icon.png'
  });

  return embed;
}

// Line Shopping Alert
function buildLineShoppingAlertEmbed(alert: any, advice: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🛒 BEST LINE OPPORTUNITY')
    .setColor(0x00FF99) // Green for line shopping
    .setTimestamp(new Date(alert.created_at));

  // Header info
  embed.setDescription(`**${alert.player_name || 'Player'}** • ${alert.league || 'League'}`);

  // Line shopping details
  embed.addFields(
    {
      name: '🎯 Market Details',
      value: `**Market:** ${alert.market_type || 'N/A'}\n**Target:** ${alert.line || 'N/A'}\n**Best Book:** ${alert.best_book || 'N/A'}`,
      inline: true
    },
    {
      name: '💰 Odds Comparison',
      value: `**Best Odds:** ${formatOdds(alert.best_odds || 0)}\n**Average:** ${formatOdds(alert.average_odds || 0)}\n**Edge:** +${alert.edge_percentage || 0}%`,
      inline: true
    }
  );

  // Multiple books comparison
  if (alert.odds_comparison && alert.odds_comparison.length > 0) {
    const topBooks = alert.odds_comparison.slice(0, 4).map((book: any) =>
      `• **${book.book_name}**: ${formatOdds(book.odds)} ${book.available ? '✅' : '❌'}`
    ).join('\n');

    embed.addFields({
      name: '📚 Sportsbook Comparison',
      value: topBooks,
      inline: false
    });
  }

  // AI Analysis
  if (advice) {
    embed.addFields({
      name: '🧠 Line Shopping Analysis',
      value: formatAdvice(advice),
      inline: false
    });
  }

  embed.setFooter({
    text: 'Unit Talk Line Shopping Engine • Real-time odds optimization',
    iconURL: 'https://i.imgur.com/line-shopping-icon.png'
  });

  return embed;
}

// Arbitrage Opportunity Alert
function buildArbitrageAlertEmbed(alert: any, advice: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('⚡ ARBITRAGE OPPORTUNITY')
    .setColor(0xFFD700) // Gold for arbitrage
    .setTimestamp(new Date(alert.created_at));

  // Header info
  embed.setDescription(`**${alert.player_name || 'Player'}** • ${alert.league || 'League'}`);

  // Arbitrage details
  embed.addFields(
    {
      name: '🎯 Arbitrage Setup',
      value: `**Market:** ${alert.market_type || 'N/A'}\n**Profit Margin:** ${alert.profit_margin || 'N/A'}%\n**Required Capital:** $${alert.required_capital || 'N/A'}`,
      inline: true
    },
    {
      name: '📊 Expected Profit',
      value: `**Guaranteed Profit:** $${alert.expected_profit || 'N/A'}\n**ROI:** ${alert.roi_percentage || 'N/A'}%\n**Risk Level:** ${alert.risk_level || 'Low'}`,
      inline: true
    }
  );

  // Leg details
  if (alert.arbitrage_legs && alert.arbitrage_legs.length > 0) {
    const legs = alert.arbitrage_legs.map((leg: any, index: number) =>
      `**Leg ${index + 1}:** ${leg.book_name} - ${leg.outcome} @ ${formatOdds(leg.odds)} ($${leg.stake})`
    ).join('\n');

    embed.addFields({
      name: '🦵 Arbitrage Legs',
      value: legs,
      inline: false
    });
  }

  // AI Analysis
  if (advice) {
    embed.addFields({
      name: '🧠 Arbitrage Analysis',
      value: formatAdvice(advice),
      inline: false
    });
  }

  embed.setFooter({
    text: 'Unit Talk Arbitrage Engine • Risk-free profit opportunities',
    iconURL: 'https://i.imgur.com/arbitrage-icon.png'
  });

  return embed;
}

// Professional approved pick embed builder
function buildProfessionalApprovedEmbed(pick: any, advice: string, playerImageUrl?: string): EmbedBuilder {
  const tier = pick.tier || 'N/A';
  const professionalScore = pick.professional_score || 0;
  const kellyFraction = pick.kelly_fraction || 0;
  const devigged_edge = pick.devigged_edge || 0;

  const embed = new EmbedBuilder()
    .setTitle('🏆 PROFESSIONAL PICK APPROVED')
    .setColor(getProfessionalColor(tier))
    .setTimestamp(new Date(pick.created_at));

  // Add player headshot
  let headshotUrl = playerImageUrl;
  if (!headshotUrl && pick.player_name) {
    headshotUrl = getPlayerHeadshotUrl('', '', pick.player_name) || undefined;
  }

  if (headshotUrl) {
    embed.setThumbnail(headshotUrl);
  }

  // Professional pick description format
  const description = `**${pick.player_name || 'Unknown Player'}** | ${pick.stat_type || 'Unknown Stat'} | ${formatPickLine(pick)}`;
  embed.setDescription(description);

  // Enhanced45Factor Professional Analysis section
  const professionalAnalysis = formatProfessionalAnalysis({
    professionalScore,
    kellyFraction,
    devigged_edge,
    tier
  });

  embed.addFields({
    name: '💰 Professional Score (Enhanced45Factor)',
    value: `**${professionalScore.toFixed(1)}/10** (${tier}-Tier)`,
    inline: true
  });

  if (kellyFraction > 0) {
    embed.addFields({
      name: '📊 Kelly Fraction %',
      value: `**${(kellyFraction * 100).toFixed(1)}%**`,
      inline: true
    });
  }

  if (devigged_edge > 0) {
    embed.addFields({
      name: '🎯 Devigged Edge %',
      value: `**+${devigged_edge.toFixed(1)}%**`,
      inline: true
    });
  }

  // Line and odds information
  embed.addFields({
    name: '📈 Line & Odds',
    value: `**${formatPickLine(pick)}** @ **${formatOdds(pick.odds || 0)}**`,
    inline: false
  });

  // Professional analysis advice
  if (advice) {
    embed.addFields({
      name: '🤖 Enhanced45Factor Analysis Complete',
      value: advice,
      inline: false
    });
  }

  // Professional footer
  embed.setFooter({
    text: '🏆 Enhanced45Factor Professional Intelligence • Fortune 100 Analytics',
  });

  return embed;
}

// Helper function to get professional tier color
function getProfessionalColor(tier: string): number {
  switch (tier) {
    case 'S+': return 0xFF0000; // Red for S+
    case 'S': return 0xFF6600;  // Orange for S
    case 'A+': return 0xFFD700; // Gold for A+
    case 'A': return 0x00FF00;  // Green for A
    case 'B+': return 0x00AAFF; // Blue for B+
    case 'B': return 0x0099FF;  // Light blue for B
    case 'C': return 0x9932CC;  // Purple for C
    case 'D': return 0x808080;  // Gray for D
    default: return 0x6C757D;   // Bootstrap secondary for unknown
  }
}

// Helper function to format pick line (O/U)
function formatPickLine(pick: any): string {
  if (pick.line && pick.over_under) {
    const direction = pick.over_under.toLowerCase() === 'over' ? 'O' : 'U';
    return `${direction} ${pick.line}`;
  }
  return pick.line ? pick.line.toString() : 'N/A';
}

// Helper function to format professional analysis
function formatProfessionalAnalysis(data: any): string {
  const { professionalScore, kellyFraction, devigged_edge, tier } = data;

  let analysis = `**Professional Score:** ${professionalScore.toFixed(1)}/10 (${tier})`;

  if (kellyFraction > 0) {
    analysis += ` | **Kelly:** ${(kellyFraction * 100).toFixed(1)}%`;
  }

  if (devigged_edge > 0) {
    analysis += ` | **Edge:** +${devigged_edge.toFixed(1)}%`;
  }

  return analysis;
}

// Export parlay builder for external use
export { getPlayerHeadshotUrl } from './parlayEmbedBuilder';

// Export the new professional embed builder
export { buildProfessionalApprovedEmbed };

// Utility function for batch embed creation
export function buildBatchAlertEmbed(picks: UnifiedPick[], title: string = 'Daily Picks Summary'): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📋 ${title}`)
    .setColor(0x0099FF)
    .setTimestamp();

  const pickSummaries = picks.slice(0, 10).map((pick) => {
    const priority = getAlertPriority(pick);
    // Show professional score if available for approved picks
    const scoreDisplay = pick.professional_score ? ` (Score: ${pick.professional_score.toFixed(1)})` : '';
    return `${priority.emoji} **${pick.player_name || 'Unknown'}** ${pick.market_type} ${pick.line} @ ${formatOdds(pick.odds)} (${pick.tier}${scoreDisplay})`;
  }).join('\n');

  embed.setDescription(pickSummaries);

  if (picks.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${picks.length} picks` });
  }

  return embed;
}

// Utility function for professional batch picks (approved picks)
export function buildProfessionalBatchEmbed(picks: any[], title: string = 'Professional Picks Approved'): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${title}`)
    .setColor(0xFFD700) // Gold for professional picks
    .setTimestamp();

  const professionalSummaries = picks.slice(0, 8).map((pick) => {
    const score = pick.professional_score || 0;
    const kelly = pick.kelly_fraction ? `${(pick.kelly_fraction * 100).toFixed(1)}%` : 'N/A';
    const edge = pick.devigged_edge ? `+${pick.devigged_edge.toFixed(1)}%` : 'N/A';

    return [
      `🏆 **${pick.player_name || 'Unknown Player'}**`,
      `📊 ${pick.stat_type || 'Unknown'} ${formatPickLine(pick)} @ ${formatOdds(pick.odds || 0)}`,
      `💰 Score: ${score.toFixed(1)}/10 | Kelly: ${kelly} | Edge: ${edge}`,
      `🎯 Tier: ${pick.tier || 'N/A'}`
    ].join('\n');
  }).join('\n\n');

  embed.setDescription(professionalSummaries);

  if (picks.length > 8) {
    embed.setFooter({
      text: `🏆 Showing 8 of ${picks.length} professional picks • Enhanced45Factor Intelligence`
    });
  } else {
    embed.setFooter({
      text: '🏆 Enhanced45Factor Professional Intelligence System'
    });
  }

  return embed;
}