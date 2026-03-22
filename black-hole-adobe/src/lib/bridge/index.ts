/**
 * Navigator Bridge — Barrel Export
 *
 * Connects Black Hole to the Navigator Portal for seamless
 * migration-to-managed-services handoff.
 */

export { NavigatorClient } from './navigator-client';
export type {
  NavigatorOrganization,
  NavigatorTicket,
  NavigatorKnowledgeArticle,
  NavigatorTimeEntry,
  NavigatorROIEntry,
  NavigatorMemory,
  RuVectorEntry,
  NavigatorApiResponse,
} from './navigator-client';

export { MigrationExporter } from './migration-exporter';
export type {
  ExportResult,
  ExportProgress,
} from './migration-exporter';

export { generateHandoffReport } from './handoff-report';
export type {
  HandoffReport,
  MigrationSummary,
  ItemsSummary,
  KnowledgeBaseSummary,
  EnvironmentContext,
  Recommendation,
  PlanRecommendation,
  TicketEstimate,
} from './handoff-report';
