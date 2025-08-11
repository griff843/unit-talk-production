'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

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

// Mock data for now - in production, this would come from a configuration database
const mockModels: LLMModel[] = [
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    status: 'active',
    tokensUsed: 45230,
    tokensLimit: 1000000,
    requestsToday: 127,
    avgResponseTime: 1200,
    cost: 22.15,
    accuracy: 94.2,
    lastUsed: new Date().toISOString(),
    configuration: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 0.9,
      frequencyPenalty: 0.1
    }
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    status: 'active',
    tokensUsed: 28450,
    tokensLimit: 500000,
    requestsToday: 89,
    avgResponseTime: 950,
    cost: 14.25,
    accuracy: 96.8,
    lastUsed: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    configuration: {
      temperature: 0.3,
      maxTokens: 4096,
      topP: 0.9,
      frequencyPenalty: 0.0
    }
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    status: 'active',
    tokensUsed: 120450,
    tokensLimit: 2000000,
    requestsToday: 245,
    avgResponseTime: 650,
    cost: 8.33,
    accuracy: 87.5,
    lastUsed: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
    configuration: {
      temperature: 0.9,
      maxTokens: 2048,
      topP: 0.95,
      frequencyPenalty: 0.2
    }
  }
]

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Try to get real model configuration from database
    // For now, return mock data but could be enhanced to store in database
    const { data: models, error } = await supabase
      .from('llm_models')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.log('LLM models table not found, returning mock data')
      return NextResponse.json(mockModels)
    }
    
    // If we have real data, transform it to match interface
    const transformedModels = models?.map(model => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      status: model.status || 'active',
      tokensUsed: model.tokens_used || 0,
      tokensLimit: model.tokens_limit || 1000000,
      requestsToday: model.requests_today || 0,
      avgResponseTime: model.avg_response_time || 1000,
      cost: model.cost || 0,
      accuracy: model.accuracy || 90,
      lastUsed: model.last_used || new Date().toISOString(),
      configuration: model.configuration || {
        temperature: 0.7,
        maxTokens: 4096,
        topP: 0.9,
        frequencyPenalty: 0.1
      }
    })) || []
    
    return NextResponse.json(transformedModels.length > 0 ? transformedModels : mockModels)
    
  } catch (error) {
    console.error('Error fetching LLM models:', error)
    return NextResponse.json(mockModels, { status: 200 })
  }
}