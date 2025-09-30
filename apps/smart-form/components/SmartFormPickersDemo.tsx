'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { PlayerPicker } from './PlayerPicker';
import { MarketPicker } from './MarketPicker';
import { GamePicker } from './GamePicker';
import {
  type PlayerOption,
  type MarketOption,
  type GameOption,
  SUPPORTED_SPORTS,
  SUPPORTED_TIERS
} from '@unit-talk/shared-forms';

interface FormData {
  sport?: string;
  player?: string;
  markets?: string[];
  game?: string;
  tier?: string[];
}

/**
 * SmartFormPickersDemo - Demonstrates the unified picker components
 * Shows integration with view_props_for_form and cache-first architecture
 */
export function SmartFormPickersDemo() {
  const [formData, setFormData] = useState<FormData>({
    markets: [],
    tier: [],
  });

  const [selectedPlayerOption, setSelectedPlayerOption] = useState<PlayerOption | null>(null);
  const [selectedMarketOptions, setSelectedMarketOptions] = useState<MarketOption[]>([]);
  const [selectedGameOption, setSelectedGameOption] = useState<GameOption | null>(null);

  const queryClient = useQueryClient();

  // Handle form field changes
  const handleSportChange = (sport: string) => {
    setFormData(prev => ({ ...prev, sport }));

    // Clear dependent fields when sport changes
    setFormData(prev => ({
      ...prev,
      player: undefined,
      markets: [],
      game: undefined
    }));
    setSelectedPlayerOption(null);
    setSelectedMarketOptions([]);
    setSelectedGameOption(null);

    // Invalidate related queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['player-autocomplete'] });
    queryClient.invalidateQueries({ queryKey: ['market-autocomplete'] });
    queryClient.invalidateQueries({ queryKey: ['game-autocomplete'] });
  };

  const handlePlayerChange = (playerName: string, option?: PlayerOption) => {
    setFormData(prev => ({ ...prev, player: playerName }));
    setSelectedPlayerOption(option || null);

    // Invalidate market queries to show player-specific markets
    queryClient.invalidateQueries({ queryKey: ['market-autocomplete'] });
  };

  const handleMarketsChange = (markets: string[], options?: MarketOption[]) => {
    setFormData(prev => ({ ...prev, markets }));
    setSelectedMarketOptions(options || []);
  };

  const handleGameChange = (gameId: string, option?: GameOption) => {
    setFormData(prev => ({ ...prev, game: gameId }));
    setSelectedGameOption(option || null);
  };

  const handleTierChange = (tier: string) => {
    const currentTiers = formData.tier || [];
    const newTiers = currentTiers.includes(tier)
      ? currentTiers.filter(t => t !== tier)
      : [...currentTiers, tier];

    setFormData(prev => ({ ...prev, tier: newTiers }));

    // Invalidate player queries to apply tier filter
    queryClient.invalidateQueries({ queryKey: ['player-autocomplete'] });
  };

  const handleReset = () => {
    setFormData({ markets: [], tier: [] });
    setSelectedPlayerOption(null);
    setSelectedMarketOptions([]);
    setSelectedGameOption(null);
  };

  const handleSubmit = () => {
    const submissionData = {
      sport: formData.sport,
      player: formData.player,
      playerDetails: selectedPlayerOption?.metadata,
      markets: formData.markets,
      marketDetails: selectedMarketOptions.map(m => m.metadata),
      game: formData.game,
      gameDetails: selectedGameOption?.metadata,
      filters: {
        tier: formData.tier,
      },
    };

    console.log('🚀 Smart Form Submission:', submissionData);
    alert('Form data logged to console. Check developer tools.');
  };

  const isFormValid = formData.sport && formData.player && formData.markets?.length && formData.game;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Smart Form Pickers Demo</h1>
        <p className="text-muted-foreground">
          Unified picker components with view_props_for_form and cache-first architecture
        </p>
        <div className="flex justify-center gap-2">
          <Badge variant="secondary">Sub-200ms performance</Badge>
          <Badge variant="secondary">L1/L2/L3 caching</Badge>
          <Badge variant="secondary">Real-time validation</Badge>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sport Selection */}
          <div className="space-y-2">
            <Label htmlFor="sport">Sport *</Label>
            <Select value={formData.sport} onValueChange={handleSportChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a sport" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_SPORTS.map((sport) => (
                  <SelectItem key={sport} value={sport}>
                    {sport}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tier Filters */}
          <div className="space-y-2">
            <Label>Tier Filters (Optional)</Label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_TIERS.map((tier) => (
                <Button
                  key={tier}
                  variant={formData.tier?.includes(tier) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTierChange(tier)}
                >
                  Tier {tier}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-6">
          {/* Player Picker */}
          <div className="space-y-2">
            <Label htmlFor="player">Player Selection *</Label>
            <PlayerPicker
              value={formData.player}
              onChange={handlePlayerChange}
              sport={formData.sport}
              tier={formData.tier}
              disabled={!formData.sport}
              placeholder={
                formData.sport
                  ? `Search ${formData.sport} players...`
                  : "Select a sport first"
              }
              required
            />
            {selectedPlayerOption && (
              <div className="mt-2 text-sm text-muted-foreground">
                Selected: {selectedPlayerOption.label} • {selectedPlayerOption.metadata.recent_props} recent props
                {selectedPlayerOption.metadata.tier && ` • Tier ${selectedPlayerOption.metadata.tier}`}
              </div>
            )}
          </div>

          {/* Market Picker */}
          <div className="space-y-2">
            <Label htmlFor="markets">Market Selection *</Label>
            <MarketPicker
              value={formData.markets}
              onChange={handleMarketsChange}
              sport={formData.sport}
              playerName={formData.player}
              disabled={!formData.sport}
              placeholder={
                formData.sport
                  ? `Search ${formData.sport} markets...`
                  : "Select a sport first"
              }
              maxSelections={5}
              required
            />
            {selectedMarketOptions.length > 0 && (
              <div className="mt-2 text-sm text-muted-foreground">
                Selected markets with {selectedMarketOptions.reduce((sum, m) => sum + m.metadata.prop_count, 0)} total props
              </div>
            )}
          </div>

          {/* Game Picker */}
          <div className="space-y-2">
            <Label htmlFor="game">Game Selection *</Label>
            <GamePicker
              value={formData.game}
              onChange={handleGameChange}
              sport={formData.sport}
              dateRange="week"
              disabled={!formData.sport}
              placeholder={
                formData.sport
                  ? `Search ${formData.sport} games...`
                  : "Select a sport first"
              }
              required
            />
            {selectedGameOption && (
              <div className="mt-2 text-sm text-muted-foreground">
                Selected: {selectedGameOption.metadata.matchup} • {selectedGameOption.metadata.prop_count} props available
              </div>
            )}
          </div>
        </div>

        <Separator className="my-6" />

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="flex-1"
          >
            Submit Form Data
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
          >
            Reset
          </Button>
        </div>
      </Card>

      {/* Debug Information */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Form State Debug</h3>
        <div className="space-y-2">
          <div className="text-sm">
            <span className="font-medium">Sport:</span> {formData.sport || 'None'}
          </div>
          <div className="text-sm">
            <span className="font-medium">Player:</span> {formData.player || 'None'}
          </div>
          <div className="text-sm">
            <span className="font-medium">Markets:</span> {formData.markets?.join(', ') || 'None'}
          </div>
          <div className="text-sm">
            <span className="font-medium">Game:</span> {formData.game || 'None'}
          </div>
          <div className="text-sm">
            <span className="font-medium">Tier Filters:</span> {formData.tier?.join(', ') || 'None'}
          </div>
          <div className="text-sm">
            <span className="font-medium">Form Valid:</span>
            <Badge variant={isFormValid ? "default" : "secondary"} className="ml-2">
              {isFormValid ? "Valid" : "Invalid"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Performance Information */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-2">
            <div className="font-medium text-green-600">⚡ Sub-200ms Response</div>
            <ul className="text-muted-foreground space-y-1">
              <li>• 300ms debounced input</li>
              <li>• Optimized database view</li>
              <li>• Smart query batching</li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-blue-600">🏠 Multi-Level Caching</div>
            <ul className="text-muted-foreground space-y-1">
              <li>• L1: In-memory (30s TTL)</li>
              <li>• L2: Redis (5min TTL)</li>
              <li>• L3: Database fallback</li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-purple-600">🎯 Smart Features</div>
            <ul className="text-muted-foreground space-y-1">
              <li>• Intelligent filtering</li>
              <li>• Real-time validation</li>
              <li>• Cross-field dependencies</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}