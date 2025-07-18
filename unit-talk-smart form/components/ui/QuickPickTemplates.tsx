import React, { useState, useEffect } from 'react';
import { Card } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { TeamLogo } from './TeamLogo';
import { PlayerHeadshot } from './PlayerHeadshot';
import { motion } from 'framer-motion';

interface Pick {
  id: string;
  type: string;
  teams: string[];
  players: string[];
  odds: number;
  winRate: number;
  popularity: number;
  timestamp: string;
}

interface QuickPickTemplatesProps {
  onSelectTemplate: (pick: Pick) => void;
}

export const QuickPickTemplates: React.FC<QuickPickTemplatesProps> = ({ onSelectTemplate }) => {
  const [savedPicks, setSavedPicks] = useState<Pick[]>([]);
  const [popularPicks, setPopularPicks] = useState<Pick[]>([]);
  const [successfulPicks, setSuccessfulPicks] = useState<Pick[]>([]);

  useEffect(() => {
    // Fetch saved picks from local storage or API
    const fetchSavedPicks = async () => {
      try {
        const saved = localStorage.getItem('savedPicks');
        if (saved) {
          setSavedPicks(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Error fetching saved picks:', error);
      }
    };

    // Fetch popular picks from API
    const fetchPopularPicks = async () => {
      try {
        // API call would go here
        const response = await fetch('/api/popular-picks');
        const data = await response.json();
        setPopularPicks(data);
      } catch (error) {
        console.error('Error fetching popular picks:', error);
      }
    };

    // Fetch successful picks history
    const fetchSuccessfulPicks = async () => {
      try {
        // API call would go here
        const response = await fetch('/api/successful-picks');
        const data = await response.json();
        setSuccessfulPicks(data);
      } catch (error) {
        console.error('Error fetching successful picks:', error);
      }
    };

    fetchSavedPicks();
    fetchPopularPicks();
    fetchSuccessfulPicks();
  }, []);

  const renderPickPreview = (pick: Pick) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="relative p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm"
    >
      <div className="flex items-center justify-between mb-2">
        <Badge variant={pick.winRate > 0.6 ? "success" : "default"}>
          {Math.round(pick.winRate * 100)}% Win Rate
        </Badge>
        <span className="text-sm text-gray-500">
          {new Date(pick.timestamp).toLocaleDateString()}
        </span>
      </div>
      
      <div className="flex items-center space-x-2 mb-2">
        {pick.teams.map((team, i) => (
          <TeamLogo 
            key={i} 
            src={`/api/team-logos/${team}.png`} 
            alt={team}
            size="sm" 
          />
        ))}
      </div>
      
      <div className="flex items-center space-x-2 mb-2">
        {pick.players.map((player, i) => (
          <PlayerHeadshot 
            key={i} 
            src={`/api/player-photos/${player}.png`} 
            alt={player}
            size="sm" 
          />
        ))}
      </div>

      <div className="flex justify-between items-center mt-2">
        <span className="text-sm font-medium">
          {pick.type} @ {pick.odds}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectTemplate(pick)}
        >
          Use Template
        </Button>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold mb-3">Saved Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedPicks.map((pick) => (
            <Card key={pick.id}>
              {renderPickPreview(pick)}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-3">Popular Picks</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {popularPicks.map((pick) => (
            <Card key={pick.id}>
              {renderPickPreview(pick)}
              <Badge
                variant="secondary"
                className="absolute top-2 right-2"
              >
                {pick.popularity}+ users
              </Badge>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-3">Previous Successful Picks</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {successfulPicks.map((pick) => (
            <Card key={pick.id}>
              {renderPickPreview(pick)}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}; 