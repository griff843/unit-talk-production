'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Copy, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { DISPLAY_LABELS } from '../types';

export interface SubmissionReceiptData {
  bet_slip_id: string;
  capper_name: string;
  sport: string;
  ticket_type: string;
  selection_count: number;
  total_units: number;
  status: string;
}

interface SubmissionReceiptProps {
  data: SubmissionReceiptData;
  onSubmitAnother: () => void;
}

export function SubmissionReceipt({ data, onSubmitAnother }: SubmissionReceiptProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(data.bet_slip_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-6 px-4 sm:px-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Success header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Pick Submitted</h1>
            <p className="text-sm text-gray-500 mt-1">Your pick has been recorded successfully</p>
          </div>

          {/* Ticket ID */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ticket ID</p>
                <p className="text-sm font-mono font-semibold text-gray-900 mt-1">{data.bet_slip_id}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyId}
                className="text-gray-500 hover:text-gray-700"
              >
                <Copy className="h-4 w-4 mr-1" />
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-3 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500">Capper</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{data.capper_name}</p>
            </div>
            <div className="p-3 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500">Sport</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{data.sport}</p>
            </div>
            <div className="p-3 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500">Ticket Type</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {DISPLAY_LABELS[data.ticket_type] || data.ticket_type}
              </p>
            </div>
            <div className="p-3 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500">Units</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{data.total_units}u</p>
            </div>
            <div className="p-3 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500">Selections</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{data.selection_count} leg{data.selection_count !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-3 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500">Status</p>
              <Badge className="mt-0.5 bg-green-100 text-green-800 hover:bg-green-100">
                {data.status || 'Submitted'}
              </Badge>
            </div>
          </div>


          {/* Actions */}
          <div className="space-y-3">
            <Button onClick={onSubmitAnother} className="w-full py-3 text-base font-semibold bg-blue-600 hover:bg-blue-700">
              <RotateCcw className="h-4 w-4 mr-2" />
              Submit Another Ticket
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
