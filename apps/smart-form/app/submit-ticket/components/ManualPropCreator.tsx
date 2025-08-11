'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Save } from 'lucide-react';
import { SmartPlayerInput } from './SmartPlayerInput';

interface ManualProp {
  id: string;
  player_name: string;
  team: string;
  prop_type: string;
  line?: number;
  over_odds: number;
  under_odds: number;
  notes?: string;
}

interface ManualPropCreatorProps {
  gameId: string;
  gameMatchup: string;
  sport: string;
  onPropCreated: (prop: ManualProp) => void;
  onCancel: () => void;
}

const PROP_TYPES = {
  MLB: [
    'Strikeouts',
    'Total Hits',
    'Total RBIs',
    'To Hit Home Run',
    'Stolen Bases',
    'Runs Scored',
    'Walks',
    'Total Bases',
    'Innings Pitched',
    'Earned Runs',
  ],
  NBA: [
    'Points',
    'Rebounds',
    'Assists',
    'Steals',
    'Blocks',
    '3-Pointers Made',
    'Free Throws Made',
    'Double-Double',
    'Triple-Double',
  ],
  NFL: [
    'Passing Yards',
    'Rushing Yards',
    'Receiving Yards',
    'Passing TDs',
    'Rushing TDs',
    'Receptions',
    'Interceptions',
    'Sacks',
    'Field Goals Made',
  ],
  NHL: [
    'Goals',
    'Assists',
    'Points',
    'Shots on Goal',
    'Saves',
    'Penalty Minutes',
    'Power Play Points',
    'Plus/Minus',
  ],
};

export function ManualPropCreator({
  gameId,
  gameMatchup,
  sport,
  onPropCreated,
  onCancel,
}: ManualPropCreatorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [currentProp, setCurrentProp] = useState<Partial<ManualProp>>({
    player_name: '',
    team: '',
    prop_type: '',
    line: undefined,
    over_odds: -110,
    under_odds: -110,
    notes: '',
  });

  const sportPropTypes = PROP_TYPES[sport as keyof typeof PROP_TYPES] || PROP_TYPES.MLB;

  const handleCreateProp = () => {
    if (!currentProp.player_name || !currentProp.prop_type || !currentProp.team) {
      return;
    }

    const newProp: ManualProp = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      player_name: currentProp.player_name!,
      team: currentProp.team!,
      prop_type: currentProp.prop_type!,
      line: currentProp.line,
      over_odds: currentProp.over_odds || -110,
      under_odds: currentProp.under_odds || -110,
      notes: currentProp.notes,
    };

    onPropCreated(newProp);

    // Reset form
    setCurrentProp({
      player_name: '',
      team: '',
      prop_type: '',
      line: undefined,
      over_odds: -110,
      under_odds: -110,
      notes: '',
    });
  };

  const handleOverOddsChange = (value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setCurrentProp(prev => ({
        ...prev,
        over_odds: numValue,
      }));
    }
  };

  const handleUnderOddsChange = (value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setCurrentProp(prev => ({
        ...prev,
        under_odds: numValue,
      }));
    }
  };

  const isValid = currentProp.player_name && currentProp.prop_type && currentProp.team;

  return (
    <Card className="p-6 border-2 border-dashed border-primary/50">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Create Custom Prop</h3>
            <p className="text-sm text-muted-foreground">
              {gameMatchup} • {sport}
            </p>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            Manual Entry
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Player Name with Smart Search */}
          <div>
            <label className="text-sm font-medium mb-2 block">Player Name</label>
            <SmartPlayerInput
              value={currentProp.player_name || ''}
              sport={sport}
              onChange={(playerName, team) => {
                setCurrentProp(prev => ({
                  ...prev,
                  player_name: playerName,
                  team: team || prev.team,
                }));
              }}
              placeholder="e.g., Aaron Judge"
            />
          </div>

          {/* Team */}
          <div>
            <label className="text-sm font-medium mb-2 block">Team</label>
            <Input
              placeholder="e.g., NYY"
              value={currentProp.team || ''}
              onChange={e =>
                setCurrentProp(prev => ({
                  ...prev,
                  team: e.target.value.toUpperCase(),
                }))
              }
              maxLength={4}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Prop Type */}
          <div>
            <label className="text-sm font-medium mb-2 block">Prop Type</label>
            <Select
              value={currentProp.prop_type || ''}
              onValueChange={value =>
                setCurrentProp(prev => ({
                  ...prev,
                  prop_type: value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select prop type" />
              </SelectTrigger>
              <SelectContent>
                {sportPropTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Line (Optional) */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Line (Optional)
              <span className="text-xs text-muted-foreground ml-1">
                Leave empty for Yes/No props
              </span>
            </label>
            <Input
              type="number"
              step="0.5"
              placeholder="e.g., 1.5"
              value={currentProp.line || ''}
              onChange={e =>
                setCurrentProp(prev => ({
                  ...prev,
                  line: e.target.value ? parseFloat(e.target.value) : undefined,
                }))
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Over Odds */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Over Odds
              <span className="text-xs text-muted-foreground ml-1">
                {currentProp.line ? `Over ${currentProp.line}` : 'Over'}
              </span>
            </label>
            <Input
              type="number"
              placeholder="-110"
              value={currentProp.over_odds || ''}
              onChange={e => handleOverOddsChange(e.target.value)}
            />
          </div>

          {/* Under Odds */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Under Odds
              <span className="text-xs text-muted-foreground ml-1">
                {currentProp.line ? `Under ${currentProp.line}` : 'Under'}
              </span>
            </label>
            <Input
              type="number"
              placeholder="-110"
              value={currentProp.under_odds || ''}
              onChange={e => handleUnderOddsChange(e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
          <Textarea
            placeholder="Add any notes about this prop..."
            value={currentProp.notes || ''}
            onChange={e =>
              setCurrentProp(prev => ({
                ...prev,
                notes: e.target.value,
              }))
            }
            rows={2}
          />
        </div>

        {/* Preview */}
        {isValid && (
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Preview:</h4>
            <p className="text-sm">
              <strong>{currentProp.player_name}</strong> ({currentProp.team}) -{' '}
              {currentProp.prop_type}
              {currentProp.line && ` ${currentProp.line}`}
            </p>
            <div className="mt-2 text-sm space-y-1">
              <div className="flex gap-4">
                <span>
                  Over: {currentProp.over_odds && currentProp.over_odds > 0 ? '+' : ''}
                  {currentProp.over_odds}
                </span>
                <span>
                  Under: {currentProp.under_odds && currentProp.under_odds > 0 ? '+' : ''}
                  {currentProp.under_odds}
                </span>
              </div>
              {currentProp.line && (
                <div className="text-xs text-muted-foreground">Line: {currentProp.line}</div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleCreateProp} disabled={!isValid} className="flex-1">
            <Plus className="w-4 h-4 mr-2" />
            Add Prop
          </Button>
          <Button variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
