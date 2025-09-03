// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Brain, 
  TrendingUp, 
  BarChart3, 
  Activity, 
  DollarSign,
  Target,
  Zap,
  Database,
  Cpu,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Download,
  Bot,
  LineChart,
  PieChart,
  Calendar
} from 'lucide-react'

// Advanced Phase D Analytics Data
const phaseDData = {
  aiInsights: {
    predictionAccuracy: 89.7,
    modelConfidence: 94.2,
    trainingData: 150000,
    lastTraining: new Date(Date.now() - 3600000),
    nextUpdate: new Date(Date.now() + 7200000)
  },
  marketAnalysis: {
    totalMarkets: 47,
    activeMarkets: 32,
    closedMarkets: 15,
    upcomingMarkets: 12,
    avgOddsMovement: 2.3,
    sharpMoney: 67.8
  },
  performance: {
    systemUptime: 99.97,
    apiLatency: 45,
    dataFreshness: 98.5,
    errorRate: 0.03,
    throughput: 15420
  },
  mlModels: [
    {
      name: 'NFL Over/Under Predictor',
      accuracy: 87.4,
      confidence: 92.1,
      lastTrained: '2 hours ago',
      status: 'active',
      predictions: 2847
    },
    {
      name: 'NBA Spread Analyzer',
      accuracy: 83.2,
      confidence: 89.7,
      lastTrained: '4 hours ago', 
      status: 'active',
      predictions: 1923
    },
    {
      name: 'MLB Run Line Engine',
      accuracy: 79.8,
      confidence: 85.3,
      lastTrained: '6 hours ago',
      status: 'training',
      predictions: 1456
    },
    {
      name: 'Soccer Goal Predictor',
      accuracy: 91.2,
      confidence: 96.4,
      lastTrained: '1 hour ago',
      status: 'active',
      predictions: 3241
    }
  ],
  liveData: [
    {
      market: 'NFL - Chiefs vs Bills',
      prediction: 'Under 47.5',
      confidence: 87.3,
      currentOdds: -110,
      recommendedOdds: -105,
      edge: 2.1,
      status: 'strong'
    },
    {
      market: 'NBA - Lakers vs Warriors',
      prediction: 'Lakers +4.5',
      confidence: 79.2,
      currentOdds: -108,
      recommendedOdds: -102,
      edge: 1.8,
      status: 'moderate'
    },
    {
      market: 'MLB - Dodgers vs Padres',
      prediction: 'Over 8.5',
      confidence: 92.1,
      currentOdds: -115,
      recommendedOdds: -108,
      edge: 3.2,
      status: 'strong'
    }
  ],
  dataStreams: {
    oddsProviders: 12,
    newsFeeds: 8,
    socialSentiment: 15,
    weatherData: true,
    injuryReports: true,
    lineupData: true
  }
}

function getModelStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'training':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'error':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

function getEdgeColor(edge: number) {
  if (edge >= 3) return 'text-green-400'
  if (edge >= 2) return 'text-yellow-400'
  return 'text-orange-400'
}

export default function PhaseDPage() {
  const [selectedTab, setSelectedTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(true)

  const handleRefresh = async () => {
    setIsLoading(true)
    // Simulate Phase D API refresh
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center">
            <Brain className="w-8 h-8 mr-3 text-purple-500" />
            Phase D Analytics
          </h1>
          <p className="text-muted-foreground">
            Advanced AI-powered sports betting intelligence and predictive analytics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Sync Models
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <Card className={isConnected ? "border-green-500/20 bg-green-500/10" : "border-red-500/20 bg-red-500/10"}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            {isConnected ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-500" />
            )}
            <div>
              <p className={`font-semibold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                Phase D Engine: {isConnected ? 'Connected' : 'Disconnected'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isConnected 
                  ? `${phaseDData.mlModels.length} AI models running • Real-time data streaming active`
                  : 'Connection to Phase D analytics engine lost • Attempting reconnection...'
                }
              </p>
            </div>
          </div>
          <Badge variant="outline" className={isConnected ? "text-green-400 border-green-500/20" : "text-red-400 border-red-500/20"}>
            {isConnected ? 'Live' : 'Offline'}
          </Badge>
        </CardContent>
      </Card>

      {/* AI Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Accuracy</CardTitle>
            <Brain className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{phaseDData.aiInsights.predictionAccuracy}%</div>
            <Progress value={phaseDData.aiInsights.predictionAccuracy} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Prediction accuracy rate
            </p>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Model Confidence</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{phaseDData.aiInsights.modelConfidence}%</div>
            <Progress value={phaseDData.aiInsights.modelConfidence} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Average model confidence
            </p>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Markets</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{phaseDData.marketAnalysis.activeMarkets}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <span>of {phaseDData.marketAnalysis.totalMarkets} total</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Markets being analyzed
            </p>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{phaseDData.performance.systemUptime}%</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <span className="text-green-500">Uptime</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              System uptime
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Phase D Analytics Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced AI Analytics</CardTitle>
          <CardDescription>
            Deep learning models and predictive intelligence for sports betting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">AI Overview</TabsTrigger>
              <TabsTrigger value="models">ML Models</TabsTrigger>
              <TabsTrigger value="predictions">Live Predictions</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* AI Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle>AI Engine Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Training Data Points</span>
                      <span className="font-mono font-bold">
                        {phaseDData.aiInsights.trainingData.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Last Training</span>
                      <span className="font-mono text-sm">
                        {new Date(phaseDData.aiInsights.lastTraining).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Next Model Update</span>
                      <span className="font-mono text-sm">
                        {new Date(phaseDData.aiInsights.nextUpdate).toLocaleTimeString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Data Streams */}
                <Card>
                  <CardHeader>
                    <CardTitle>Data Stream Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Odds Providers</span>
                      <Badge variant="outline" className="text-green-400 border-green-500/30">
                        {phaseDData.dataStreams.oddsProviders} Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>News Feeds</span>
                      <Badge variant="outline" className="text-green-400 border-green-500/30">
                        {phaseDData.dataStreams.newsFeeds} Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Social Sentiment</span>
                      <Badge variant="outline" className="text-green-400 border-green-500/30">
                        {phaseDData.dataStreams.socialSentiment} Sources
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Weather Data</span>
                      <Badge variant="outline" className="text-green-400 border-green-500/30">
                        Connected
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="models" className="mt-6">
              <div className="space-y-4">
                {phaseDData.mlModels.map((model, index) => (
                  <Card key={index} className="border-l-4 border-l-purple-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Bot className="w-8 h-8 text-purple-500" />
                          <div>
                            <h4 className="font-semibold">{model.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Last trained: {model.lastTrained}
                            </p>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <Badge variant="outline" className={getModelStatusColor(model.status)}>
                            {model.status}
                          </Badge>
                          <div className="text-sm text-muted-foreground">
                            {model.predictions.toLocaleString()} predictions
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Accuracy</div>
                          <div className="text-2xl font-bold text-green-400">{model.accuracy}%</div>
                          <Progress value={model.accuracy} className="mt-1" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Confidence</div>
                          <div className="text-2xl font-bold text-blue-400">{model.confidence}%</div>
                          <Progress value={model.confidence} className="mt-1" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="predictions" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Live AI Predictions</h3>
                  <Badge variant="outline" className="text-green-400 border-green-500/30">
                    {phaseDData.liveData.length} Active
                  </Badge>
                </div>
                {phaseDData.liveData.map((prediction, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{prediction.market}</h4>
                          <p className="text-lg text-blue-400 font-bold mt-1">
                            {prediction.prediction}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                            <span>Confidence: {prediction.confidence}%</span>
                            <span>Current: {prediction.currentOdds}</span>
                            <span>Recommended: {prediction.recommendedOdds}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Edge</div>
                          <div className={`text-2xl font-bold ${getEdgeColor(prediction.edge)}`}>
                            +{prediction.edge}%
                          </div>
                          <Badge variant="outline" className="mt-2">
                            {prediction.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="performance" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>System Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>API Latency</span>
                        <span>{phaseDData.performance.apiLatency}ms</span>
                      </div>
                      <Progress value={100 - (phaseDData.performance.apiLatency / 2)} className="mt-1" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Data Freshness</span>
                        <span>{phaseDData.performance.dataFreshness}%</span>
                      </div>
                      <Progress value={phaseDData.performance.dataFreshness} className="mt-1" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm">
                        <span>Error Rate</span>
                        <span>{phaseDData.performance.errorRate}%</span>
                      </div>
                      <Progress value={100 - (phaseDData.performance.errorRate * 33)} className="mt-1" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Throughput Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-green-400">
                        {phaseDData.performance.throughput.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Predictions per hour
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Current processing rate
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}