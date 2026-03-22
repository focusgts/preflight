'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress-bar';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { MigrationWizard } from '@/components/migration/migration-wizard';
import { ProgressTracker } from '@/components/migration/progress-tracker';
import { mockMigrations } from '@/config/mock-data';
import { MigrationStatus, type MigrationProject } from '@/types';

const migrationTypeLabels: Record<string, string> = {
  aem_onprem_to_cloud: 'AEM On-Prem to Cloud',
  aem_ams_to_cloud: 'AEM AMS to Cloud',
  wordpress_to_aem: 'WordPress to AEM',
  ga_to_cja: 'GA4 to CJA',
  campaign_classic_to_v8: 'Campaign to v8',
  shopify_to_commerce: 'Shopify to Commerce',
  dam_to_aem_assets: 'DAM to AEM Assets',
  aam_to_rtcdp: 'AAM to RTCDP',
};

export default function MigrationsPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMigration, setSelectedMigration] = useState<MigrationProject | null>(null);

  const filtered = mockMigrations.filter((m) =>
    search === '' ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.organizationName.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<MigrationProject & Record<string, unknown>>[] = [
    {
      key: 'name',
      header: 'Migration',
      sortable: true,
      render: (item) => (
        <button
          onClick={() => setSelectedMigration(item as unknown as MigrationProject)}
          className="text-left group"
        >
          <p className="font-medium text-white group-hover:text-violet-400 transition-colors">
            {item.name as string}
          </p>
          <p className="text-xs text-slate-500">{item.organizationName as string}</p>
        </button>
      ),
    },
    {
      key: 'migrationType',
      header: 'Type',
      sortable: true,
      className: 'w-44',
      render: (item) => (
        <span className="text-sm text-slate-300">
          {migrationTypeLabels[item.migrationType as string] ?? String(item.migrationType)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      className: 'w-32',
      render: (item) => <StatusBadge status={item.status as MigrationStatus} />,
    },
    {
      key: 'progress',
      header: 'Progress',
      sortable: true,
      className: 'w-40',
      render: (item) => (
        <ProgressBar
          value={item.progress as number}
          showPercentage
          size="sm"
          active={(item.status as MigrationStatus) === MigrationStatus.EXECUTING || (item.status as MigrationStatus) === MigrationStatus.TRANSFORMING}
        />
      ),
    },
    {
      key: 'estimatedCost',
      header: 'Est. Cost',
      sortable: true,
      className: 'w-28',
      render: (item) => (
        <span className="font-mono text-sm text-slate-300">
          ${((item.estimatedCost as number) / 1000).toFixed(0)}k
        </span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      className: 'w-32',
      render: (item) => (
        <span className="text-sm text-slate-400">
          {new Date(item.updatedAt as string).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Migrations</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage and monitor all migration projects.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4" />
          New Migration
        </Button>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search migrations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered as (MigrationProject & Record<string, unknown>)[]}
        rowKey={(item) => item.id as string}
        pageSize={10}
        emptyMessage="No migrations found"
      />

      {/* New Migration Wizard */}
      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title="Create New Migration"
        size="xl"
      >
        <MigrationWizard />
      </Modal>

      {/* Migration Detail Side Panel */}
      {selectedMigration && selectedMigration.phases.length > 0 && (
        <Modal
          open={!!selectedMigration}
          onClose={() => setSelectedMigration(null)}
          title={selectedMigration.name}
          size="lg"
        >
          <ProgressTracker
            phases={selectedMigration.phases}
            overallProgress={selectedMigration.progress}
            estimatedTimeRemaining="~2 weeks"
          />
        </Modal>
      )}
    </div>
  );
}
