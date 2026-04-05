/**
 * Content Migration Orchestration Engine
 *
 * Manages content tree analysis, duplicate detection, reference validation,
 * migration planning with intelligent batching, execution orchestration,
 * and post-migration integrity verification.
 */
import { ContentHealth, MigrationItem, CompatibilityLevel, Severity, ValidationResult, ValidationCheck } from '@/types';
import {
  executeBatchTransfer,
  hasRealCredentials,
  type AemCredentials,
} from './aem-content-writer';

export interface ContentNode {
  path: string;
  type: 'page' | 'asset' | 'content_fragment' | 'experience_fragment' | 'tag' | 'config';
  title: string;
  template?: string;
  mimeType?: string;
  sizeBytes: number;
  lastModified: string;
  published: boolean;
  metadata: Record<string, unknown>;
  references: string[];
  children?: ContentNode[];
}
export interface DuplicateGroup { hash: string; similarity: number; nodes: ContentNode[]; recommendation: 'keep_first' | 'merge' | 'review'; }
export interface ReferenceIssue { sourcePath: string; targetPath: string; referenceType: 'link' | 'image' | 'asset_reference' | 'fragment_reference' | 'component_ref'; status: 'broken' | 'external' | 'cross_site' | 'valid'; suggestion: string | null; }
export interface MigrationSet { id: string; name: string; priority: number; items: MigrationItem[]; estimatedSizeGB: number; estimatedDurationMinutes: number; dependencies: string[]; }
export interface MigrationPlan { id: string; sets: MigrationSet[]; totalItems: number; totalSizeGB: number; estimatedDurationHours: number; mutablePaths: string[]; immutablePaths: string[]; redirectMappings: RedirectMapping[]; }
export interface RedirectMapping { sourcePath: string; targetPath: string; statusCode: 301 | 302; pattern: boolean; }
export interface ContentAnalysisResult { health: ContentHealth; nodesByType: Record<string, number>; largestAssets: ContentNode[]; orphanedContent: ContentNode[]; metadataQuality: MetadataQualityReport; }
export interface MetadataQualityReport { totalNodes: number; nodesWithTitle: number; nodesWithDescription: number; nodesWithTags: number; nodesWithAltText: number; averageCompleteness: number; issues: Array<{ path: string; missingFields: string[]; severity: Severity }>; }
export interface MigrationExecutionResult { status: 'completed' | 'partial' | 'failed'; itemsProcessed: number; itemsFailed: number; itemsSkipped: number; errors: Array<{ path: string; error: string }>; duration: number; }

export interface MigrationTargetConfig {
  sourceUrl: string;
  targetUrl: string;
  sourceCredentials: Record<string, unknown> | null;
  targetCredentials: Record<string, unknown> | null;
}

const IMMUTABLE_PREFIXES = ['/apps/', '/libs/', '/oak:index/'];

export class ContentMigrator {
  /** Full content tree analysis with health scoring and metadata quality. */
  async analyzeContent(nodes: ContentNode[]): Promise<ContentAnalysisResult> {
    const byType: Record<string, number> = {};
    let totalBytes = 0, published = 0, brokenRefs = 0;
    const allPaths = new Set(nodes.map((n) => n.path));
    const orphaned: ContentNode[] = [];
    const assets: ContentNode[] = [];
    for (const node of nodes) {
      byType[node.type] = (byType[node.type] ?? 0) + 1;
      totalBytes += node.sizeBytes;
      if (node.published) published++;
      for (const ref of node.references) if (ref.startsWith('/') && !allPaths.has(ref)) brokenRefs++;
      if (node.type === 'asset') assets.push(node);
      if (!node.published && node.type === 'page' && !nodes.some((o) => o !== node && o.references.includes(node.path)))
        orphaned.push(node);
    }
    assets.sort((a, b) => b.sizeBytes - a.sizeBytes);
    const mq = this.assessMetadata(nodes);
    return {
      health: { totalPages: byType['page'] ?? 0, totalAssets: byType['asset'] ?? 0, totalContentFragments: byType['content_fragment'] ?? 0,
        totalExperienceFragments: byType['experience_fragment'] ?? 0, duplicatesDetected: 0, brokenReferences: brokenRefs,
        metadataCompleteness: mq.averageCompleteness, structuralIssues: orphaned.length,
        totalSizeGB: totalBytes / (1024 ** 3), publishedPercentage: nodes.length > 0 ? (published / nodes.length) * 100 : 0 },
      nodesByType: byType, largestAssets: assets.slice(0, 20), orphanedContent: orphaned, metadataQuality: mq,
    };
  }

  /** Detect duplicate content using title similarity and metadata hashing. */
  async detectDuplicates(nodes: ContentNode[], threshold = 0.85): Promise<DuplicateGroup[]> {
    const groups: DuplicateGroup[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < nodes.length; i++) {
      if (seen.has(nodes[i].path)) continue;
      const similar: ContentNode[] = [nodes[i]];
      for (let j = i + 1; j < nodes.length; j++) {
        if (seen.has(nodes[j].path) || nodes[i].type !== nodes[j].type) continue;
        if (this.similarity(nodes[i], nodes[j]) >= threshold) { similar.push(nodes[j]); seen.add(nodes[j].path); }
      }
      if (similar.length > 1) {
        seen.add(nodes[i].path);
        groups.push({ hash: this.hash(nodes[i]), similarity: threshold, nodes: similar,
          recommendation: threshold > 0.95 ? 'keep_first' : threshold > 0.9 ? 'merge' : 'review' });
      }
    }
    return groups;
  }

  /** Validate all cross-references and links in the content tree. */
  async validateReferences(nodes: ContentNode[]): Promise<ReferenceIssue[]> {
    const issues: ReferenceIssue[] = [];
    const allPaths = new Set(nodes.map((n) => n.path));
    for (const node of nodes) for (const ref of node.references) {
      if (ref.startsWith('http://') || ref.startsWith('https://')) {
        issues.push({ sourcePath: node.path, targetPath: ref, referenceType: 'link', status: 'external', suggestion: null });
        continue;
      }
      if (!ref.startsWith('/')) continue;
      const refType = /\/content\/dam\//.test(ref) ? 'asset_reference' as const : /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(ref) ? 'image' as const : 'link' as const;
      if (!allPaths.has(ref)) {
        issues.push({ sourcePath: node.path, targetPath: ref, referenceType: refType, status: 'broken', suggestion: this.findClosest(ref, allPaths) });
      } else {
        const srcSite = node.path.match(/^\/content\/([^/]+)/)?.[1];
        const tgtSite = ref.match(/^\/content\/([^/]+)/)?.[1];
        if (srcSite && tgtSite && srcSite !== tgtSite)
          issues.push({ sourcePath: node.path, targetPath: ref, referenceType: refType, status: 'cross_site', suggestion: null });
      }
    }
    return issues;
  }

  /** Create migration sets with intelligent batching and dependency ordering. */
  async planMigration(nodes: ContentNode[], maxGB = 10): Promise<MigrationPlan> {
    const mutable: ContentNode[] = [], immutable: ContentNode[] = [];
    for (const n of nodes) (IMMUTABLE_PREFIXES.some((p) => n.path.startsWith(p)) ? immutable : mutable).push(n);
    const siteGroups = new Map<string, ContentNode[]>();
    for (const n of mutable) { const s = n.path.match(/^\/content\/([^/]+)/)?.[1] ?? '_root'; siteGroups.set(s, [...(siteGroups.get(s) ?? []), n]); }
    const sets: MigrationSet[] = [];
    let idx = 0;
    const typeOrder: Record<string, number> = { config: 0, tag: 1, content_fragment: 2, page: 3, experience_fragment: 4, asset: 5 };
    for (const [site, group] of siteGroups) {
      const sorted = [...group].sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));
      let batch: MigrationItem[] = [], batchBytes = 0;
      const maxBytes = maxGB * 1024 ** 3;
      for (const n of sorted) {
        if (batchBytes + n.sizeBytes > maxBytes && batch.length > 0) {
          sets.push(this.mkSet(idx++, site, batch, batchBytes)); batch = []; batchBytes = 0;
        }
        batch.push(this.toItem(n)); batchBytes += n.sizeBytes;
      }
      if (batch.length > 0) sets.push(this.mkSet(idx++, site, batch, batchBytes));
    }
    const redirects: RedirectMapping[] = [];
    for (const n of nodes) if (n.path.startsWith('/etc/')) {
      for (const [old, nw] of Object.entries({ '/etc/designs': '/apps', '/etc/cloudservices': '/conf', '/etc/tags': '/content/cq:tags' }))
        if (n.path.startsWith(old)) redirects.push({ sourcePath: n.path, targetPath: n.path.replace(old, nw), statusCode: 301, pattern: false });
    }
    const totalGB = nodes.reduce((s, n) => s + n.sizeBytes, 0) / 1024 ** 3;
    return { id: `plan-${Date.now()}`, sets, totalItems: nodes.length, totalSizeGB: totalGB,
      estimatedDurationHours: sets.reduce((t, s) => t + s.estimatedDurationMinutes, 0) / 60,
      mutablePaths: mutable.map((n) => n.path), immutablePaths: immutable.map((n) => n.path), redirectMappings: redirects };
  }

  /**
   * Orchestrate migration execution across sets with progress tracking.
   *
   * When a targetConfig with real credentials is provided, content is
   * transferred via Sling POST (small batches) or CRX Package Manager
   * (large batches). Without credentials the method falls back to
   * simulation mode so the demo experience is preserved.
   */
  async executeMigration(
    plan: MigrationPlan,
    onProgress?: (id: string, pct: number) => void,
    targetConfig?: MigrationTargetConfig,
  ): Promise<MigrationExecutionResult> {
    const start = Date.now();
    let ok = 0, fail = 0, skip = 0;
    const errors: Array<{ path: string; error: string }> = [];

    // Determine whether we have real target credentials
    const useRealTransfer =
      targetConfig &&
      targetConfig.sourceUrl &&
      targetConfig.targetUrl &&
      hasRealCredentials(targetConfig.targetCredentials);

    if (!useRealTransfer) {
      console.warn(
        '[ContentMigrator] No target credentials configured — running in simulation mode',
      );
    }

    for (const set of plan.sets) {
      if (useRealTransfer) {
        // Real transfer via AEM Content Writer (ADR-050)
        const sourceCreds: AemCredentials = {
          authType: (targetConfig.sourceCredentials?.authType as string) ?? 'basic',
          accessToken: targetConfig.sourceCredentials?.accessToken as string | undefined,
          token: targetConfig.sourceCredentials?.token as string | undefined,
          username: targetConfig.sourceCredentials?.username as string | undefined,
          password: targetConfig.sourceCredentials?.password as string | undefined,
        };

        const targetCreds: AemCredentials = {
          authType: (targetConfig.targetCredentials?.authType as string) ?? 'basic',
          accessToken: targetConfig.targetCredentials?.accessToken as string | undefined,
          token: targetConfig.targetCredentials?.token as string | undefined,
          username: targetConfig.targetCredentials?.username as string | undefined,
          password: targetConfig.targetCredentials?.password as string | undefined,
        };

        const result = await executeBatchTransfer(
          targetConfig.sourceUrl,
          targetConfig.targetUrl,
          set.items,
          { source: sourceCreds, target: targetCreds },
          (processed, total, current) => {
            onProgress?.(set.id, (processed / total) * 100);
          },
        );

        ok += result.success;
        fail += result.failed;
        skip += result.skipped;
        errors.push(...result.errors);
      } else {
        // Simulation mode — mark items as completed without HTTP calls
        for (let i = 0; i < set.items.length; i++) {
          const item = set.items[i];
          try {
            if (item.compatibilityLevel === CompatibilityLevel.BLOCKER) {
              item.status = 'skipped';
              skip++;
              continue;
            }
            item.status = 'processing';
            item.status = 'completed';
            item.processedAt = new Date().toISOString();
            ok++;
          } catch (e) {
            item.status = 'failed';
            item.error = e instanceof Error ? e.message : String(e);
            fail++;
            errors.push({ path: item.sourcePath, error: item.error });
          }
          onProgress?.(set.id, ((i + 1) / set.items.length) * 100);
        }
      }
    }

    return {
      status: fail === 0 ? 'completed' : ok > 0 ? 'partial' : 'failed',
      itemsProcessed: ok,
      itemsFailed: fail,
      itemsSkipped: skip,
      errors,
      duration: Date.now() - start,
    };
  }

  /** Post-migration content integrity validation. */
  async validateMigration(source: ContentNode[], migrated: ContentNode[]): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];
    const mp = new Set(migrated.map((n) => n.path));
    const missing = source.filter((s) => !mp.has(s.path)).length;
    checks.push({ name: 'Content completeness', passed: missing === 0, message: missing === 0 ? 'All content migrated.' : `${missing} missing.`, severity: missing > 0 ? Severity.CRITICAL : Severity.INFO });
    let metaIssues = 0;
    for (const s of source) { const m = migrated.find((n) => n.path === s.path); if (m && s.title !== m.title) metaIssues++; }
    checks.push({ name: 'Metadata preservation', passed: metaIssues === 0, message: metaIssues === 0 ? 'Metadata preserved.' : `${metaIssues} discrepancies.`, severity: metaIssues > 0 ? Severity.HIGH : Severity.INFO });
    let broken = 0;
    for (const n of migrated) for (const r of n.references) if (r.startsWith('/') && !mp.has(r)) broken++;
    checks.push({ name: 'Reference integrity', passed: broken === 0, message: broken === 0 ? 'All refs valid.' : `${broken} broken.`, severity: broken > 0 ? Severity.HIGH : Severity.INFO });
    return { passed: checks.every((c) => c.passed), checks, score: (checks.filter((c) => c.passed).length / checks.length) * 100 };
  }

  /** Generate URL redirect mappings from source to target paths. */
  async generateRedirects(source: ContentNode[], transforms?: Map<string, string>): Promise<RedirectMapping[]> {
    const mappings: RedirectMapping[] = [];
    for (const n of source) {
      if (n.type !== 'page') continue;
      const target = transforms?.get(n.path) ?? n.path;
      if (target !== n.path) mappings.push({ sourcePath: n.path, targetPath: target, statusCode: 301, pattern: false });
      const vanity = n.metadata['sling:vanityPath'] as string | undefined;
      if (vanity) mappings.push({ sourcePath: vanity, targetPath: target, statusCode: 301, pattern: false });
    }
    mappings.push({ sourcePath: '/etc/designs/(.*)', targetPath: '/apps/$1', statusCode: 301, pattern: true });
    mappings.push({ sourcePath: '/etc/cloudservices/(.*)', targetPath: '/conf/$1/settings/cloudconfigs', statusCode: 301, pattern: true });
    return mappings;
  }

  private assessMetadata(nodes: ContentNode[]): MetadataQualityReport {
    let wTitle = 0, wDesc = 0, wTags = 0, wAlt = 0;
    const issues: MetadataQualityReport['issues'] = [];
    for (const n of nodes) {
      const miss: string[] = [];
      if (n.title) wTitle++; else miss.push('title');
      if (n.metadata['jcr:description'] || n.metadata['dc:description']) wDesc++; else miss.push('description');
      if (n.metadata['cq:tags'] || n.metadata['dam:tags']) wTags++; else miss.push('tags');
      if (n.metadata['dam:altText'] || n.type !== 'asset') wAlt++; else miss.push('altText');
      if (miss.length > 0) issues.push({ path: n.path, missingFields: miss, severity: miss.length >= 3 ? Severity.HIGH : Severity.MEDIUM });
    }
    const total = nodes.length || 1;
    return { totalNodes: nodes.length, nodesWithTitle: wTitle, nodesWithDescription: wDesc, nodesWithTags: wTags,
      nodesWithAltText: wAlt, averageCompleteness: Math.round(((wTitle + wDesc + wTags + wAlt) / (total * 4)) * 100), issues };
  }

  private similarity(a: ContentNode, b: ContentNode): number {
    let s = 0, f = 0;
    if (a.title && b.title) {
      const wa = new Set(a.title.toLowerCase().split(/\s+/)), wb = new Set(b.title.toLowerCase().split(/\s+/));
      const inter = [...wa].filter((w) => wb.has(w)).length, union = new Set([...wa, ...wb]).size;
      s += union > 0 ? inter / union : 0; f++;
    }
    if (a.template && b.template) { s += a.template === b.template ? 1 : 0; f++; }
    if (a.sizeBytes > 0 && b.sizeBytes > 0) { s += Math.min(a.sizeBytes, b.sizeBytes) / Math.max(a.sizeBytes, b.sizeBytes); f++; }
    return f > 0 ? s / f : 0;
  }

  private hash(n: ContentNode): string {
    let h = 0; const s = `${n.type}|${n.title}|${n.template ?? ''}`;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  }

  private findClosest(target: string, paths: Set<string>): string | null {
    const seg = target.split('/');
    for (let l = seg.length; l > 2; l--) { const partial = seg.slice(0, l).join('/'); for (const p of paths) if (p.startsWith(partial) && p !== target) return p; }
    return null;
  }

  private toItem(n: ContentNode): MigrationItem {
    return { id: `item-${n.path.replace(/\//g, '-')}`, type: n.type, name: n.title || n.path.split('/').pop() || 'unknown',
      sourcePath: n.path, targetPath: n.path, status: 'pending', compatibilityLevel: CompatibilityLevel.COMPATIBLE,
      autoFixed: false, validationResult: null, error: null, processedAt: null };
  }

  private mkSet(i: number, site: string, items: MigrationItem[], bytes: number): MigrationSet {
    const gb = bytes / 1024 ** 3;
    return { id: `set-${i}`, name: `${site} - Batch ${i + 1}`, priority: i, items, estimatedSizeGB: gb,
      estimatedDurationMinutes: Math.max(5, Math.ceil(gb * 10)), dependencies: i > 0 ? [`set-${i - 1}`] : [] };
  }
}
