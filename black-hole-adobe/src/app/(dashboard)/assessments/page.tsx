'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileSearch, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScoreRing } from '@/components/ui/score-ring';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import { ReadinessReport } from '@/components/assessment/readiness-report';
import { mockAssessmentResult, mockMigrations } from '@/config/mock-data';
import { MigrationStatus } from '@/types';

const tabs = [
  { id: 'completed', label: 'Completed Assessments' },
  { id: 'in-progress', label: 'In Progress' },
];

const assessmentSummaries = [
  {
    id: 'assess-001',
    projectName: 'Acme Corp AEM Cloud Migration',
    org: 'Acme Corporation',
    score: 74,
    status: MigrationStatus.ASSESSED,
    findings: 7,
    date: '2026-01-16',
  },
  {
    id: 'assess-002',
    projectName: 'GlobalBank Analytics to CJA',
    org: 'Global Banking Corp',
    score: 91,
    status: MigrationStatus.COMPLETED,
    findings: 3,
    date: '2025-11-10',
  },
  {
    id: 'assess-003',
    projectName: 'HealthPlus Campaign v8 Upgrade',
    org: 'HealthPlus Medical',
    score: 82,
    status: MigrationStatus.ASSESSED,
    findings: 5,
    date: '2026-01-25',
  },
];

const inProgressAssessments = [
  {
    id: 'assess-ip-001',
    projectName: 'TechStart WordPress to AEM EDS',
    org: 'TechStart Inc',
    progress: 45,
    status: MigrationStatus.ASSESSING,
    startedAt: '2026-03-19',
  },
];

export default function AssessmentsPage() {
  const [activeTab, setActiveTab] = useState('completed');
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);

  if (selectedAssessment === 'assess-001') {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <Button variant="ghost" onClick={() => setSelectedAssessment(null)}>
            <ArrowRight className="h-4 w-4 rotate-180" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Readiness Report</h1>
            <p className="mt-1 text-sm text-slate-400">Acme Corp AEM Cloud Migration</p>
          </div>
        </motion.div>
        <ReadinessReport assessment={mockAssessmentResult} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white">Assessments</h1>
        <p className="mt-1 text-sm text-slate-400">
          View readiness assessments and detailed findings for your migration projects.
        </p>
      </motion.div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <TabPanel tabId="completed" activeTab={activeTab}>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assessmentSummaries.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card hover className="cursor-pointer" onClick={() => setSelectedAssessment(a.id)}>
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
      </TabPanel>

      <TabPanel tabId="in-progress" activeTab={activeTab}>
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
      </TabPanel>
    </div>
  );
}
