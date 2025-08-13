'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Filter,
  Calendar,
  User,
  ArrowLeft,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface Incident {
  id: number;
  severity: 'warning' | 'critical';
  source: string;
  title: string;
  details: any;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

const IncidentCard = ({ 
  incident, 
  onResolve 
}: { 
  incident: Incident; 
  onResolve: (id: number, notes?: string) => void;
}) => {
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);

  const handleResolve = async () => {
    setResolving(true);
    try {
      await onResolve(incident.id, resolutionNotes);
      setShowResolveForm(false);
      setResolutionNotes('');
    } finally {
      setResolving(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge variant="secondary">Warning</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
    }
  };

  return (
    <Card className={`border-l-4 ${
      incident.severity === 'critical' ? 'border-l-red-500' : 
      incident.severity === 'warning' ? 'border-l-yellow-500' : 'border-l-blue-500'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getSeverityIcon(incident.severity)}
            <div>
              <CardTitle className="text-lg">{incident.title}</CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                {getSeverityBadge(incident.severity)}
                <Badge variant="outline">{incident.source}</Badge>
                {incident.resolved_at ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Resolved
                  </Badge>
                ) : (
                  <Badge variant="destructive">Active</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>ID #{incident.id}</div>
            <div>{new Date(incident.created_at).toLocaleDateString()}</div>
            <div>{new Date(incident.created_at).toLocaleTimeString()}</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Incident Details */}
        {incident.details && (
          <div className="bg-muted/20 p-3 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Details</h4>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(incident.details, null, 2)}
            </pre>
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Timeline</h4>
          <div className="space-y-1 text-sm">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Created:</span>
              <span>{new Date(incident.created_at).toLocaleString()}</span>
            </div>
            {incident.resolved_at && (
              <>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-muted-foreground">Resolved:</span>
                  <span>{new Date(incident.resolved_at).toLocaleString()}</span>
                </div>
                {incident.resolved_by && (
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Resolved by:</span>
                    <span>{incident.resolved_by}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Resolution Actions */}
        {!incident.resolved_at && (
          <div className="space-y-3">
            {!showResolveForm ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowResolveForm(true)}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Resolve Incident
              </Button>
            ) : (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
                <div>
                  <label className="text-sm font-medium">Resolution Notes (optional)</label>
                  <Input
                    placeholder="Describe how this incident was resolved..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    onClick={handleResolve}
                    disabled={resolving}
                  >
                    {resolving ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    {resolving ? 'Resolving...' : 'Confirm Resolution'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowResolveForm(false)}
                    disabled={resolving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    severity: '',
    source: '',
    resolved: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.source) params.append('source', filters.source);
      if (filters.resolved) params.append('resolved', filters.resolved);
      params.append('limit', '100');

      const response = await fetch(`/api/ops/incidents?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setIncidents(data.incidents || []);
      } else {
        throw new Error('Failed to fetch incidents');
      }
    } catch (error) {
      console.error('Error fetching incidents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load incidents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolveIncident = async (id: number, resolutionNotes?: string) => {
    try {
      const response = await fetch('/api/ops/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id, 
          resolution_notes: resolutionNotes 
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update the incident in our state
        setIncidents(prev => prev.map(incident => 
          incident.id === id 
            ? { 
                ...incident, 
                resolved_at: result.resolved_at,
                resolved_by: result.resolved_by,
              }
            : incident
        ));

        toast({
          title: 'Success',
          description: 'Incident resolved successfully',
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resolve incident');
      }
    } catch (error) {
      console.error('Error resolving incident:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resolve incident',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [filters]);

  // Filter incidents based on search query
  const filteredIncidents = incidents.filter(incident =>
    incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    incident.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get unique sources for filter dropdown
  const uniqueSources = Array.from(new Set(incidents.map(i => i.source)));

  // Statistics
  const stats = {
    total: incidents.length,
    active: incidents.filter(i => !i.resolved_at).length,
    resolved: incidents.filter(i => i.resolved_at).length,
    critical: incidents.filter(i => i.severity === 'critical').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/command-center">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Command Center
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Incidents Management</h1>
            <p className="text-muted-foreground">
              View, filter, and resolve system incidents
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchIncidents} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Incidents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.active}</div>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-800">{stats.critical}</div>
            <p className="text-sm text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search incidents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Severity</label>
              <select
                className="w-full mt-1 p-2 border rounded-md"
                value={filters.severity}
                onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Source</label>
              <select
                className="w-full mt-1 p-2 border rounded-md"
                value={filters.source}
                onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
              >
                <option value="">All Sources</option>
                {uniqueSources.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                className="w-full mt-1 p-2 border rounded-md"
                value={filters.resolved}
                onChange={(e) => setFilters(prev => ({ ...prev, resolved: e.target.value }))}
              >
                <option value="">All Statuses</option>
                <option value="false">Active</option>
                <option value="true">Resolved</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Incidents List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading incidents...</p>
          </div>
        </div>
      ) : filteredIncidents.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Incidents Found</h3>
            <p className="text-muted-foreground">
              {incidents.length === 0 
                ? "No incidents have been recorded yet."
                : "No incidents match your current filters."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onResolve={handleResolveIncident}
            />
          ))}
        </div>
      )}
    </div>
  );
}