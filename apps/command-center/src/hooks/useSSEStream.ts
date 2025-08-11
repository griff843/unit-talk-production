'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface SSEMessage {
  id: string
  event: string
  data: any
  timestamp: string
}

interface UseSSEStreamOptions {
  events?: string[]
  autoReconnect?: boolean
  maxReconnectAttempts?: number
  reconnectDelay?: number
}

interface SSEStreamState {
  connected: boolean
  connecting: boolean
  error: string | null
  lastMessage: SSEMessage | null
  connectionId: string | null
  reconnectAttempts: number
}

/**
 * Hook for consuming Server-Sent Events from the Command Center
 * Provides real-time data streaming with automatic reconnection
 */
export function useSSEStream(options: UseSSEStreamOptions = {}) {
  const {
    events = ['agent-status', 'system-metrics'],
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 2000
  } = options

  const [state, setState] = useState<SSEStreamState>({
    connected: false,
    connecting: false,
    error: null,
    lastMessage: null,
    connectionId: null,
    reconnectAttempts: 0
  })

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map())

  // Subscribe to specific event types
  const subscribe = useCallback((eventType: string, callback: (data: any) => void) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set())
    }
    
    listenersRef.current.get(eventType)!.add(callback)
    
    // Return unsubscribe function
    return () => {
      const eventListeners = listenersRef.current.get(eventType)
      if (eventListeners) {
        eventListeners.delete(callback)
        if (eventListeners.size === 0) {
          listenersRef.current.delete(eventType)
        }
      }
    }
  }, [])

  // Emit events to subscribers
  const emit = useCallback((eventType: string, data: any) => {
    const eventListeners = listenersRef.current.get(eventType)
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in SSE event listener for ${eventType}:`, error)
        }
      })
    }
  }, [])

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setState(prev => ({ ...prev, connecting: true, error: null }))

    try {
      const url = `/api/stream?types=${events.join(',')}`
      console.log('🌊 Connecting to SSE stream:', url)
      
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('✅ SSE connection opened')
        setState(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          error: null,
          reconnectAttempts: 0
        }))
      }

      eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error)
        setState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          error: 'Connection error'
        }))

        // Attempt reconnection if enabled
        if (autoReconnect && state.reconnectAttempts < maxReconnectAttempts) {
          attemptReconnect()
        }
      }

      // Handle connection established
      eventSource.addEventListener('connected', (event) => {
        const data = JSON.parse(event.data)
        console.log('🔗 SSE connection established:', data.connectionId)
        setState(prev => ({
          ...prev,
          connectionId: data.connectionId
        }))
      })

      // Handle ping/keep-alive
      eventSource.addEventListener('ping', (event) => {
        const data = JSON.parse(event.data)
        console.log('🏓 SSE ping received:', data.timestamp)
      })

      // Handle agent status updates
      eventSource.addEventListener('agent-status', (event) => {
        try {
          const data = JSON.parse(event.data)
          const message: SSEMessage = {
            id: event.lastEventId || '',
            event: 'agent-status',
            data,
            timestamp: data.timestamp
          }
          
          setState(prev => ({ ...prev, lastMessage: message }))
          emit('agent-status', data)
        } catch (error) {
          console.error('Failed to parse agent-status message:', error)
        }
      })

      // Handle system metrics updates
      eventSource.addEventListener('system-metrics', (event) => {
        try {
          const data = JSON.parse(event.data)
          const message: SSEMessage = {
            id: event.lastEventId || '',
            event: 'system-metrics',
            data,
            timestamp: data.timestamp
          }
          
          setState(prev => ({ ...prev, lastMessage: message }))
          emit('system-metrics', data)
        } catch (error) {
          console.error('Failed to parse system-metrics message:', error)
        }
      })

      // Handle system alerts
      eventSource.addEventListener('system-alert', (event) => {
        try {
          const data = JSON.parse(event.data)
          const message: SSEMessage = {
            id: event.lastEventId || '',
            event: 'system-alert',
            data,
            timestamp: data.timestamp
          }
          
          setState(prev => ({ ...prev, lastMessage: message }))
          emit('system-alert', data)
        } catch (error) {
          console.error('Failed to parse system-alert message:', error)
        }
      })

    } catch (error) {
      console.error('Failed to create SSE connection:', error)
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [events, autoReconnect, maxReconnectAttempts, state.reconnectAttempts, emit])

  // Attempt reconnection with exponential backoff
  const attemptReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
    }

    setState(prev => ({
      ...prev,
      reconnectAttempts: prev.reconnectAttempts + 1
    }))

    const delay = reconnectDelay * Math.pow(2, state.reconnectAttempts)
    console.log(`🔄 Attempting SSE reconnect in ${delay}ms (attempt ${state.reconnectAttempts + 1}/${maxReconnectAttempts})`)

    reconnectTimerRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [connect, reconnectDelay, state.reconnectAttempts, maxReconnectAttempts])

  // Disconnect from SSE stream
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      connectionId: null
    }))

    console.log('🔌 SSE connection disconnected')
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, []) // Only run on mount/unmount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    isConnected: state.connected,
    isConnecting: state.connecting,
    hasError: !!state.error
  }
}

// Convenience hooks for specific data types
export function useAgentStatusStream() {
  const sse = useSSEStream({ events: ['agent-status'] })
  const [agents, setAgents] = useState<any[]>([])

  useEffect(() => {
    return sse.subscribe('agent-status', (data) => {
      setAgents(data.agents || [])
    })
  }, [sse])

  return { agents, ...sse }
}

export function useSystemMetricsStream() {
  const sse = useSSEStream({ events: ['system-metrics'] })
  const [metrics, setMetrics] = useState<any>(null)

  useEffect(() => {
    return sse.subscribe('system-metrics', (data) => {
      setMetrics(data)
    })
  }, [sse])

  return { metrics, ...sse }
}