'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileSearch, ArrowRight, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScoreRing } from '@/components/ui/score-ring';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import { ReadinessReport } from '@/components/assessment/readiness-report';
import { MigrationStatus } from '@/types';
import type { AssessmentResult } from '@/types';

const tabs = [
  { id: 'completed', label: 'Completed Assessments' },
  { id: 'in-progress', label: 'In Progress' },
];

interface AssessmentSummary {
  id: string;
  projectName: string;
  org: string;
  score: number;
  status: MigrationStatus;
  findings: number;
  date: string;
}

interface InProgressAssessment {
  id: string;
  projectName: string;
  org: string;
  progress: number;
  status: MigrationStatus;
  startedAt: string;
}

// Skeleton card for loading state
function SkeletonCard() {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-3 w-32 animate-pulse rounded bg-slate-800" />
        </div>
        <div className="h-14 w-14 animate-pulse rounded-full bg-slate-800" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-800" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-slate-800" />
        </div>
        <div className="h-3 w-20 animate-pulse rounded bg-slate-800" />
      </div>
    </Card>
  );
}

export default function AssessmentsPage() {
  const [activeTab, setActiveTab] = useState('completed');
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);
  const [selectedAssessmentData, setSelectedAssessmentData] = useState<AssessmentResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [completedAssessments, setCompletedAssessments] = useState<AssessmentSummary[]>([]);
  const [inProgressAssessments, setInProgressAssessments] = useState<InProgressAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/assessments?pageSize=100');
      if (!res.ok) throw new Error(`Failed to fetch assessments (${res.status})`);
      const json = await res.json();
      const items: AssessmentResult[] = json.data ?? [];

      const completed: AssessmentSummary[] = [];
      const inProgress: InProgressAssessment[] = [];

      for (const item of items) {
        // Items with a full score are "completed" assessments
        completed.push({
          id: item.id,
          projectName: item.migrationProjectId,
          org: '',
          score: item.overallScore,
          status: MigrationStatus.ASSESSED,
          findings: item.findings.length,
          date: item.createdAt.slice(0, 10),
        });
      }

      // Also fetch migrations that are in ASSESSING status
      const migRes = await fetch('/api/migrations?status=assessing&pageSize=100');
      if (migRes.ok) {
        const migJson = await migRes.json();
        const migrations = migJson.data ?? [];
        for (const mig of migrations) {
          inProgress.push({
            id: mig.id,
            projectName: mig.name,
            org: mig.organizationName,
            progress: mig.progress ?? 0,
            status: MigrationStatus.ASSESSING,
            startedAt: mig.createdAt?.slice(0, 10) ?? '',
          });
        }
      }

      // Enrich completed assessments with migration names where possible
      if (completed.length > 0) {
        const allMigRes = await fetch('/api/migrations?pageSize=100');
        if (allMigRes.ok) {
          const allMigJson = await allMigRes.json();
          const allMigs = allMigJson.data ?? [];
          const migMap = new Map<string, { name: string; org: string }>();
          for (const m of allMigs) {
            migMap.set(m.id, { name: m.name, org: m.organizationName });
          }
          for (const c of completed) {
            const mig = migMap.get(c.projectName);
            if (mig) {
              c.projectName = mig.name;
              c.org = mig.org;
            }
          }
        }
      }

      setCompletedAssessments(completed);
      setInProgressAssessments(inProgress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const handleSelectAssessment = async (id: string) => {
    setSelectedAssessment(id);
    setDetailLoading(true);
    setDetailError(null);
    setSelectedAssessmentData(null);
    try {
      const res = await fetch(`/api/assessments/${id}`);
      if (!res.ok) throw new Error(`Failed to fetch assessment details (${res.status})`);
      const json = await res.json();
      setSelectedAssessmentData(json.data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load assessment');
    } finally {
      setDetailLoading(false);
    }
  };

  // Detail view
  if (selectedAssessment) {
    const summary = completedAssessments.find((a) => a.id === selectedAssessment);
    const title = summary?.projectName ?? selectedAssessment;

    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedAssessment(null);
              setSelectedAssessmentData(null);
              setDetailError(null);
            }}
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Readiness Report</h1>
            <p className="mt-1 text-sm text-slate-400">{title}</p>
          </div>
        </motion.div>

        {detailLoading && (
          <div className="space-y-4">
            <Card>
              <div className="space-y-3">
                <div className="h-6 w-64 animate-pulse rounded bg-slate-800" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-800" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-800" />
                <div className="grid grid-cols-2 gap-4 pt-4 md:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-800" />
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {detailError && (
          <Card>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertCircle className="h-10 w-10 text-red-400" />
              <p className="text-sm text-slate-300">{detailError}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSelectAssessment(selectedAssessment)}
              >
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Retry
              </Button>
            </div>
          </Card>
        )}

        {selectedAssessmentData && (
          <ReadinessReport assessment={selectedAssessmentData} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Assessments</h1>
          <p className="mt-1 text-sm text-slate-400">
            View readiness assessments and detailed findings for your migration projects.
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Error state */}
      {error && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-slate-300">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchAssessments}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Retry
            </Button>
          </div>
        </Card>
      )}

      {!error && (
        <>
          <TabPanel tabId="completed" activeTab={activeTab}>
            {loading ? (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : completedAssessments.length === 0 ? (
              <Card>
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileSearch className="h-12 w-12 text-slate-600" />
                  <p className="text-sm text-slate-400">
                    No assessments yet. Connect a source and run your first assessment.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedAssessments.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <Card hover className="cursor-pointer" onClick={() => handleSelectAssessment(a.id)}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{a.projectName}</p>
                          <p className="text-xs text-slate-500">{a.org}</p>
                        </div>
                        <ScoreRing score={a.score} size={56} strokeWidth={4} />
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={a.status} />
                          <Badge variant="default">{a.findings} findings</Badge>
                        </div>
                        <span className="text-xs text-slate-500">{a.date}</span>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabPanel>

          <TabPanel tabId="in-progress" activeTab={activeTab}>
            {loading ? (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 1 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : inProgressAssessments.length === 0 ? (
              <Card>
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileSearch className="h-12 w-12 text-slate-600" />
                  <p className="text-sm text-slate-400">
                    No assessments in progress.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {inProgressAssessments.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <Card>
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-cyan-500/10 p-2.5">
                          <FileSearch className="h-5 w-5 text-cyan-400 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{a.projectName}</p>
                          <p className="text-xs text-slate-500">{a.org}</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <StatusBadge status={a.status} />
                          <span className="text-xs font-mono text-slate-400">{a.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 animate-pulse"
                            initial={{ width: 0 }}
                            animate={{ width: `${a.progress}%` }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Started {a.startedAt}
                      </p>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabPanel>
        </>
      )}
    </div>
  );
}
