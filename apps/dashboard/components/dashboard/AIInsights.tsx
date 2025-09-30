'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Zap, Lightbulb } from 'lucide-react';

interface AI {
  insights: Array<{
    id: string;
    type: string;
    insight: string;
    confidence: number;
    timestamp: string;
  }>;
  recommendations: Array<{
    id: string;
    recommendation: string;
    reasoning: string;
    confidence: number;
  }>;
  coaching: Array<{ id: string; topic: string; advice: string; timestamp: string }>;
}

interface AIInsightsProps {
  ai: AI;
}

export function AIInsights({ ai }: { ai: AI }) {
  return (
    <div className="space-y-6">
      <Card className="bg-black/20 backdrop-blur-sm border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <span>AI Insights</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            AI-powered analysis and coaching
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Lightbulb className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">AI Insights</h3>
              <p className="text-gray-400 mb-4">
                Advanced AI analysis and coaching features coming soon
              </p>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Zap className="h-4 w-4 mr-2" />
                Ask AI Coach
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
