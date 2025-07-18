import { useMemo } from 'react';
import { PlayerHeadshot } from './PlayerHeadshot';
import { TeamLogo } from './TeamLogo';
import { Tooltip } from './Tooltip';
import { motion } from 'framer-motion';

interface TicketSummaryCardProps {
  ticket: any; // Replace with proper type from your schema
  sportConfig: any; // Replace with proper type from your schema
  showDetails?: boolean;
  className?: string;
}

export function TicketSummaryCard({ 
  ticket, 
  sportConfig, 
  showDetails = true,
  className = '' 
}: TicketSummaryCardProps) {
  const totalOdds = useMemo(() => {
    if (ticket.ticket_type === 'Single') {
      return parseFloat(ticket.legs[0].odds);
    }
    
    // Calculate parlay odds
    return ticket.legs.reduce((acc: number, leg: any) => {
      const odds = parseFloat(leg.odds);
      if (odds > 0) {
        return acc * (1 + odds / 100);
      } else {
        return acc * (1 - 100 / odds);
      }
    }, 1);
  }, [ticket]);

  const impliedProbability = useMemo(() => {
    if (totalOdds > 0) {
      return (100 / (totalOdds + 100)) * 100;
    } else {
      return ((-totalOdds) / (-totalOdds + 100)) * 100;
    }
  }, [totalOdds]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {ticket.ticket_type} Ticket
            </h3>
            <p className="text-sm opacity-90">
              {sportConfig.name} • {ticket.legs.length} {ticket.legs.length === 1 ? 'Pick' : 'Picks'}
            </p>
          </div>
          <div className="text-right">
            <Tooltip content="Total implied probability of winning">
              <div className="text-2xl font-bold">
                {impliedProbability.toFixed(1)}%
              </div>
            </Tooltip>
            <div className="text-sm opacity-90">
              {ticket.unit_size} Unit{ticket.unit_size !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Legs */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {ticket.legs.map((leg: any, index: number) => (
          <div key={leg.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {leg.player_name && leg.player_image && (
                  <PlayerHeadshot
                    src={leg.player_image}
                    alt={leg.player_name}
                    size="md"
                  />
                )}
                {leg.team_logo && (
                  <TeamLogo
                    src={leg.team_logo}
                    alt={leg.team}
                    size="md"
                  />
                )}
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {leg.player_name || leg.team}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {leg.bet_type}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-gray-900 dark:text-white">
                  {leg.odds > 0 ? '+' : ''}{leg.odds}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {leg.line && `${leg.over_under} ${leg.line}`}
                </div>
              </div>
            </div>

            {showDetails && (
              <div className="text-sm text-gray-600 dark:text-gray-400 pl-14">
                {leg.matchup && (
                  <div className="flex items-center space-x-2">
                    <span>📅</span>
                    <span>{leg.matchup}</span>
                  </div>
                )}
                {leg.stat_type && (
                  <div className="flex items-center space-x-2">
                    <span>📊</span>
                    <span>{leg.stat_type}</span>
                  </div>
                )}
                {leg.game_context && (
                  <div className="flex items-center space-x-2">
                    <span>🎮</span>
                    <span>{leg.game_context}</span>
                  </div>
                )}
              </div>
            )}

            {/* Edge score and AI analysis for VIP+ */}
            {leg.edge_score > 0 && (
              <div className="mt-2 pl-14">
                <div className={`
                  inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                  ${leg.edge_score >= 7 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                    leg.edge_score >= 5 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                    'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'}
                `}>
                  🎯 Edge Score: {leg.edge_score}/10
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer with total odds and confidence */}
      <div className="bg-gray-50 dark:bg-gray-900/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total Odds
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {totalOdds > 0 ? '+' : ''}{totalOdds.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Confidence
            </div>
            <div className="flex items-center space-x-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-4 rounded-sm ${
                    i < ticket.confidence_level
                      ? 'bg-blue-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
} 