'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
// import { Slider } from '@/components/ui/slider';
import { OddsFormat } from '../types';

interface Step2ConfigurationProps {
  data: {
    unit_size?: number;
    odds_format?: OddsFormat;
    auto_parlay?: boolean;
    confidence_level?: number;
    ticket_type?: string;
  };
  onUpdate: (updates: any) => void;
  onNext: () => void;
  onBack: () => void;
  errors?: any;
}

const ODDS_FORMATS = [
  {
    value: 'AMERICAN' as OddsFormat,
    label: 'American',
    example: '(-110)',
    description: 'Most common in US',
  },
  {
    value: 'DECIMAL' as OddsFormat,
    label: 'Decimal',
    example: '(1.91)',
    description: 'Popular in Europe',
  },
  {
    value: 'FRACTIONAL' as OddsFormat,
    label: 'Fractional',
    example: '(10/11)',
    description: 'Traditional UK format',
  },
];

export function Step2Configuration({
  data,
  onUpdate,
  onNext,
  onBack,
  errors,
}: Step2ConfigurationProps) {
  const [unitSize, setUnitSize] = useState([data.unit_size || 2.0]);
  const [confidence, setConfidence] = useState(data.confidence_level || 7);

  // Unit size recommendations based on ticket type
  const getUnitRecommendation = () => {
    switch (data.ticket_type) {
      case 'single':
        return 'Recommended: 1.0-2.5 units for single bets';
      case 'parlay':
        return 'Recommended: 0.5-1.5 units for parlays (higher variance)';
      case 'teaser':
        return 'Recommended: 1.0-2.0 units for teasers';
      case 'round_robin':
        return 'Recommended: 0.5-1.0 units for round robins';
      default:
        return 'Choose your unit size based on confidence and risk tolerance';
    }
  };

  // Historical accuracy at confidence level
  const getConfidenceStats = (level: number) => {
    const accuracyMap: { [key: number]: { accuracy: number; description: string } } = {
      1: { accuracy: 45, description: 'Low confidence - experimental picks' },
      2: { accuracy: 50, description: 'Below average confidence' },
      3: { accuracy: 55, description: 'Moderate confidence' },
      4: { accuracy: 58, description: 'Moderate confidence' },
      5: { accuracy: 62, description: 'Average confidence' },
      6: { accuracy: 65, description: 'Good confidence' },
      7: { accuracy: 68, description: 'High confidence' },
      8: { accuracy: 73, description: 'Very high confidence' },
      9: { accuracy: 78, description: 'Extremely high confidence' },
      10: { accuracy: 82, description: 'Lock of the century' },
    };
    return accuracyMap[level] || { accuracy: 65, description: 'Average confidence' };
  };

  const handleUnitSizeChange = (value: number[]) => {
    setUnitSize(value);
    onUpdate({ unit_size: value[0] });
  };

  const handleOddsFormatChange = (format: OddsFormat) => {
    onUpdate({ odds_format: format });
  };

  const handleAutoParlayChange = (checked: boolean) => {
    onUpdate({ auto_parlay: checked });
  };

  const handleConfidenceChange = (level: number) => {
    setConfidence(level);
    onUpdate({ confidence_level: level });
  };

  const isValid = data.unit_size && data.odds_format !== undefined && data.confidence_level;
  const stats = getConfidenceStats(confidence);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">⚙️ Betting Configuration</h2>
        <p className="text-gray-600">Set your preferences and betting parameters</p>
      </div>

      {/* Unit Size */}
      <Card className="p-6 bg-white text-gray-900 border border-gray-200">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">💰 Unit Size</h3>
            <Badge variant="outline" className="text-sm bg-white text-gray-700 border-gray-300">
              Current: {unitSize[0]} units
            </Badge>
          </div>

          <div className="space-y-4">
            <div className="px-2">
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.5}
                value={unitSize[0]}
                onChange={e => handleUnitSizeChange([parseFloat(e.target.value)])}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-700 font-medium mt-2">
                <span>0.5</span>
                <span>2.5</span>
                <span>5.0</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <div className="text-sm text-blue-900 font-medium">💡 {getUnitRecommendation()}</div>
            </div>

            {/* Unit size impact */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <div className="text-sm font-semibold text-green-800">Conservative</div>
                <div className="text-xs text-green-700 font-medium">0.5-1.0 units</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                <div className="text-sm font-semibold text-yellow-800">Moderate</div>
                <div className="text-xs text-yellow-700 font-medium">1.5-2.5 units</div>
              </div>
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <div className="text-sm font-semibold text-red-800">Aggressive</div>
                <div className="text-xs text-red-700 font-medium">3.0-5.0 units</div>
              </div>
            </div>
          </div>

          {errors?.unit_size && <p className="text-sm text-red-600">{errors.unit_size}</p>}
        </div>
      </Card>

      {/* Odds Format */}
      <Card className="p-6 bg-white text-gray-900 border border-gray-200">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">📊 Odds Format</h3>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {ODDS_FORMATS.map(format => (
              <button
                key={format.value}
                onClick={() => handleOddsFormatChange(format.value)}
                className={`
                  p-4 rounded-lg border-2 transition-all duration-200 text-center
                  ${
                    data.odds_format === format.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }
                `}
              >
                <div className="font-semibold text-gray-900">{format.label}</div>
                <div className="text-sm text-gray-700 font-medium my-1">{format.example}</div>
                <div className="text-xs text-gray-600 font-medium">{format.description}</div>
              </button>
            ))}
          </div>

          {errors?.odds_format && <p className="text-sm text-red-600">{errors.odds_format}</p>}
        </div>
      </Card>

      {/* Auto Parlay & Confidence */}
      <Card className="p-6 bg-white text-gray-900 border border-gray-200">
        <div className="space-y-6">
          {/* Auto Parlay */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">🔄 Auto Parlay Building</h3>
              <Switch
                checked={data.auto_parlay || false}
                onCheckedChange={handleAutoParlayChange}
              />
            </div>

            <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
              <div className="text-sm text-purple-900 font-medium">
                💡{' '}
                {data.auto_parlay
                  ? "Smart suggestions enabled - we'll recommend correlated picks and optimal combinations"
                  : 'Manual mode - build your ticket step by step without suggestions'}
              </div>
            </div>
          </div>

          {/* Confidence Level */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">⭐ Confidence Level</h3>
              <Badge className="bg-blue-600 text-white border-blue-600">
                {confidence}/10 {confidence >= 8 ? 'High' : confidence >= 6 ? 'Medium' : 'Low'}
              </Badge>
            </div>

            {/* Star Rating */}
            <div className="flex items-center justify-center space-x-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
                <button
                  key={star}
                  onClick={() => handleConfidenceChange(star)}
                  className={`
                    text-2xl transition-all duration-200 hover:scale-110
                    ${star <= confidence ? 'text-yellow-400' : 'text-gray-300'}
                  `}
                >
                  ★
                </button>
              ))}
            </div>

            <div className="text-center bg-gray-50 border border-gray-200 p-3 rounded-lg">
              <div className="text-sm text-gray-800 font-medium">{stats.description}</div>
              <div className="text-xs text-green-700 font-semibold mt-1">
                🎯 Historical accuracy at this confidence: {stats.accuracy}%
              </div>
            </div>

            {errors?.confidence_level && (
              <p className="text-sm text-red-600 text-center">{errors.confidence_level}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline" className="px-8 py-3 text-lg font-semibold">
          ← Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="px-8 py-3 text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
        >
          Continue →
        </Button>
      </div>
    </div>
  );
}
