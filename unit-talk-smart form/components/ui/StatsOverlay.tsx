import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './card';
import { Badge } from './badge';
import { TeamLogo } from './TeamLogo';
import { PlayerHeadshot } from './PlayerHeadshot';

interface Stats {
  player?: {
    name: string;
    photo: string;
    recentStats: {
      date: string;
      value: number;
    }[];
    averages: {
      last5: number;
      last10: number;
      season: number;
    };
  };
  team?: {
    name: string;
    logo: string;
    recentGames: {
      date: string;
      score: number;
      opponent: string;
    }[];
    trends: {
      home: number;
      away: number;
      overall: number;
    };
  };
  headToHead?: {
    lastGames: {
      date: string;
      winner: string;
      score: string;
    }[];
    stats: {
      wins: number;
      losses: number;
      averageScore: number;
    };
  };
  weather?: {
    condition: string;
    temperature: number;
    windSpeed: number;
    precipitation: number;
    impact: {
      level: 'low' | 'medium' | 'high';
      description: string;
    };
  };
}

interface StatsOverlayProps {
  playerId?: string;
  teamId?: string;
  onClose: () => void;
}

export const StatsOverlay: React.FC<StatsOverlayProps> = ({
  playerId,
  teamId,
  onClose
}) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'h2h' | 'weather'>('overview');

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        // In a real app, these would be actual API calls
        const response = await fetch(
          playerId 
            ? `/api/player-stats/${playerId}` 
            : `/api/team-stats/${teamId}`
        );
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [playerId, teamId]);

  const renderTrendChart = (data: { date: string; value: number }[]) => {
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue;

    return (
      <div className="w-full h-[200px] flex items-end space-x-1">
        {data.map((point, i) => {
          const height = ((point.value - minValue) / range) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div 
                className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                style={{ height: `${height}%` }}
              >
                <div className="invisible group-hover:visible absolute bottom-full mb-1 text-xs">
                  {point.value}
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                {new Date(point.date).toLocaleDateString()}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeatherImpact = () => {
    if (!stats?.weather) return null;

    const impactColors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };

    const impactVariants = {
      low: 'success',
      medium: 'warning',
      high: 'destructive'
    } as const;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <div className="p-4">
              <h4 className="text-sm font-medium text-gray-500">Temperature</h4>
              <p className="text-2xl font-bold">{stats.weather.temperature}°F</p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <h4 className="text-sm font-medium text-gray-500">Wind Speed</h4>
              <p className="text-2xl font-bold">{stats.weather.windSpeed} mph</p>
            </div>
          </Card>
        </div>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Impact Assessment</h4>
              <Badge
                variant={impactVariants[stats.weather.impact.level]}
                className={impactColors[stats.weather.impact.level]}
              >
                {stats.weather.impact.level.toUpperCase()} IMPACT
              </Badge>
            </div>
            <p className="text-sm text-gray-600">
              {stats.weather.impact.description}
            </p>
          </div>
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center p-4 text-gray-500">
        No stats available
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          {stats.player ? (
            <PlayerHeadshot
              src={stats.player.photo}
              alt={stats.player.name}
              size="lg"
            />
          ) : stats.team && (
            <TeamLogo
              src={stats.team.logo}
              alt={stats.team.name}
              size="lg"
            />
          )}
          <div>
            <h2 className="text-xl font-bold">
              {stats.player?.name || stats.team?.name}
            </h2>
            <div className="flex space-x-2 mt-1">
              {stats.player?.averages && (
                <>
                  <Badge variant="outline">
                    L5: {stats.player.averages.last5}
                  </Badge>
                  <Badge variant="outline">
                    L10: {stats.player.averages.last10}
                  </Badge>
                  <Badge variant="outline">
                    Season: {stats.player.averages.season}
                  </Badge>
                </>
              )}
              {stats.team?.trends && (
                <>
                  <Badge variant="outline">
                    Home: {stats.team.trends.home}%
                  </Badge>
                  <Badge variant="outline">
                    Away: {stats.team.trends.away}%
                  </Badge>
                  <Badge variant="outline">
                    Overall: {stats.team.trends.overall}%
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'overview'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'trends'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Trends
        </button>
        <button
          onClick={() => setActiveTab('h2h')}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'h2h'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          H2H
        </button>
        <button
          onClick={() => setActiveTab('weather')}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'weather'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Weather
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {stats.player && (
                  <Card>
                    <div className="p-4">
                      <h3 className="font-medium mb-2">Recent Performance</h3>
                      {renderTrendChart(stats.player.recentStats)}
                    </div>
                  </Card>
                )}
                {stats.team && (
                  <Card>
                    <div className="p-4">
                      <h3 className="font-medium mb-2">Recent Games</h3>
                      <div className="space-y-2">
                        {stats.team.recentGames.map((game, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>{game.date}</span>
                            <span>vs {game.opponent}</span>
                            <span className="font-medium">{game.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'trends' && (
              <div className="space-y-4">
                {stats.player && (
                  <Card>
                    <div className="p-4">
                      <h3 className="font-medium mb-2">Performance Trends</h3>
                      {renderTrendChart(stats.player.recentStats)}
                    </div>
                  </Card>
                )}
                {stats.team && (
                  <Card>
                    <div className="p-4">
                      <h3 className="font-medium mb-2">Team Trends</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <h4 className="text-sm text-gray-500">Home</h4>
                          <p className="text-2xl font-bold">
                            {stats.team.trends.home}%
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm text-gray-500">Away</h4>
                          <p className="text-2xl font-bold">
                            {stats.team.trends.away}%
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm text-gray-500">Overall</h4>
                          <p className="text-2xl font-bold">
                            {stats.team.trends.overall}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'h2h' && stats.headToHead && (
              <div className="space-y-4">
                <Card>
                  <div className="p-4">
                    <h3 className="font-medium mb-2">Head to Head Stats</h3>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <h4 className="text-sm text-gray-500">Wins</h4>
                        <p className="text-2xl font-bold">
                          {stats.headToHead.stats.wins}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm text-gray-500">Losses</h4>
                        <p className="text-2xl font-bold">
                          {stats.headToHead.stats.losses}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm text-gray-500">Avg Score</h4>
                        <p className="text-2xl font-bold">
                          {stats.headToHead.stats.averageScore}
                        </p>
                      </div>
                    </div>
                    <h4 className="font-medium mb-2">Recent Matchups</h4>
                    <div className="space-y-2">
                      {stats.headToHead.lastGames.map((game, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>{game.date}</span>
                          <span className="font-medium">{game.winner}</span>
                          <span>{game.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'weather' && renderWeatherImpact()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Close button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </motion.div>
  );
}; 