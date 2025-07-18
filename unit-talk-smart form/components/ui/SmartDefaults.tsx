import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { TeamLogo } from './TeamLogo';
import { PlayerHeadshot } from './PlayerHeadshot';

interface UserPreferences {
  defaultSport: string;
  defaultUnitSize: number;
  favoriteTeams: string[];
  favoritePlayers: string[];
  preferredBetTypes: string[];
  recentPicks: {
    id: string;
    type: string;
    amount: number;
    timestamp: string;
    result?: 'win' | 'loss' | 'pending';
  }[];
}

interface SmartDefaultsProps {
  userId: string;
  onPreferencesUpdate: (prefs: UserPreferences) => void;
}

export const SmartDefaults: React.FC<SmartDefaultsProps> = ({
  userId,
  onPreferencesUpdate
}) => {
  const [preferences, setPreferences] = useState<UserPreferences>({
    defaultSport: '',
    defaultUnitSize: 1,
    favoriteTeams: [],
    favoritePlayers: [],
    preferredBetTypes: [],
    recentPicks: []
  });

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      setLoading(true);
      try {
        // In a real app, this would be an API call
        const response = await fetch(`/api/user-preferences/${userId}`);
        const data = await response.json();
        setPreferences(data);
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [userId]);

  const handlePreferenceUpdate = async (updates: Partial<UserPreferences>) => {
    try {
      // In a real app, this would be an API call
      await fetch(`/api/user-preferences/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      setPreferences(prev => ({ ...prev, ...updates }));
      onPreferencesUpdate({ ...preferences, ...updates });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  };

  const renderFavoriteTeams = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Favorite Teams</h3>
        {isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {/* Open team selector */}}
          >
            Add Team
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {preferences.favoriteTeams.map((team, i) => (
          <div key={i} className="relative group">
            <TeamLogo
              src={`/api/team-logos/${team}.png`}
              alt={team}
              size="sm"
            />
            {isEditing && (
              <button
                onClick={() => {
                  const newTeams = preferences.favoriteTeams.filter(t => t !== team);
                  handlePreferenceUpdate({ favoriteTeams: newTeams });
                }}
                className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center bg-red-500 text-white rounded-full text-xs"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderFavoritePlayers = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Favorite Players</h3>
        {isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {/* Open player selector */}}
          >
            Add Player
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {preferences.favoritePlayers.map((player, i) => (
          <div key={i} className="relative group">
            <PlayerHeadshot
              src={`/api/player-photos/${player}.png`}
              alt={player}
              size="sm"
            />
            {isEditing && (
              <button
                onClick={() => {
                  const newPlayers = preferences.favoritePlayers.filter(p => p !== player);
                  handlePreferenceUpdate({ favoritePlayers: newPlayers });
                }}
                className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center bg-red-500 text-white rounded-full text-xs"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderBetTypes = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Preferred Bet Types</h3>
        {isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {/* Open bet type selector */}}
          >
            Add Type
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {preferences.preferredBetTypes.map((type, i) => (
          <div key={i} className="relative group">
            <Badge variant="outline">
              {type}
              {isEditing && (
                <button
                  onClick={() => {
                    const newTypes = preferences.preferredBetTypes.filter(t => t !== type);
                    handlePreferenceUpdate({ preferredBetTypes: newTypes });
                  }}
                  className="ml-2 hover:text-red-500"
                >
                  ×
                </button>
              )}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );

  const renderRecentPicks = () => (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Recent Picks</h3>
      <div className="space-y-2">
        {preferences.recentPicks.map((pick, i) => (
          <Card key={i}>
            <div className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{pick.type}</div>
                <div className="text-sm text-gray-500">
                  {new Date(pick.timestamp).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-sm font-medium">
                  {pick.amount} units
                </div>
                {pick.result && (
                  <Badge
                    variant={
                      pick.result === 'win' ? 'success' :
                      pick.result === 'loss' ? 'destructive' :
                      'secondary'
                    }
                  >
                    {pick.result}
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Smart Defaults</h2>
        <Button
          variant="outline"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? 'Done' : 'Edit'}
        </Button>
      </div>

      <Card>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Default Sport
              </label>
              <select
                value={preferences.defaultSport}
                onChange={(e) => handlePreferenceUpdate({ defaultSport: e.target.value })}
                disabled={!isEditing}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Select Sport</option>
                <option value="NFL">NFL</option>
                <option value="NBA">NBA</option>
                <option value="MLB">MLB</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Default Unit Size
              </label>
              <input
                type="number"
                value={preferences.defaultUnitSize}
                onChange={(e) => handlePreferenceUpdate({ defaultUnitSize: Number(e.target.value) })}
                disabled={!isEditing}
                min={1}
                step={1}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {renderFavoriteTeams()}
          {renderFavoritePlayers()}
          {renderBetTypes()}
        </div>
      </Card>

      <Card>
        <div className="p-4">
          {renderRecentPicks()}
        </div>
      </Card>
    </motion.div>
  );
}; 