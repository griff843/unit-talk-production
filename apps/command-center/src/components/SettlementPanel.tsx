"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Play, StopCircle } from "lucide-react";

const LEAGUES = ["MLB", "NFL", "NBA", "NCAAF", "NCAAB", "WNBA"] as const;

type Summary = { totalUnsettled: number; byLeague: Record<string, number> };
type Job = {
  job_id: string;
  job_type: string;
  status: string;
  started_at: string;
  completed_at?: string | null;
  options?: any;
  progress?: { scanned?: number; settled?: number; skipped?: number; errors?: number };
  error_message?: string | null;
};

type Status = {
  jobId: string;
  status: string;
  progress?: { scanned: number; settled: number; skipped: number; errors: number };
};

export default function SettlementPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [league, setLeague] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [force, setForce] = useState(false);
  const [batch, setBatch] = useState<number>(100);
  const [rate, setRate] = useState<number>(4);
  const [currentStatus, setCurrentStatus] = useState<Status | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showHistory, setShowHistory] = useState(true);

  const runningJob = useMemo(() => jobs.find(j => j.status === "running"), [jobs]);

  async function loadData() {
    setLoading(true);
    try {
      const [s, j] = await Promise.all([
        fetch("/api/settlement/summary", { cache: "no-store" }).then(r => r.json()),
        fetch("/api/settlement/jobs", { cache: "no-store" }).then(r => r.json()),
      ]);
      setSummary(s);
      setJobs(j.jobs || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus() {
    if (!runningJob) {
      setCurrentStatus(null);
      return;
    }
    try {
      const resp = await fetch(`/api/settlement/status?jobId=${encodeURIComponent(runningJob.job_id)}`, { cache: "no-store" });
      const data = await resp.json();
      setCurrentStatus(data);
    } catch (e: any) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setRefreshTick(t => t + 1);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    loadData();
    refreshStatus();
  }, [refreshTick]);

  async function startBackfill() {
    try {
      const body = { league: league || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, dryRun, force, batch, rate };
      const resp = await fetch("/api/settlement/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error("Failed to start job");
      await loadData();
    } catch (e: any) {
      console.error(e);
      alert("Failed to start settlement job");
    }
  }

  async function cancelJob() {
    if (!runningJob) return;
    try {
      const resp = await fetch("/api/settlement/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: runningJob.job_id }),
      });
      if (!resp.ok) throw new Error("Failed to cancel job");
      await loadData();
      setCurrentStatus(null);
    } catch (e: any) {
      console.error(e);
      alert("Failed to cancel job");
    }
  }

  const perLeague = LEAGUES.map(lg => ({ lg, count: summary?.byLeague?.[lg] ?? 0 }));
  const totalUnsettled = summary?.totalUnsettled ?? 0;

  const progressPct = useMemo(() => {
    const scanned = currentStatus?.progress?.scanned ?? runningJob?.progress?.scanned ?? 0;
    const settled = currentStatus?.progress?.settled ?? runningJob?.progress?.settled ?? 0;
    const denom = Math.max(scanned, settled, 1);
    return Math.round((settled / denom) * 100);
  }, [currentStatus, runningJob]);

  return (
    <div className="space-y-6">
      {/* Top summary bar */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Settlement Panel</CardTitle>
          <div className="flex items-center space-x-3 text-sm text-muted-foreground">
            <span>Unsettled</span>
            <span className="px-2 py-1 rounded bg-muted text-foreground font-mono">{totalUnsettled.toLocaleString()}</span>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Per-league bars */}
          <div className="grid md:grid-cols-2 gap-4">
            {perLeague.map(({ lg, count }) => (
              <div key={lg} className="p-3 rounded border bg-muted/20">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">{lg}</span>
                  <span className="text-muted-foreground">{count.toLocaleString()}</span>
                </div>
                <Progress value={totalUnsettled ? Math.min(100, Math.round((count / totalUnsettled) * 100)) : 0} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Controls + Current job */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">League (optional)</Label>
              <Select onValueChange={setLeague} value={league}>
                <SelectTrigger>
                  <SelectValue placeholder="All leagues" />
                </SelectTrigger>
                <SelectContent>
                  {LEAGUES.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date From</Label>
              <Input type="date" value={dateFrom} onChange={(e: any) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Date To</Label>
              <Input type="date" value={dateTo} onChange={(e: any) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mt-4 items-center">
            <div className="flex items-center space-x-2">
              <Switch checked={dryRun} onCheckedChange={setDryRun} id="dryRun" />
              <Label htmlFor="dryRun">Dry Run</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={force} onCheckedChange={setForce} id="force" />
              <Label htmlFor="force">Force</Label>
            </div>
            <div>
              <Label className="text-xs">Batch Size</Label>
              <Input type="number" value={batch} onChange={(e: any) => setBatch(Number(e.target.value || 0))} />
            </div>
            <div>
              <Label className="text-xs">Rate</Label>
              <Input type="number" value={rate} onChange={(e: any) => setRate(Number(e.target.value || 0))} />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <Button onClick={startBackfill}>
              <Play className="w-4 h-4 mr-2" /> Start Backfill
            </Button>
            <Button variant="destructive" onClick={cancelJob} disabled={!runningJob}>
              <StopCircle className="w-4 h-4 mr-2" /> Cancel Running Job
            </Button>
          </div>

          {/* Current job progress */}
          <Separator className="my-4" />
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <div className="text-muted-foreground">Current Job</div>
              <div className="font-mono">{runningJob ? runningJob.job_id : "None"}</div>
            </div>
            <Progress value={progressPct} />
            <div className="text-xs text-muted-foreground">
              {currentStatus ? (
                <span>
                  Status: {currentStatus.status} • Scanned: {currentStatus.progress?.scanned ?? 0} • Settled: {currentStatus.progress?.settled ?? 0} • Errors: {currentStatus.progress?.errors ?? 0}
                </span>
              ) : runningJob ? (
                <span>
                  Status: {runningJob.status} • Scanned: {runningJob.progress?.scanned ?? 0} • Settled: {runningJob.progress?.settled ?? 0} • Errors: {runningJob.progress?.errors ?? 0}
                </span>
              ) : (
                <span>No active job</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job History */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-base">Recent Jobs</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? 'Hide' : 'Show'}
          </Button>
        </CardHeader>
        {showHistory && (
        <CardContent>
          <div className="rounded border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>League</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Settled %</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(jobs || []).map((j) => {
                  const scanned = j.progress?.scanned ?? 0;
                  const settled = j.progress?.settled ?? 0;
                  const pct = scanned ? Math.round((settled / scanned) * 100) : 0;
                  const leagueOpt = j.options?.league ?? 'All';
                  const range = [j.options?.dateFrom, j.options?.dateTo].filter(Boolean).join(' to ') || 'All dates';
                  return (
                    <TableRow key={j.job_id}>
                      <TableCell className="font-mono text-xs">{new Date(j.started_at).toLocaleString()}</TableCell>
                      <TableCell>{leagueOpt}</TableCell>
                      <TableCell className="text-sm">{range}</TableCell>
                      <TableCell className="text-sm">{j.status}</TableCell>
                      <TableCell className="text-right">{pct}%</TableCell>
                      <TableCell className="text-right">{j.progress?.errors ?? 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        )}
      </Card>
    </div>
  );
}