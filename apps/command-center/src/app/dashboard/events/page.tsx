'use client';

import { EventStream } from '@/components/EventStream';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Database, Workflow, Zap } from 'lucide-react';

export default function EventsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Production Pipeline Events</h1>
          <p className="text-gray-600 mt-2">
            Real-time monitoring of the Unit Talk production pipeline including Smart Form bridge events,
            Temporal workflows, and alert processing.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events Table</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Events</div>
            <p className="text-xs text-muted-foreground">
              Core event sourcing table
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bridge Outbox</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Smart Form</div>
            <p className="text-xs text-muted-foreground">
              Bridge integration events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workflows</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Temporal</div>
            <p className="text-xs text-muted-foreground">
              Workflow executions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Live Stream</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Real-time</div>
            <p className="text-xs text-muted-foreground">
              Server-sent events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Event Stream Component */}
      <EventStream />

      {/* Documentation Section */}
      <Card>
        <CardHeader>
          <CardTitle>Event Types Reference</CardTitle>
          <CardDescription>
            Production pipeline event types and their meanings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-blue-600">Ticket Events</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>🎫 <code>ticket.submitted.v1</code> - New ticket from Smart Form</li>
                <li>✅ <code>ticket.processing.completed.v1</code> - Processing complete</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-purple-600">Grading Events</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>📊 <code>grading.completed.v1</code> - Professional grading done</li>
                <li>⭐ <code>grading.tier.assigned.v1</code> - Tier assignment complete</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-orange-600">Alert Events</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>🏥 <code>alert.injury.detected.v1</code> - Player injury alert</li>
                <li>⭐ <code>alert.high_tier.v1</code> - S/A-tier pick alert</li>
                <li>🛡️ <code>alert.hedge.opportunity.v1</code> - Hedge opportunity</li>
                <li>🎯 <code>alert.middle.opportunity.v1</code> - Middle opportunity</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-green-600">Workflow Events</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>▶️ <code>workflow.started.v1</code> - Temporal workflow started</li>
                <li>✅ <code>workflow.completed.v1</code> - Workflow completed</li>
                <li>❌ <code>workflow.failed.v1</code> - Workflow failed</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-teal-600">Bridge Events</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>🌉 <code>bridge.outbox.completed.v1</code> - Bridge processing done</li>
                <li>🔄 <code>bridge.retry.initiated.v1</code> - Retry processing</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-red-600">System Events</h4>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>🚨 <code>system.error.v1</code> - System-wide error</li>
                <li>⚡ <code>system.performance.alert.v1</code> - Performance issue</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}