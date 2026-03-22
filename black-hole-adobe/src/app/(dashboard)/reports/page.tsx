'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScoreRing } from '@/components/ui/score-ring';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Shield,
  Clock,
  DollarSign,
} from 'lucide-react';

const reports = [
  {
    id: '1',
    title: 'ACME Corp AEM Migration — Assessment Report',
    type: 'Assessment',
    date: 'Mar 18, 2026',
    score: 62,
    status: 'completed',
    highlights: ['85 bundles with restricted APIs', '12% DAM duplicates', '$2.57M projected savings'],
  },
  {
    id: '2',
    title: 'ACME Corp Analytics to CJA — Migration Report',
    type: 'Migration',
    date: 'Mar 15, 2026',
    score: 94,
    status: 'completed',
    highlights: ['147 segments migrated', 'XDM schemas generated', '100% data parity validated'],
  },
  {
    id: '3',
    title: 'GlobalRetail WordPress to AEM — Assessment Report',
    type: 'Assessment',
    date: 'Mar 12, 2026',
    score: 78,
    status: 'completed',
    highlights: ['1,247 pages analyzed', '15 plugin equivalents mapped', 'URL redirects generated'],
  },
  {
    id: '4',
    title: 'FinServ Campaign Classic to v8 — Compliance Report',
    type: 'Compliance',
    date: 'Mar 10, 2026',
    score: 88,
    status: 'completed',
    highlights: ['GDPR compliant', '23 PII fields detected & masked', 'Consent records preserved'],
  },
];

const statCards = [
  { label: 'Reports Generated', value: '24', icon: FileText, color: 'text-violet-400' },
  { label: 'Avg Readiness Score', value: '71', icon: TrendingUp, color: 'text-cyan-400' },
  { label: 'Total Time Saved', value: '847hrs', icon: Clock, color: 'text-emerald-400' },
  { label: 'Total Cost Saved', value: '$4.2M', icon: DollarSign, color: 'text-amber-400' },
];

export default function ReportsPage() {
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
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

      <div className="space-y-3">
        {reports.map((report, i) => (
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
                    <Badge variant={
                      report.type === 'Assessment' ? 'default' :
                      report.type === 'Compliance' ? 'warning' : 'success'
                    }>
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
                      <span key={h} className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Download className="mr-1.5 h-4 w-4" />
                  Export
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
