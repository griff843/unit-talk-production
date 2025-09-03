'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, TrendingUp, BarChart3 } from 'lucide-react';

interface Portfolio {
  totalValue: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  allocation: Array<{ sport: string; percentage: number; value: number }>;
  riskMetrics: {
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
    var: number;
  };
}

interface PortfolioManagerProps {
  portfolio: Portfolio;
}

export function PortfolioManager({ portfolio }: PortfolioManagerProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-black/20 backdrop-blur-sm border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Wallet className="h-5 w-5 text-green-500" />
            <span>Portfolio Manager</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Advanced portfolio tracking and risk management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <BarChart3 className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Portfolio Manager</h3>
              <p className="text-gray-400 mb-4">
                Professional portfolio management features coming soon
              </p>
              <Button className="bg-green-600 hover:bg-green-700">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Portfolio
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
