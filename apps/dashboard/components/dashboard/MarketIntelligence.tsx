'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Flame, TrendingUp, BarChart3 } from 'lucide-react';

interface Market {
  heatSignals: Array<{
    id: string;
    sport: string;
    signal: string;
    confidence: number;
    timestamp: string;
  }>;
  trendingPicks: Array<{
    id: string;
    capper: string;
    pick: string;
    confidence: number;
    timestamp: string;
  }>;
  edgeOpportunities: Array<{
    id: string;
    sport: string;
    opportunity: string;
    edge: number;
    timestamp: string;
  }>;
}

interface MarketIntelligenceProps {
  market: Market;
}

export function MarketIntelligence({ market }: MarketIntelligenceProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-black/20 backdrop-blur-sm border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <span>Market Intelligence</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Real-time market analysis and heat signals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <BarChart3 className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Market Intelligence</h3>
              <p className="text-gray-400 mb-4">
                Advanced market analysis and heat signals coming soon
              </p>
              <Button className="bg-orange-600 hover:bg-orange-700">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Heat Signals
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
