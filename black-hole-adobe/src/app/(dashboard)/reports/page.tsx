'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScoreRing } from '@/components/ui/score-ring';
import {
  FileText,
  Download,
  Calendar,
  Shield,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import type { AssessmentResult, MigrationProject } from '@/types';

interface ReportEntry {
  id: string;
  sourceId: string;
  title: string;
  type: 'Assessment' | 'Migration';
  date: string;
  score: number;
  highlights: string[];
}

interface StatCard {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function SkeletonStatCard() {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded bg-slate-800" />
        <div className="space-y-1.5">
          <div className="h-6 w-16 animate-pulse rounded bg-slate-800" />
          <div className="h-3 w-24 animate-pulse rounded bg-slate-800" />
        </div>
      </div>
    </Card>
  );
}

function SkeletonReportCard() {
  return (
    <Card>
      <div className="flex items-center gap-6">
        <div className="h-[60px] w-[60px] animate-pulse rounded-full bg-slate-800" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-72 animate-pulse rounded bg-slate-800" />
          <div className="h-3 w-48 animate-pulse rounded bg-slate-800" />
          <div className="flex gap-2">
            <div className="h-5 w-32 animate-pulse rounded-full bg-slate-800" />
            <div className="h-5 w-28 animate-pulse rounded-full bg-slate-800" />
          </div>
        </div>
        <div className="h-8 w-20 animate-pulse rounded bg-slate-800" />
      </div>
    </Card>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [statCards, setStatCards] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assessRes, migRes] = await Promise.all([
        fetch('/api/assessments?pageSize=100'),
        fetch('/api/migrations?pageSize=100'),
      ]);

      if (!assessRes.ok) throw new Error(`Failed to fetch assessments (${assessRes.status})`);
      if (!migRes.ok) throw new Error(`Failed to fetch migrations (${migRes.status})`);

      const assessJson = await assessRes.json();
      const migJson = await migRes.json();

      const assessments: AssessmentResult[] = assessJson.data ?? [];
      const migrations: MigrationProject[] = migJson.data ?? [];

      // Build a migration lookup map
      const migMap = new Map<string, MigrationProject>();
      for (const m of migrations) {
        migMap.set(m.id, m);
      }

      const entries: ReportEntry[] = [];

      // Assessment-based reports
      for (const a of assessments) {
        const mig = migMap.get(a.migrationProjectId);
        const projectName = mig?.name ?? a.migrationProjectId;
        const org = mig?.organizationName ?? '';

        const highlights: string[] = [];
        if (a.findings.length > 0) {
          highlights.push(`${a.findings.length} findings`);
        }
        const autoFix = a.findings.filter((f) => f.autoFixAvailable).length;
        if (autoFix > 0) {
          highlights.push(`${autoFix} auto-fixable`);
        }
        if (a.traditionalEstimate) {
          highlights.push(`${a.traditionalEstimate.costSavingsPercent}% cost savings`);
        }

        entries.push({
          id: a.id,
          sourceId: a.id,
          title: `${org ? org + ' ' : ''}${projectName} — Assessment Report`,
          type: 'Assessment',
          date: new Date(a.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          score: a.overallScore,
          highlights,
        });
      }

      // Migration-based reports (only migrations with progress > 0 that have assessment data)
      for (const m of migrations) {
        // Skip if we already have an assessment report for this migration
        const hasAssessReport = assessments.some((a) => a.migrationProjectId === m.id);
        if (hasAssessReport) continue;

        // Only include migrations with meaningful progress
        if (m.progress <= 0) continue;

        const score = m.assessment?.overallScore ?? Math.round((1 - m.riskScore) * 100);
        const highlights: string[] = [];
        highlights.push(`${m.progress}% complete`);
        if (m.estimatedCost > 0) {
          highlights.push(`Est. ${formatCurrency(m.estimatedCost)}`);
        }
        if (m.phases.length > 0) {
          const completedPhases = m.phases.filter((p) => p.progress === 100).length;
          highlights.push(`${completedPhases}/${m.phases.length} phases done`);
        }

        entries.push({
          id: m.id,
          sourceId: m.id,
          title: `${m.organizationName} ${m.name} — Migration Report`,
          type: 'Migration',
          date: new Date(m.updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          score,
          highlights,
        });
      }

      // Sort by date descending
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setReports(entries);

      // Compute stat cards from real data
      const totalReports = entries.length;
      const avgScore = entries.length > 0
        ? Math.round(entries.reduce((sum, r) => sum + r.score, 0) / entries.length)
        : 0;

      let totalTimeSavedHours = 0;
      let totalCostSaved = 0;
      for (const a of assessments) {
        if (a.traditionalEstimate && a.estimatedTimeline) {
          const weeksSaved = a.traditionalEstimate.durationWeeks - a.estimatedTimeline.totalWeeks;
          totalTimeSavedHours += weeksSaved * 40; // 40 hrs/week
          totalCostSaved += a.traditionalEstimate.cost - a.estimatedCost.totalEstimate;
        }
      }

      setStatCards([
        { label: 'Reports Generated', value: String(totalReports), icon: FileText, color: 'text-violet-400' },
        { label: 'Avg Readiness Score', value: String(avgScore), icon: TrendingUp, color: 'text-cyan-400' },
        {
          label: 'Total Time Saved',
          value: totalTimeSavedHours > 0 ? `${totalTimeSavedHours}hrs` : '0hrs',
          icon: Clock,
          color: 'text-emerald-400',
        },
        {
          label: 'Total Cost Saved',
          value: totalCostSaved > 0 ? formatCurrency(totalCostSaved) : '$0',
          icon: DollarSign,
          color: 'text-amber-400',
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async (report: ReportEntry) => {
    setDownloadingId(report.id);
    try {
      const typeParam = report.type === 'Assessment' ? '?type=assessment' : '';
      const res = await fetch(`/api/reports/${report.sourceId}/pdf${typeParam}`);
      if (!res.ok) {
        // Fall back to opening the JSON report endpoint if PDF fails
        window.open(`/api/reports/${report.sourceId}${typeParam ? typeParam : ''}`, '_blank');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${report.sourceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fall back to opening in new tab
      window.open(`/api/reports/${report.sourceId}/pdf`, '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="mt-1 text-sm text-slate-400">
          Migration assessments, compliance audits, and ROI tracking reports.
        </p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <SkeletonStatCard />
              </motion.div>
            ))
          : statCards.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <div className="flex items-center gap-3">
                    <stat.icon className={`h-8 w-8 ${stat.color}`} />
                    <div>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                      <p className="text-xs text-slate-400">{stat.label}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-slate-300">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Report list */}
      {!error && (
        <div className="space-y-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                >
                  <SkeletonReportCard />
                </motion.div>
              ))
            : reports.length === 0
              ? (
                  <Card>
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <FileText className="h-12 w-12 text-slate-600" />
                      <p className="text-sm text-slate-400">
                        No reports available yet. Complete an assessment or migration to generate reports.
                      </p>
                    </div>
                  </Card>
                )
              : reports.map((report, i) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                  >
                    <Card>
                      <div className="flex items-center gap-6">
                        <ScoreRing score={report.score} size={60} strokeWidth={5} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-white">{report.title}</h3>
                            <Badge
                              variant={
                                report.type === 'Assessment' ? 'default' : 'success'
                              }
                            >
                              {report.type}
                            </Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-4 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {report.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3" /> Score: {report.score}/100
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {report.highlights.map((h) => (
                              <span
                                key={h}
                                className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300"
                              >
                                {h}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExport(report)}
                          disabled={downloadingId === report.id}
                        >
                          {downloadingId === report.id ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-1.5 h-4 w-4" />
                          )}
                          Export
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
        </div>
      )}
    </div>
  );
}
