'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  X,
  TrendingUp,
  Target,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Layers,
} from 'lucide-react';

interface ComboPlayBuilderProps {
  picks: any[];
  onComboCreate?: (combo: any) => void;
}

interface ComboPick {
  id: string;
  capper: string;
  selection: string;
  odds: number;
  confidence: number;
  tier: string;
  sport: string;
}

export function ComboPlayBuilder({ picks, onComboCreate }: ComboPlayBuilderProps) {
  const [selectedPicks, setSelectedPicks] = useState<ComboPick[]>([]);
  const [comboType, setComboType] = useState<'parlay' | 'round_robin' | 'teaser'>('parlay');

  const availablePicks = useMemo(() => {
    return picks
      .filter(pick => pick.status === 'approved' && pick.confidence >= 60)
      .map(pick => ({
        id: pick.id,
        capper: pick.capper,
        selection: pick.selection || `${pick.player_name || pick.line}`,
        odds: pick.odds,
        confidence: pick.confidence || 0,
        tier: pick.tier || 'C',
        sport: pick.sport || 'Unknown',
      }))
      .slice(0, 20); // Limit for display
  }, [picks]);

  const comboAnalysis = useMemo(() => {
    if (selectedPicks.length < 2) return null;

    // Calculate combined odds
    const combinedOdds = selectedPicks.reduce((total, pick) => {
      const decimalOdds = pick.odds > 0 ? pick.odds / 100 + 1 : 100 / Math.abs(pick.odds) + 1;
      return total * decimalOdds;
    }, 1);

    const americanOdds =
      combinedOdds >= 2
        ? Math.round((combinedOdds - 1) * 100)
        : Math.round(-100 / (combinedOdds - 1));

    // Calculate combined probability
    const individualProbs = selectedPicks.map(pick => {
      const odds = Math.abs(pick.odds);
      return pick.odds > 0 ? 100 / (odds + 100) : odds / (odds + 100);
    });

    const combinedProb = individualProbs.reduce((total, prob) => total * prob, 1);
    const impliedWinRate = combinedProb * 100;

    // Calculate average confidence
    const avgConfidence =
      selectedPicks.reduce((sum, pick) => sum + pick.confidence, 0) / selectedPicks.length;

    // Calculate expected value
    const payout = combinedOdds - 1;
    const expectedValue = combinedProb * payout - (1 - combinedProb);

    // Risk assessment
    const riskLevel =
      selectedPicks.length > 4 ? 'high' : selectedPicks.length > 2 ? 'medium' : 'low';

    const hasLowTier = selectedPicks.some(pick => pick.tier === 'C' || pick.tier === 'D');
    const sportsCount = new Set(selectedPicks.map(pick => pick.sport)).size;

    return {
      combinedOdds: americanOdds,
      impliedWinRate: Math.round(impliedWinRate * 100) / 100,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      expectedValue: Math.round(expectedValue * 10000) / 10000,
      riskLevel,
      hasLowTier,
      sportsCount,
      payout: Math.round(payout * 100) / 100,
    };
  }, [selectedPicks]);

  const addPick = (pick: ComboPick) => {
    if (selectedPicks.find(p => p.id === pick.id)) return;
    if (selectedPicks.length >= 8) return; // Max combo size

    setSelectedPicks([...selectedPicks, pick]);
  };

  const removePick = (pickId: string) => {
    setSelectedPicks(selectedPicks.filter(p => p.id !== pickId));
  };

  const createCombo = () => {
    if (!comboAnalysis || selectedPicks.length < 2) return;

    const combo = {
      id: `combo-${Date.now()}`,
      type: comboType,
      picks: selectedPicks,
      analysis: comboAnalysis,
      createdAt: new Date().toISOString(),
    };

    onComboCreate?.(combo);
    setSelectedPicks([]);
  };

  return (
    <div className="space-y-6">
      {/* Combo Builder Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Layers className="w-5 h-5 mr-2" />
            Combo Play Builder
          </CardTitle>
          <CardDescription>
            Build and analyze multi-pick combinations with professional risk assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Combo Type:</span>
              <select
                value={comboType}
                onChange={e => setComboType(e.target.value as any)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="parlay">Parlay</option>
                <option value="round_robin">Round Robin</option>
                <option value="teaser">Teaser</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Selected:</span>
              <Badge variant="outline">{selectedPicks.length}/8</Badge>
            </div>

            {selectedPicks.length >= 2 && (
              <Button onClick={createCombo} className="ml-auto">
                <CheckCircle className="w-4 h-4 mr-2" />
                Create Combo
              </Button>
            )}
          </div>

          {/* Selected Picks */}
          {selectedPicks.length > 0 && (
            <div className="space-y-2 mb-6">
              <h4 className="font-medium">Selected Picks</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedPicks.map(pick => (
                  <div
                    key={pick.id}
                    className="flex items-center justify-between p-2 rounded border bg-blue-50"
                  >
                    <div className="flex items-center space-x-2">
                      <Badge className={getTierColor(pick.tier)}>{pick.tier}</Badge>
                      <span className="text-sm font-medium">{pick.capper}</span>
                      <span className="text-sm text-muted-foreground">{pick.selection}</span>
                      <Badge variant="outline">
                        {pick.odds > 0 ? '+' : ''}
                        {pick.odds}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePick(pick.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Combo Analysis */}
          {comboAnalysis && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <div className="p-3 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Combined Odds</div>
                <div className="text-lg font-bold">
                  {comboAnalysis.combinedOdds > 0 ? '+' : ''}
                  {comboAnalysis.combinedOdds}
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Win Probability</div>
                <div className="text-lg font-bold">{comboAnalysis.impliedWinRate}%</div>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Expected Value</div>
                <div
                  className={`text-lg font-bold ${
                    comboAnalysis.expectedValue > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {comboAnalysis.expectedValue > 0 ? '+' : ''}
                  {(comboAnalysis.expectedValue * 100).toFixed(1)}%
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20">
                <div className="text-sm text-muted-foreground">Risk Level</div>
                <Badge
                  className={
                    comboAnalysis.riskLevel === 'high'
                      ? 'bg-red-100 text-red-800'
                      : comboAnalysis.riskLevel === 'medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                  }
                >
                  {comboAnalysis.riskLevel.toUpperCase()}
                </Badge>
              </div>
            </div>
          )}

          {/* Risk Warnings */}
          {comboAnalysis && (
            <div className="space-y-2 mb-6">
              {comboAnalysis.hasLowTier && (
                <div className="flex items-center space-x-2 p-2 rounded bg-yellow-50 border border-yellow-200">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">Combo includes C or D tier picks</span>
                </div>
              )}

              {selectedPicks.length > 5 && (
                <div className="flex items-center space-x-2 p-2 rounded bg-red-50 border border-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-800">
                    High-leg combos have exponentially lower win rates
                  </span>
                </div>
              )}

              {comboAnalysis.expectedValue < -0.1 && (
                <div className="flex items-center space-x-2 p-2 rounded bg-red-50 border border-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-800">
                    Negative expected value - not recommended
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Picks */}
      <Card>
        <CardHeader>
          <CardTitle>Available Picks for Combo</CardTitle>
          <CardDescription>High-confidence approved picks ready for combination</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-2">
            {availablePicks.length > 0 ? (
              availablePicks.map(pick => (
                <div
                  key={pick.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPicks.find(p => p.id === pick.id)
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-muted/20 hover:bg-muted/30'
                  }`}
                  onClick={() =>
                    selectedPicks.find(p => p.id === pick.id) ? removePick(pick.id) : addPick(pick)
                  }
                >
                  <div className="flex items-center space-x-3">
                    <Badge className={getTierColor(pick.tier)}>{pick.tier}</Badge>
                    <div>
                      <p className="font-medium">{pick.capper}</p>
                      <p className="text-sm text-muted-foreground">{pick.selection}</p>
                      <p className="text-xs text-muted-foreground">{pick.sport}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        {pick.odds > 0 ? '+' : ''}
                        {pick.odds}
                      </Badge>
                      <div className="text-xs text-muted-foreground">{pick.confidence}% conf</div>
                    </div>
                    {selectedPicks.find(p => p.id === pick.id) ? (
                      <CheckCircle className="w-4 h-4 text-blue-600 mt-1" />
                    ) : (
                      <Plus className="w-4 h-4 text-muted-foreground mt-1" />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center py-8 text-muted-foreground">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No high-confidence picks available for combo building</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Combo Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Combo Performance History</CardTitle>
          <CardDescription>Historical performance of combination plays</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg border bg-muted/20">
              <div className="text-2xl font-bold">127</div>
              <div className="text-sm text-muted-foreground">Total Combos</div>
              <div className="text-xs text-muted-foreground mt-1">This month</div>
            </div>

            <div className="text-center p-4 rounded-lg border bg-muted/20">
              <div className="text-2xl font-bold text-green-600">23%</div>
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="text-xs text-muted-foreground mt-1">Above average</div>
            </div>

            <div className="text-center p-4 rounded-lg border bg-muted/20">
              <div className="text-2xl font-bold text-blue-600">+$2,847</div>
              <div className="text-sm text-muted-foreground">Net Profit</div>
              <div className="text-xs text-muted-foreground mt-1">This month</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function for tier colors (reused from CLVChart)
function getTierColor(tier: string) {
  switch (tier) {
    case 'S':
      return 'bg-purple-100 text-purple-800';
    case 'A':
      return 'bg-blue-100 text-blue-800';
    case 'B':
      return 'bg-green-100 text-green-800';
    case 'C':
      return 'bg-yellow-100 text-yellow-800';
    case 'D':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
