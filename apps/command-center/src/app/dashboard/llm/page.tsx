'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Brain, 
  MessageCircle, 
  Zap, 
  Activity,
  Settings,
  Send,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  TrendingUp,
  Bot,
  Cpu
} from 'lucide-react'
import { toast } from 'sonner'

interface LLMModel {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'local'
  status: 'active' | 'inactive' | 'error'
  tokensUsed: number
  tokensLimit: number
  requestsToday: number
  avgResponseTime: number
  cost: number
  accuracy: number
  lastUsed: string
  configuration: {
    temperature: number
    maxTokens: number
    topP: number
    frequencyPenalty: number
  }
}

interface LLMRequest {
  id: string
  model: string
  prompt: string
  response?: string
  tokens: number
  cost: number
  responseTime: number
  status: 'pending' | 'completed' | 'error'
  timestamp: string
  user: string
  type: 'pick-analysis' | 'market-research' | 'user-query' | 'system'
}

export default function LLMManagementPage() {
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [testPrompt, setTestPrompt] = useState('')
  const [selectedTab, setSelectedTab] = useState('overview')
  const queryClient = useQueryClient()

  // Fetch LLM models
  const { data: models = [], isLoading: modelsLoading, error: modelsError } = useQuery<LLMModel[]>({
    queryKey: ['llm-models'],
    queryFn: async () => {
      const response = await fetch('/api/llm/models')
      if (!response.ok) throw new Error('Failed to fetch LLM models')
      return response.json()
    },
    refetchInterval: 30000 // Update every 30 seconds
  })

  // Fetch recent LLM requests
  const { data: requests = [], isLoading: requestsLoading } = useQuery<LLMRequest[]>({
    queryKey: ['llm-requests'],
    queryFn: async () => {
      const response = await fetch('/api/llm/requests')
      if (!response.ok) throw new Error('Failed to fetch LLM requests')
      return response.json()
    },
    refetchInterval: 10000 // Update every 10 seconds
  })

  // Test LLM mutation
  const testModelMutation = useMutation({
    mutationFn: async ({ modelId, prompt }: { modelId: string, prompt: string }) => {
      const response = await fetch('/api/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId, prompt })
      })
      if (!response.ok) throw new Error('Failed to test model')
      return response.json()
    },
    onSuccess: (data) => {
      toast.success(`Model test completed in ${data.responseTime}ms`)
      queryClient.invalidateQueries({ queryKey: ['llm-requests'] })
    },
    onError: (error) => {
      toast.error(`Model test failed: ${error.message}`)
    }
  })

  // Update model configuration mutation
  const updateModelMutation = useMutation({
    mutationFn: async ({ modelId, configuration }: { modelId: string, configuration: any }) => {
      const response = await fetch(`/api/llm/models/${modelId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configuration)
      })
      if (!response.ok) throw new Error('Failed to update model configuration')
      return response.json()
    },
    onSuccess: () => {
      toast.success('Model configuration updated')
      queryClient.invalidateQueries({ queryKey: ['llm-models'] })
    },
    onError: (error) => {
      toast.error(`Configuration update failed: ${error.message}`)
    }
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'inactive': return 'bg-gray-500' 
      case 'error': return 'bg-red-500'
      case 'pending': return 'bg-yellow-500'
      case 'completed': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai': return <Brain className="w-4 h-4" />
      case 'anthropic': return <MessageCircle className="w-4 h-4" />
      case 'local': return <Cpu className="w-4 h-4" />
      default: return <Bot className="w-4 h-4" />
    }
  }

  const totalTokensUsed = models.reduce((sum, model) => sum + model.tokensUsed, 0)
  const totalCost = models.reduce((sum, model) => sum + model.cost, 0)
  const avgAccuracy = models.length > 0 
    ? models.reduce((sum, model) => sum + model.accuracy, 0) / models.length 
    : 0

  if (modelsError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold">LLM Service Unavailable</h3>
          <p className="text-red-600 mt-2">
            Unable to connect to LLM management system. This may indicate the AI services are not properly configured 
            or the API endpoints are unavailable.
          </p>
          <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['llm-models'] })}
            className="mt-3"
          >
            Retry Connection
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">LLM Management</h1>
          <p className="text-muted-foreground">
            Monitor and manage AI language models for Unit Talk platform
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh All
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* System Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Models</CardTitle>
                <Brain className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {models.filter(m => m.status === 'active').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {models.length} total models
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tokens Today</CardTitle>
                <Zap className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalTokensUsed.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tokens consumed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${totalCost.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Today's spending
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Accuracy</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {avgAccuracy.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all models
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent LLM Activity</CardTitle>
              <CardDescription>
                Latest requests and responses from AI models
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {requestsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">Loading requests...</p>
                  </div>
                ) : requests.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No recent LLM requests found</p>
                  </div>
                ) : (
                  requests.slice(0, 5).map(request => (
                    <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(request.status)}`} />
                        <div>
                          <p className="font-medium">{request.type.replace('-', ' ').toUpperCase()}</p>
                          <p className="text-sm text-muted-foreground">
                            {request.model} • {request.tokens} tokens • {request.responseTime}ms
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={request.status === 'completed' ? 'default' : 'secondary'}>
                          {request.status.toUpperCase()}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(request.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          {/* Models Management */}
          <div className="grid gap-6">
            {modelsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading AI models...</p>
              </div>
            ) : models.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No AI Models Found</h3>
                  <p className="text-muted-foreground mb-4">
                    No AI language models are currently configured.
                  </p>
                  <Button>Configure AI Models</Button>
                </CardContent>
              </Card>
            ) : (
              models.map(model => (
                <Card key={model.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(model.status)}`} />
                        {getProviderIcon(model.provider)}
                        <div>
                          <CardTitle>{model.name}</CardTitle>
                          <CardDescription>
                            {model.provider.toUpperCase()} • {model.tokensUsed.toLocaleString()} tokens used • ${model.cost.toFixed(2)} cost
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={model.status === 'active' ? 'default' : 'secondary'}>
                        {model.status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Requests Today</p>
                        <p className="text-xl font-semibold">{model.requestsToday}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Response</p>
                        <p className="text-xl font-semibold">{model.avgResponseTime}ms</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Accuracy</p>
                        <p className="text-xl font-semibold">{model.accuracy}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Token Usage</p>
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, (model.tokensUsed / model.tokensLimit) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs">
                            {Math.round((model.tokensUsed / model.tokensLimit) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Configuration */}
                    <div className="mt-4 p-3 bg-muted/20 rounded-lg">
                      <p className="text-sm font-medium mb-2">Configuration</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>Temperature: {model.configuration.temperature}</div>
                        <div>Max Tokens: {model.configuration.maxTokens}</div>
                        <div>Top P: {model.configuration.topP}</div>
                        <div>Frequency Penalty: {model.configuration.frequencyPenalty}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          {/* Model Testing */}
          <Card>
            <CardHeader>
              <CardTitle>Model Testing Interface</CardTitle>
              <CardDescription>
                Test AI models with custom prompts and evaluate responses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Select Model</label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a model to test" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.filter(m => m.status === 'active').map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name} ({model.provider})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Test Prompt</label>
                <Textarea
                  placeholder="Enter your test prompt here..."
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  rows={4}
                />
              </div>
              
              <Button 
                onClick={() => {
                  if (!selectedModel || !testPrompt) {
                    toast.error('Please select a model and enter a prompt')
                    return
                  }
                  testModelMutation.mutate({ modelId: selectedModel, prompt: testPrompt })
                }}
                disabled={!selectedModel || !testPrompt || testModelMutation.isPending}
                className="w-full"
              >
                {testModelMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Testing Model...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Test Model
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Test Results */}
          {requests.filter(r => r.type === 'system').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Test Results</CardTitle>
                <CardDescription>
                  Results from recent model tests and evaluations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {requests.filter(r => r.type === 'system').slice(0, 3).map(test => (
                    <div key={test.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge>{test.model}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {test.responseTime}ms • {test.tokens} tokens
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(test.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm">
                        <p className="font-medium">Prompt:</p>
                        <p className="text-muted-foreground mb-2">{test.prompt.substring(0, 100)}...</p>
                        {test.response && (
                          <>
                            <p className="font-medium">Response:</p>
                            <p className="text-muted-foreground">{test.response.substring(0, 200)}...</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Analytics Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Usage Analytics</CardTitle>
                <CardDescription>Token consumption and cost analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Tokens</span>
                    <span className="font-semibold">{totalTokensUsed.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Cost per Request</span>
                    <span className="font-semibold">
                      ${requests.length > 0 ? (totalCost / requests.length).toFixed(3) : '0.000'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Most Used Model</span>
                    <span className="font-semibold">
                      {models.length > 0 
                        ? models.reduce((prev, curr) => prev.requestsToday > curr.requestsToday ? prev : curr).name
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Response times and reliability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Response Time</span>
                    <span className="font-semibold">
                      {models.length > 0 
                        ? Math.round(models.reduce((sum, model) => sum + model.avgResponseTime, 0) / models.length)
                        : 0
                      }ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Success Rate</span>
                    <span className="font-semibold">
                      {requests.length > 0 
                        ? Math.round((requests.filter(r => r.status === 'completed').length / requests.length) * 100)
                        : 0
                      }%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Requests Today</span>
                    <span className="font-semibold">
                      {models.reduce((sum, model) => sum + model.requestsToday, 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}