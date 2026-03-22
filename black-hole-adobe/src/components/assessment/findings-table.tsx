'use client';

import { useState } from 'react';
import { Search, Filter, Wrench, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { SeverityBadge, CompatibilityBadge, Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import type { AssessmentFinding } from '@/types';
import { Severity } from '@/types';

interface FindingsTableProps {
  findings: AssessmentFinding[];
}

export function FindingsTable({ findings }: FindingsTableProps) {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');

  const filtered = findings.filter((f) => {
    const matchesSearch =
      search === '' ||
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.category.toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || f.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const columns: Column<AssessmentFinding & Record<string, unknown>>[] = [
    {
      key: 'severity',
      header: 'Severity',
      sortable: true,
      className: 'w-28',
      render: (item) => <SeverityBadge severity={item.severity} />,
    },
    {
      key: 'title',
      header: 'Finding',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium text-white">{item.title}</p>
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{item.affectedPath}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      className: 'w-32',
    },
    {
      key: 'compatibilityLevel',
      header: 'Compatibility',
      className: 'w-32',
      render: (item) => <CompatibilityBadge level={item.compatibilityLevel} />,
    },
    {
      key: 'autoFixAvailable',
      header: 'Auto-fix',
      className: 'w-24',
      render: (item) =>
        item.autoFixAvailable ? (
          <Badge variant="success">
            <Wrench className="h-3 w-3" />
            Yes
          </Badge>
        ) : (
          <span className="text-slate-500">Manual</span>
        ),
    },
    {
      key: 'estimatedHours',
      header: 'Effort',
      sortable: true,
      className: 'w-20',
      render: (item) => (
        <span className="font-mono text-xs">
          {item.estimatedHours > 0 ? `${item.estimatedHours}h` : '--'}
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search findings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-slate-500" />
          {(['all', Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW] as const).map(
            (sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  severityFilter === sev
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                )}
              >
                {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered as (AssessmentFinding & Record<string, unknown>)[]}
        rowKey={(item) => item.id}
        pageSize={10}
        emptyMessage="No findings match your filters"
      />
    </div>
  );
}
