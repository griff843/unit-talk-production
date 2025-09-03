'use client'

import { useState, useEffect } from 'react'

interface SystemMetrics {
  timestamp: number
  system: {
    cpu: number
    memory: {
      used: number
      total: number
      percentage: number
    }
    disk: {
      used: number
      total: number
      percentage: number
    }
    load: {
      load1: number
      load5: number
      load15: number
    }
    uptime: number
  }
  process: {
    pid: number
    cpu: number
    memory: {
      rss: number
      heapUsed: number
      heapTotal: number
      external: number
    }
    uptime: number
  }
  network: {
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
  }
}

interface FormattedMetrics {
  cpu: string
  memory: string
  disk: string
  load: string
  uptime: string
  networkIn: string
  networkOut: string
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  issues: string[]
  metrics: SystemMetrics
}

export function useSystemMetrics(intervalMs: number = 30000) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [formattedMetrics, setFormattedMetrics] = useState<FormattedMetrics | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/system/metrics')
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`)
      }
      const data = await response.json()
      setMetrics(data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch system metrics:', err)
      setError(err as Error)
    }
  }

  const fetchFormattedMetrics = async () => {
    try {
      const response = await fetch('/api/system/metrics/formatted')
      if (!response.ok) {
        throw new Error(`Failed to fetch formatted metrics: ${response.statusText}`)
      }
      const data = await response.json()
      setFormattedMetrics(data)
    } catch (err) {
      console.error('Failed to fetch formatted metrics:', err)
    }
  }

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/system/health')
      if (!response.ok) {
        throw new Error(`Failed to fetch system health: ${response.statusText}`)
      }
      const data = await response.json()
      setHealth(data)
    } catch (err) {
      console.error('Failed to fetch system health:', err)
    }
  }

  const fetchAllData = async () => {
    setLoading(true)
    await Promise.all([
      fetchMetrics(),
      fetchFormattedMetrics(),
      fetchHealth()
    ])
    setLoading(false)
  }

  useEffect(() => {
    // Initial fetch
    fetchAllData()

    // Set up interval
    const interval = setInterval(fetchAllData, intervalMs)

    return () => clearInterval(interval)
  }, [intervalMs])

  return {
    metrics,
    formattedMetrics,
    health,
    loading,
    error,
    refetch: fetchAllData
  }
}