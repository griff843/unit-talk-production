'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Power, Shield, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface SystemFreezeStatus {
  active: boolean
  activatedAt: string | null
  activatedBy: string | null
  reason: string | null
  lastChecked: string
}

interface KillSwitchPanelProps {
  className?: string
}

export function KillSwitchPanel({ className }: KillSwitchPanelProps) {
  const [freezeStatus, setFreezeStatus] = useState<SystemFreezeStatus>({
    active: false,
    activatedAt: null,
    activatedBy: null,
    reason: null,
    lastChecked: new Date().toISOString()
  })
  const [isLoading, setIsLoading] = useState(false)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [unfreezeOpen, setUnfreezeOpen] = useState(false)
  const [reason, setReason] = useState('')
  const { toast } = useToast()

  // Check current freeze status
  useEffect(() => {
    checkFreezeStatus()
    
    // Poll every 5 seconds for status updates
    const interval = setInterval(checkFreezeStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const checkFreezeStatus = async () => {
    try {
      const response = await fetch('/api/ops/system/freeze/status')
      if (response.ok) {
        const status = await response.json()
        setFreezeStatus({
          ...status,
          lastChecked: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error('Failed to check freeze status:', error)
    }
  }

  const activateKillSwitch = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for activating the kill switch',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch('/api/ops/system/freeze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'activate',
          reason: reason.trim()
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        setFreezeStatus({
          active: true,
          activatedAt: new Date().toISOString(),
          activatedBy: result.activatedBy || 'Unknown',
          reason: reason.trim(),
          lastChecked: new Date().toISOString()
        })

        toast({
          title: 'Kill Switch Activated',
          description: 'System freeze is now active. All deployments and critical operations are blocked.',
          variant: 'destructive'
        })

        // Send critical alert
        await fetch('/api/alerts/critical', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'KILL SWITCH ACTIVATED',
            message: `System freeze activated. Reason: ${reason.trim()}`,
            severity: 'critical',
            source: 'command-center-killswitch'
          })
        })

        setConfirmationOpen(false)
        setReason('')
      } else {
        throw new Error(`Failed to activate kill switch: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Kill switch activation failed:', error)
      toast({
        title: 'Activation Failed',
        description: error instanceof Error ? error.message : 'Failed to activate kill switch',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const deactivateKillSwitch = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for deactivating the kill switch',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch('/api/ops/system/freeze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'deactivate',
          reason: reason.trim()
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        setFreezeStatus({
          active: false,
          activatedAt: null,
          activatedBy: null,
          reason: null,
          lastChecked: new Date().toISOString()
        })

        toast({
          title: 'Kill Switch Deactivated',
          description: 'System freeze has been lifted. Normal operations can resume.',
          variant: 'default'
        })

        // Send resolution alert
        await fetch('/api/alerts/resolved', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'KILL SWITCH DEACTIVATED',
            message: `System freeze deactivated. Reason: ${reason.trim()}`,
            severity: 'info',
            source: 'command-center-killswitch'
          })
        })

        setUnfreezeOpen(false)
        setReason('')
      } else {
        throw new Error(`Failed to deactivate kill switch: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Kill switch deactivation failed:', error)
      toast({
        title: 'Deactivation Failed',
        description: error instanceof Error ? error.message : 'Failed to deactivate kill switch',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* System Freeze Banner */}
      {freezeStatus.active && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-500">SYSTEM FROZEN</h3>
              <p className="text-sm text-red-400">
                All deployments and critical operations are blocked
              </p>
              {freezeStatus.reason && (
                <p className="text-xs text-red-300 mt-1">
                  Reason: {freezeStatus.reason}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUnfreezeOpen(true)}
              className="border-red-500/50 text-red-500 hover:bg-red-500/10"
              data-testid="quick-unfreeze-button"
            >
              <Shield className="h-4 w-4 mr-1" />
              Unfreeze
            </Button>
          </div>
        </div>
      )}

      {/* Kill Switch Control Panel */}
      <Card className="border-red-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <Power className="h-5 w-5" />
                Emergency Kill Switch
              </CardTitle>
              <CardDescription>
                Immediately freeze system to prevent deployments and critical operations
              </CardDescription>
            </div>
            <Badge 
              variant={freezeStatus.active ? "destructive" : "secondary"}
              className="h-fit"
            >
              {freezeStatus.active ? (
                <><AlertCircle className="h-3 w-3 mr-1" /> ACTIVE</>
              ) : (
                <><CheckCircle className="h-3 w-3 mr-1" /> STANDBY</>
              )}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Current Status */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="font-medium text-gray-700">Status</label>
              <p className={cn(
                "font-mono",
                freezeStatus.active ? "text-red-600" : "text-green-600"
              )}>
                {freezeStatus.active ? "SYSTEM_FREEZE = true" : "SYSTEM_FREEZE = false"}
              </p>
            </div>
            <div>
              <label className="font-medium text-gray-700">Last Checked</label>
              <p className="text-gray-600">
                {new Date(freezeStatus.lastChecked).toLocaleTimeString()}
              </p>
            </div>
            {freezeStatus.activatedAt && (
              <>
                <div>
                  <label className="font-medium text-gray-700">Activated At</label>
                  <p className="text-gray-600">
                    {new Date(freezeStatus.activatedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="font-medium text-gray-700">Activated By</label>
                  <p className="text-gray-600">{freezeStatus.activatedBy}</p>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {!freezeStatus.active ? (
              <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="lg"
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                    data-testid="killswitch-button"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    ACTIVATE KILL SWITCH
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-red-600 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Confirm Kill Switch Activation
                    </DialogTitle>
                    <DialogDescription className="text-left space-y-2">
                      <p>This will immediately:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Set SYSTEM_FREEZE = true</li>
                        <li>Block all deployments</li>
                        <li>Prevent publishing/promotion operations</li>
                        <li>Create critical alerts</li>
                        <li>Notify all on-call personnel</li>
                      </ul>
                      <p className="font-semibold text-red-600 mt-2">
                        Use only in emergencies!
                      </p>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm font-medium">
                        Reason for activation (required):
                      </label>
                      <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Describe the emergency situation requiring kill switch activation..."
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setConfirmationOpen(false)
                          setReason('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={activateKillSwitch}
                        disabled={isLoading || !reason.trim()}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isLoading ? 'Activating...' : 'CONFIRM ACTIVATION'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Dialog open={unfreezeOpen} onOpenChange={setUnfreezeOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline"
                    size="lg"
                    className="border-green-500 text-green-700 hover:bg-green-50"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    DEACTIVATE KILL SWITCH
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-green-600 flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Confirm Kill Switch Deactivation
                    </DialogTitle>
                    <DialogDescription className="text-left">
                      This will restore normal system operations and allow deployments to resume.
                      Make sure the underlying issue has been resolved.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm font-medium">
                        Reason for deactivation (required):
                      </label>
                      <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Explain why it's safe to resume normal operations..."
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setUnfreezeOpen(false)
                          setReason('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        onClick={deactivateKillSwitch}
                        disabled={isLoading || !reason.trim()}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isLoading ? 'Deactivating...' : 'CONFIRM DEACTIVATION'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Impact Information */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <h4 className="font-medium text-yellow-800 mb-2">When Active, Kill Switch Will:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Block all production deployments</li>
              <li>• Prevent pick publishing to Discord</li>
              <li>• Stop automatic settlement processes</li>
              <li>• Disable promotional campaigns</li>
              <li>• Alert all on-call personnel</li>
              <li>• Create audit trail of all actions</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}