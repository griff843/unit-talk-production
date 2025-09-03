'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { runHealthProbes } from './actions';
import { toast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';

export function ProbeButton() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);

  const handleRunProbes = async () => {
    setIsRunning(true);
    
    try {
      const result = await runHealthProbes();
      
      if (result.ok) {
        toast({
          title: 'Probes Completed',
          description: result.summary || 'All health probes executed successfully',
          action: <CheckCircle className="h-4 w-4 text-green-600" />
        });
      } else {
        toast({
          title: 'Probes Failed',
          description: result.error || 'Some health probes failed',
          variant: 'destructive',
          action: <XCircle className="h-4 w-4" />
        });
      }
      
      // Refresh the page to show updated data
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to execute health probes',
        variant: 'destructive'
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Button 
      onClick={handleRunProbes}
      disabled={isRunning}
      variant="default"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
      {isRunning ? 'Running Probes...' : 'Run Probes'}
    </Button>
  );
}