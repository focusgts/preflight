'use client';

/**
 * EventFeed — Live scrolling event log with color-coded entries.
 *
 * Features:
 * - Auto-scrolling list of recent events
 * - Color-coded borders by type (info, success, warning, error)
 * - Pause/resume auto-scroll
 * - Filter by event type
 * - Smooth entry animations
 * - Maximum 100 events displayed
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Pause,
  Play,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { LiveEvent } from '@/config/mock-live-data';

// ── Props ──────────────────────────────────────────────────

interface EventFeedProps {
  events: LiveEvent[];
  maxDisplay?: number;
  newestFirst?: boolean;
  className?: string;
}

// ── Style Maps ─────────────────────────────────────────────

const TYPE_STYLES: Record<
  string,
  { border: string; icon: typeof Info; iconColor: string; bg: string }
> = {
  info: {
    border: 'border-l-cyan-500',
    icon: Info,
    iconColor: 'text-cyan-400',
    bg: 'bg-cyan-500/5',
  },
  success: {
    border: 'border-l-emerald-500',
    icon: CheckCircle,
    iconColor: 'text-emerald-400',
    bg: 'bg-emerald-500/5',
  },
  warning: {
    border: 'border-l-amber-500',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    bg: 'bg-amber-500/5',
  },
  error: {
    border: 'border-l-rose-500',
    icon: XCircle,
    iconColor: 'text-rose-400',
    bg: 'bg-rose-500/5',
  },
};

const EVENT_TYPES = ['all', 'info', 'success', 'warning', 'error'] as const;
type FilterType = (typeof EVENT_TYPES)[number];

// ── Timestamp Formatter ────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ── Component ──────────────────────────────────────────────

export function EventFeed({
  events,
  maxDisplay = 100,
  newestFirst = true,
  className,
}: EventFeedProps) {
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilters, setShowFilters] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter and slice events
  const filteredEvents = events
    .filter((e) => filter === 'all' || e.type === filter)
    .slice(-maxDisplay);

  const displayEvents = newestFirst
    ? [...filteredEvents].reverse()
    : filteredEvents;

  // Auto-scroll when not paused
  useEffect(() => {
    if (paused || !scrollRef.current) return;

    const el = scrollRef.current;
    if (newestFirst) {
      el.scrollTop = 0;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [events.length, paused, newestFirst]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-slate-700/50 bg-slate-800/50',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Live Event Feed</h3>
          <span className="text-xs text-slate-500">
            {filteredEvents.length} events
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white',
              showFilters && 'bg-slate-700/50 text-white',
            )}
          >
            <Filter className="h-4 w-4" />
          </button>

          {/* Pause/Play */}
          <button
            onClick={() => setPaused(!paused)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
              paused
                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white',
            )}
          >
            {paused ? (
              <>
                <Play className="h-3 w-3" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" />
                Pause
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-slate-700/50"
          >
            <div className="flex gap-1.5 px-5 py-2">
              {EVENT_TYPES.map((type) => {
                const isActive = filter === type;
                return (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                      isActive
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200',
                    )}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event List */}
      <div
        ref={scrollRef}
        className="max-h-[360px] overflow-y-auto scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700"
      >
        <AnimatePresence initial={false}>
          {displayEvents.map((event) => {
            const style = TYPE_STYLES[event.type] ?? TYPE_STYLES.info;
            const Icon = style.icon;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -8, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'border-b border-slate-700/30 border-l-2 px-5 py-2.5',
                  style.border,
                  style.bg,
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.iconColor)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200">{event.message}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatTime(event.timestamp)}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {displayEvents.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            No events to display
          </div>
        )}
      </div>
    </motion.div>
  );
}
