'use client';

import React from 'react';
import { CheckCircle, AlertTriangle, TrendingUp, Brain, Shield, Clock } from 'lucide-react';

interface InsightData {
  systemGrade: string;
  systemConfidence: number;
  capperConfidence: number;
  expectedValue: number;
  riskFactors: string[];
  marketIntelligence: string;
  timestamp: string;
}

interface SubmissionInsightsProps {
  insights: InsightData;
  capper: string;
  ticketId: string;
  onClose: () => void;
}

/**
 * Post-submission insights component
 * Shows system analysis immediately after capper submits pick
 */
export default function SubmissionInsights({
  insights,
  capper,
  ticketId,
  onClose,
}: SubmissionInsightsProps) {
  const getGradeColor = (grade: string) => {
    switch (grade.split('-')[0]) {
      case 'S':
        return 'text-purple-600 bg-purple-100';
      case 'A':
        return 'text-green-600 bg-green-100';
      case 'B':
        return 'text-blue-600 bg-blue-100';
      case 'C':
        return 'text-yellow-600 bg-yellow-100';
      case 'D':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceMatch = () => {
    const diff = Math.abs(insights.systemConfidence - insights.capperConfidence);
    if (diff <= 10) return { status: 'excellent', color: 'text-green-600', icon: CheckCircle };
    if (diff <= 20) return { status: 'good', color: 'text-blue-600', icon: TrendingUp };
    return { status: 'divergent', color: 'text-yellow-600', icon: AlertTriangle };
  };

  const confidenceMatch = getConfidenceMatch();
  const ConfidenceIcon = confidenceMatch.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Brain className="w-6 h-6" />
                System Analysis Complete
              </h2>
              <p className="text-blue-100 mt-1">
                Pick submitted by {capper} • {new Date(insights.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 transition-colors text-2xl font-light"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Success Message */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-800">Pick Successfully Submitted!</h3>
                <p className="text-green-700 text-sm">
                  Ticket ID: <span className="font-mono">{ticketId}</span>
                </p>
              </div>
            </div>
          </div>

          {/* System Grade */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              System Grade Analysis
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <span
                  className={`inline-block px-4 py-2 rounded-full font-bold text-lg ${getGradeColor(insights.systemGrade)}`}
                >
                  {insights.systemGrade}
                </span>
                <p className="text-sm text-gray-600 mt-2">
                  Based on our Fortune 100-level ML ensemble analysis
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{insights.systemConfidence}%</div>
                <div className="text-sm text-gray-600">System Confidence</div>
              </div>
            </div>
          </div>

          {/* Confidence Comparison */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <ConfidenceIcon className={`w-5 h-5 ${confidenceMatch.color}`} />
              Confidence Analysis
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600">{insights.capperConfidence}%</div>
                <div className="text-sm text-gray-600">Your Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600">
                  {insights.systemConfidence}%
                </div>
                <div className="text-sm text-gray-600">System Confidence</div>
              </div>
            </div>
            <div
              className={`mt-3 p-3 rounded-lg ${confidenceMatch.color.replace('text-', 'bg-').replace('600', '50')} border ${confidenceMatch.color.replace('text-', 'border-').replace('600', '200')}`}
            >
              <p className={`text-sm font-medium ${confidenceMatch.color}`}>
                {confidenceMatch.status === 'excellent' &&
                  '🎯 Excellent alignment with system analysis!'}
                {confidenceMatch.status === 'good' &&
                  '👍 Good confidence alignment with our models'}
                {confidenceMatch.status === 'divergent' &&
                  '🤔 Confidence divergence detected - consider risk factors'}
              </p>
            </div>
          </div>

          {/* Expected Value */}
          {insights.expectedValue !== 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Expected Value
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className={`text-2xl font-bold ${insights.expectedValue > 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {insights.expectedValue > 0 ? '+' : ''}
                    {insights.expectedValue.toFixed(2)}%
                  </span>
                  <p className="text-sm text-gray-600 mt-1">Long-term expected return per unit</p>
                </div>
                <div className="text-xs text-gray-500 bg-white px-3 py-2 rounded-lg">
                  Based on closing line value analysis
                </div>
              </div>
            </div>
          )}

          {/* Risk Factors */}
          {insights.riskFactors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Risk Factors Detected
              </h3>
              <ul className="space-y-2">
                {insights.riskFactors.map((factor, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-yellow-700">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></span>
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Market Intelligence */}
          {insights.marketIntelligence &&
            insights.marketIntelligence !== 'No specific intelligence' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Market Intelligence
                </h3>
                <p className="text-blue-700 text-sm leading-relaxed">
                  {insights.marketIntelligence}
                </p>
              </div>
            )}

          {/* Next Steps */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              What Happens Next
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Your pick is automatically approved and queued for posting</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Daily picks post at 10:00 AM EST to your dedicated thread</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Live picks are posted immediately upon submission</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Results will be tracked and included in tomorrow's recap</span>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
