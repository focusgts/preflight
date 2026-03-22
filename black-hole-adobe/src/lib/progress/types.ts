/**
 * Progress Event Type Definitions
 *
 * Types for real-time migration progress tracking via Server-Sent Events.
 */

export type ProgressEventType =
  | 'phase_start'
  | 'phase_progress'
  | 'item_processed'
  | 'phase_complete'
  | 'migration_complete'
  | 'error';

export interface ProgressEvent {
  type: ProgressEventType;
  migrationId: string;
  phase: string;
  progress: number; // 0-100
  message: string;
  timestamp: string;
  details: ProgressEventDetails;
}

export interface ProgressEventDetails {
  /** Name of the item being processed */
  itemName?: string;
  /** Number of items processed so far in the current phase */
  itemsProcessed?: number;
  /** Total items in the current phase */
  itemsTotal?: number;
  /** Whether the current item succeeded */
  success?: boolean;
  /** Error message if something failed */
  errorMessage?: string;
  /** Estimated seconds remaining */
  estimatedSecondsRemaining?: number;
  /** Throughput: items per second */
  throughput?: number;
  /** Arbitrary extra data */
  [key: string]: unknown;
}

export interface MigrationProgressState {
  migrationId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  overallProgress: number; // 0-100
  currentPhase: string;
  phases: PhaseProgressState[];
  events: ProgressEvent[];
  startedAt: string | null;
  completedAt: string | null;
  isConnected: boolean;
}

export interface PhaseProgressState {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  itemsProcessed: number;
  itemsTotal: number;
  startedAt: string | null;
  completedAt: string | null;
}
