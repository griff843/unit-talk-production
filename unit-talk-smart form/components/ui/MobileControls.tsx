import React, { useState } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Card } from './card';
import { Button } from './button';
import { Badge } from './badge';

interface Parlay {
  id: string;
  type: string;
  odds: number;
  stake: number;
  teams: string[];
  players: string[];
}

interface MobileControlsProps {
  parlays: Parlay[];
  onParlayUpdate: (parlay: Parlay) => void;
  onParlayRemove: (id: string) => void;
  onQuickAction: (action: string) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  parlays,
  onParlayUpdate,
  onParlayRemove,
  onQuickAction
}) => {
  const [activeParlay, setActiveParlay] = useState<string | null>(null);
  const controls = useAnimation();

  const handleSwipe = async (id: string, direction: number) => {
    if (direction > 0) {
      // Swipe right - edit
      setActiveParlay(id);
    } else {
      // Swipe left - delete
      await controls.start({ x: -200, opacity: 0 });
      onParlayRemove(id);
    }
  };

  const handleStakeChange = (id: string, change: number) => {
    const parlay = parlays.find(p => p.id === id);
    if (parlay) {
      onParlayUpdate({
        ...parlay,
        stake: Math.max(1, parlay.stake + change)
      });
    }
  };

  const quickActions = [
    { label: 'Clear All', action: 'clear', icon: '🗑️' },
    { label: 'Double Stakes', action: 'double', icon: '2️⃣' },
    { label: 'Half Stakes', action: 'half', icon: '½' },
    { label: 'Max Bet', action: 'max', icon: '💰' }
  ];

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2">
        {quickActions.map(({ label, action, icon }) => (
          <Button
            key={action}
            variant="outline"
            className="flex flex-col items-center p-3 h-auto"
            onClick={() => onQuickAction(action)}
          >
            <span className="text-xl mb-1">{icon}</span>
            <span className="text-xs">{label}</span>
          </Button>
        ))}
      </div>

      {/* Parlays */}
      <div className="space-y-2">
        {parlays.map((parlay) => (
          <motion.div
            key={parlay.id}
            animate={controls}
            drag="x"
            dragConstraints={{ left: -100, right: 100 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => handleSwipe(parlay.id, info.offset.x)}
            className="touch-none"
          >
            <Card className="relative overflow-hidden">
              <AnimatePresence>
                {activeParlay === parlay.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="absolute inset-0 bg-blue-500 bg-opacity-10 backdrop-blur-sm flex items-center justify-center"
                  >
                    <div className="flex space-x-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveParlay(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onParlayRemove(parlay.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">{parlay.type}</Badge>
                  <div className="text-sm font-medium">{parlay.odds}</div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {parlay.teams.map((team, i) => (
                    <Badge key={i} variant="secondary">
                      {team}
                    </Badge>
                  ))}
                  {parlay.players.map((player, i) => (
                    <Badge key={i} variant="secondary">
                      {player}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStakeChange(parlay.id, -1)}
                    >
                      -
                    </Button>
                    <span className="font-medium">{parlay.stake} units</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStakeChange(parlay.id, 1)}
                    >
                      +
                    </Button>
                  </div>
                  <div className="text-sm text-gray-500">
                    Swipe to edit/remove
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Mobile-optimized bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
        <div className="flex-1 text-center">
          <div className="text-sm text-gray-500">Total Stakes</div>
          <div className="font-bold">
            {parlays.reduce((sum, p) => sum + p.stake, 0)} units
          </div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-sm text-gray-500">Potential Win</div>
          <div className="font-bold text-green-600">
            {parlays.reduce((sum, p) => sum + (p.stake * p.odds), 0).toFixed(2)} units
          </div>
        </div>
        <Button
          className="flex-1 ml-4"
          onClick={() => onQuickAction('submit')}
        >
          Submit All
        </Button>
      </div>
    </div>
  );
}; 