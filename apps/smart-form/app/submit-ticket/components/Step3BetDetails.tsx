'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BET_CATEGORIES, MARKET_TYPES, BetCategory, MarketType } from '../types';

interface Step3BetDetailsProps {
  data: {
    sport?: string;
    ticket_type?: string;
    bet_type?: string;
    market_type?: MarketType;
  };
  onUpdate: (updates: any) => void;
  onNext: () => void;
  onBack: () => void;
  errors?: any;
}

// Bet type configuration with icons and descriptions
const BET_TYPE_CONFIG = {
  spread: {
    icon: '📈',
    title: 'Point Spread',
    description: 'Bet on margin of victory',
    popularity: 'Most Popular',
    winRate: 68,
  },
  total: {
    icon: '📊',
    title: 'Over/Under',
    description: 'Total points scored',
    popularity: 'Very Popular',
    winRate: 65,
  },
  moneyline: {
    icon: '💰',
    title: 'Moneyline',
    description: 'Straight win/loss bet',
    popularity: 'Popular',
    winRate: 62,
  },
  player_prop: {
    icon: '⭐',
    title: 'Player Props',
    description: 'Individual player stats',
    popularity: 'Trending',
    winRate: 71,
  },
  team_prop: {
    icon: '🏆',
    title: 'Team Props',
    description: 'Team-specific outcomes',
    popularity: 'Niche',
    winRate: 59,
  },
  futures: {
    icon: '🔮',
    title: 'Futures',
    description: 'Long-term outcomes',
    popularity: 'Seasonal',
    winRate: 45,
  },
  parlay: {
    icon: '🔗',
    title: 'Parlay',
    description: 'Multiple bets combined',
    popularity: 'Popular',
    winRate: 42,
  },
  teaser: {
    icon: '📐',
    title: 'Teaser',
    description: 'Adjusted point spreads',
    popularity: 'Niche',
    winRate: 55,
  },
} as const;

const MARKET_TYPE_CONFIG = {
  pre_game: {
    icon: '🕐',
    title: 'Pre-Game',
    description: 'Before game starts',
    advantage: 'Better research time',
  },
  live: {
    icon: '🔴',
    title: 'Live Betting',
    description: 'During the game',
    advantage: 'Real-time information',
  },
  futures: {
    icon: '🔮',
    title: 'Futures',
    description: 'Season/tournament outcomes',
    advantage: 'Higher potential payouts',
  },
} as const;

export function Step3BetDetails({ data, onUpdate, onNext, onBack, errors }: Step3BetDetailsProps) {
  // Filter bet types based on sport
  const getAvailableBetTypes = () => {
    // All sports support basic bet types
    const basicTypes: BetCategory[] = ['spread', 'total', 'moneyline'];

    // Add sport-specific types
    const sportSpecific: BetCategory[] = [];

    if (['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF'].includes(data.sport || '')) {
      sportSpecific.push('player_prop', 'team_prop');
    }

    if (['NBA', 'NFL', 'MLB', 'NHL'].includes(data.sport || '')) {
      sportSpecific.push('futures');
    }

    return [...basicTypes, ...sportSpecific];
  };

  // Get sport-specific suggestions
  const getSportSuggestions = () => {
    const suggestions: { [key: string]: string[] } = {
      NBA: [
        'Point spreads offer great value in NBA',
        'Player props trending: LeBron assists, Curry 3-pointers',
        'Unders hitting 62% this week in NBA games',
      ],
      NFL: [
        'Spread betting most reliable in NFL',
        'QB passing yards props are popular',
        'Weather impacts totals significantly',
      ],
      MLB: [
        'Run lines offer better value than spreads',
        'Pitcher strikeout props are sharp plays',
        'Totals heavily influenced by ballpark factors',
      ],
    };

    return (
      suggestions[data.sport || ''] || [
        'Research team form and head-to-head records',
        'Consider weather and venue factors',
        'Look for line movement and sharp money',
      ]
    );
  };

  const handleBetTypeSelect = (betType: string) => {
    onUpdate({ bet_type: betType });
  };

  const handleMarketTypeSelect = (marketType: MarketType) => {
    onUpdate({ market_type: marketType });
  };

  const availableBetTypes = getAvailableBetTypes();
  const suggestions = getSportSuggestions();
  const isValid = data.bet_type && data.market_type;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">🎲 Bet Type & Market</h2>
        <p className="text-gray-600">Choose your betting style and timing for {data.sport}</p>
      </div>

      {/* Bet Type Selection */}
      <Card className="p-6 bg-white text-gray-900 border border-gray-200">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            🎲 Primary Bet Types ({data.sport})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableBetTypes.map(betType => {
              const config = BET_TYPE_CONFIG[betType];
              return (
                <button
                  key={betType}
                  onClick={() => handleBetTypeSelect(betType)}
                  className={`
                    p-4 rounded-lg border-2 transition-all duration-200 text-left hover:scale-105
                    ${
                      data.bet_type === betType
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{config.icon}</span>
                    <Badge
                      variant={config.popularity === 'Most Popular' ? 'default' : 'outline'}
                      className="text-xs"
                    >
                      {config.popularity}
                    </Badge>
                  </div>
                  <div className="font-semibold text-gray-900">{config.title}</div>
                  <div className="text-sm text-gray-700 mb-2 font-medium">{config.description}</div>
                  <div className="text-xs text-green-700 font-semibold">
                    {config.winRate}% win rate
                  </div>
                </button>
              );
            })}
          </div>

          {data.sport && (
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm text-green-800">
                📋 Popular for {data.sport}: {BET_TYPE_CONFIG[availableBetTypes[0]]?.title} (
                {BET_TYPE_CONFIG[availableBetTypes[0]]?.winRate}% win rate)
              </div>
            </div>
          )}

          {errors?.bet_type && <p className="text-sm text-red-600">{errors.bet_type}</p>}
        </div>
      </Card>

      {/* Market Type Selection */}
      <Card className="p-6 bg-white text-gray-900 border border-gray-200">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">⏰ When to Place</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(MARKET_TYPE_CONFIG) as Array<keyof typeof MARKET_TYPE_CONFIG>).map(
              marketType => {
                const config = MARKET_TYPE_CONFIG[marketType];
                return (
                  <button
                    key={marketType}
                    onClick={() => handleMarketTypeSelect(marketType as MarketType)}
                    className={`
                    p-4 rounded-lg border-2 transition-all duration-200 text-center
                    ${
                      data.market_type === marketType
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }
                  `}
                  >
                    <div className="text-3xl mb-2">{config.icon}</div>
                    <div className="font-semibold text-gray-900 mb-1">{config.title}</div>
                    <div className="text-sm text-gray-700 mb-2 font-medium">
                      {config.description}
                    </div>
                    <div className="text-xs text-blue-700 font-semibold">{config.advantage}</div>
                  </button>
                );
              }
            )}
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm text-blue-800">
              💡 Pre-game {data.bet_type || 'bets'} offer better value for {data.sport}
            </div>
          </div>

          {errors?.market_type && <p className="text-sm text-red-600">{errors.market_type}</p>}
        </div>
      </Card>

      {/* Smart Suggestions */}
      <Card className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">🧠 Smart Suggestions</h3>
          <p className="text-sm text-gray-600">Based on your preferences and current trends:</p>

          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5 font-bold">✓</span>
                <span className="text-sm text-gray-800 font-medium">{suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline" className="px-8 py-3 text-lg font-semibold">
          ← Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="px-8 py-3 text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
        >
          Continue →
        </Button>
      </div>
    </div>
  );
}
