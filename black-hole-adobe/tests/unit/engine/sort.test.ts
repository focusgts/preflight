/**
 * Tests for SortEngine
 *
 * Covers Adobe product tag classification, SEA category classification,
 * compatibility assessment, readiness scoring, effort estimation, risk
 * scoring, duplicate detection, and batch classification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SortEngine,
  type ClassificationResult,
} from '@/lib/engine/sort';
import {
  AdobeProduct,
  SEACategory,
  CompatibilityLevel,
} from '@/types';
import type { MigrationItem } from '@/types';

// ---- Helpers ----

function makeItem(overrides: Partial<MigrationItem> = {}): MigrationItem {
  return {
    id: overrides.id ?? `item-${Math.random().toString(36).slice(2, 8)}`,
    type: overrides.type ?? 'content',
    name: overrides.name ?? 'test-item',
    sourcePath: overrides.sourcePath ?? '/content/test',
    targetPath: overrides.targetPath ?? null,
    status: overrides.status ?? 'pending',
    compatibilityLevel: overrides.compatibilityLevel ?? CompatibilityLevel.COMPATIBLE,
    autoFixed: overrides.autoFixed ?? false,
    validationResult: overrides.validationResult ?? null,
    error: overrides.error ?? null,
    processedAt: overrides.processedAt ?? null,
  };
}

// ============================================================
// Tests
// ============================================================

describe('SortEngine', () => {
  let engine: SortEngine;

  beforeEach(() => {
    engine = new SortEngine();
  });

  // ----------------------------------------------------------
  // Adobe Product Tag Classification
  // ----------------------------------------------------------

  describe('Adobe product tag classification', () => {
    it('should detect AEM Sites from page-related keywords', () => {
      const item = makeItem({ type: 'page', name: 'homepage', sourcePath: '/content/site/en/home' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.AEM_SITES);
    });

    it('should detect AEM Sites from template keyword', () => {
      const item = makeItem({ name: 'editable-template', sourcePath: '/conf/mysite/settings/wcm/templates/hero' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.AEM_SITES);
    });

    it('should detect AEM Assets from DAM path', () => {
      const item = makeItem({ name: 'banner.jpg', sourcePath: '/content/dam/mysite/banner.jpg' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.AEM_ASSETS);
    });

    it('should detect AEM Assets from dynamic-media keyword', () => {
      const item = makeItem({ name: 'dynamic-media-config', sourcePath: '/conf/dynamic-media/settings' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.AEM_ASSETS);
    });

    it('should detect Analytics from evar/prop keywords', () => {
      const item = makeItem({ name: 'evar-mapping', sourcePath: '/analytics/report-suite/config' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.ANALYTICS);
    });

    it('should detect Target from ab-test keyword', () => {
      const item = makeItem({ name: 'ab-test-homepage', sourcePath: '/target/activities/homepage' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.TARGET);
    });

    it('should detect Campaign from delivery keyword', () => {
      const item = makeItem({ name: 'email-delivery', sourcePath: '/campaign/delivery/welcome-email' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.CAMPAIGN);
    });

    it('should detect AEM Forms from adaptive-form keyword', () => {
      const item = makeItem({ name: 'contact-adaptive-form', sourcePath: '/content/forms/contact' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.AEM_FORMS);
    });

    it('should detect Commerce from magento/catalog keywords', () => {
      const item = makeItem({ name: 'product-catalog', sourcePath: '/commerce/catalog/products' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.COMMERCE);
    });

    it('should detect Marketo from smart-campaign keyword', () => {
      const item = makeItem({ name: 'smart-campaign-lead-nurture', sourcePath: '/marketo/programs' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.MARKETO);
    });

    it('should detect AEP from xdm/schema keywords', () => {
      const item = makeItem({ name: 'xdm-profile-schema', sourcePath: '/aep/schemas/profile' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.AEP);
    });

    it('should detect Workfront from project/task keywords', () => {
      const item = makeItem({ name: 'workfront-project-template', sourcePath: '/workfront/templates' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.WORKFRONT);
    });

    it('should detect multiple products from a single item', () => {
      const item = makeItem({ name: 'dam-page-component', sourcePath: '/content/site/dam/component' });
      const result = engine.classifyItem(item);

      // Should match both AEM Sites (site, component) and AEM Assets (dam)
      expect(result.adobeProducts.length).toBeGreaterThanOrEqual(2);
    });

    it('should fall back to AEM Sites for html file extension', () => {
      const item = makeItem({ type: 'unknown', name: 'file', sourcePath: '/unknown/path/file.html' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.AEM_SITES);
    });

    it('should fall back to AEM Assets for image file extensions', () => {
      const item = makeItem({ type: 'unknown', name: 'image', sourcePath: '/some/path/image.jpg' });
      const result = engine.classifyItem(item);

      expect(result.adobeProducts).toContain(AdobeProduct.AEM_ASSETS);
    });
  });

  // ----------------------------------------------------------
  // SEA Category Classification
  // ----------------------------------------------------------

  describe('SEA category classification', () => {
    it('should classify COMPATIBLE items as SUPPORT', () => {
      const item = makeItem({ type: 'page', sourcePath: '/content/site/en' });
      const result = engine.classifyItem(item);

      expect(result.seaCategory).toBe(SEACategory.SUPPORT);
    });

    it('should classify AUTO_FIXABLE items as SUPPORT', () => {
      const item = makeItem({
        name: 'sling:resourceType-config',
        sourcePath: '/apps/mysite/sling:resourceType',
      });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.AUTO_FIXABLE);
      expect(result.seaCategory).toBe(SEACategory.SUPPORT);
    });

    it('should classify MANUAL_FIX items as ENHANCE', () => {
      const item = makeItem({
        name: 'custom-servlet-handler',
        sourcePath: '/apps/mysite/custom-servlet',
      });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.MANUAL_FIX);
      expect(result.seaCategory).toBe(SEACategory.ENHANCE);
    });

    it('should classify BLOCKER items as ADVISE', () => {
      const item = makeItem({
        name: 'classic-ui-widget',
        sourcePath: '/apps/mysite/classic-ui/cq:widgets',
      });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.BLOCKER);
      expect(result.seaCategory).toBe(SEACategory.ADVISE);
    });
  });

  // ----------------------------------------------------------
  // Compatibility Level Assessment
  // ----------------------------------------------------------

  describe('compatibility level assessment', () => {
    it('should detect BLOCKER for javax.jcr usage', () => {
      const item = makeItem({ name: 'javax.jcr-session', sourcePath: '/apps/legacy/javax.jcr' });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.BLOCKER);
    });

    it('should detect BLOCKER for classic-ui references', () => {
      const item = makeItem({ sourcePath: '/apps/old/classic-ui/dialog' });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.BLOCKER);
    });

    it('should detect BLOCKER for ExtJS references', () => {
      const item = makeItem({ name: 'extjs-dialog', sourcePath: '/apps/widget' });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.BLOCKER);
    });

    it('should detect BLOCKER for static-template usage', () => {
      const item = makeItem({ name: 'static-template-old', sourcePath: '/apps/template' });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.BLOCKER);
    });

    it('should detect AUTO_FIXABLE for sling:resourceType', () => {
      const item = makeItem({
        name: 'sling:resourceType',
        sourcePath: '/apps/mysite/config',
      });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.AUTO_FIXABLE);
    });

    it('should detect AUTO_FIXABLE for granite: references', () => {
      const item = makeItem({ name: 'granite:dialog', sourcePath: '/apps/mysite/comp' });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.AUTO_FIXABLE);
    });

    it('should detect MANUAL_FIX for custom-workflow', () => {
      const item = makeItem({ name: 'custom-workflow-handler', sourcePath: '/apps/workflows' });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.MANUAL_FIX);
    });

    it('should detect MANUAL_FIX for osgi-config', () => {
      const item = makeItem({ name: 'osgi-config', sourcePath: '/apps/system' });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.MANUAL_FIX);
    });

    it('should detect MANUAL_FIX for oak-index', () => {
      const item = makeItem({ name: 'oak-index-custom', sourcePath: '/oak:index' });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.MANUAL_FIX);
    });

    it('should return COMPATIBLE when no patterns match', () => {
      const item = makeItem({ type: 'asset', name: 'photo.jpg', sourcePath: '/content/dam/photo.jpg' });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.COMPATIBLE);
    });

    it('should prioritize BLOCKER over AUTO_FIXABLE when both match', () => {
      // Item matches both blocker (classic-ui) and auto-fix (sling:resourceType)
      const item = makeItem({
        name: 'classic-ui-sling:resourceType',
        sourcePath: '/apps/legacy',
      });
      const result = engine.classifyItem(item);

      expect(result.compatibilityLevel).toBe(CompatibilityLevel.BLOCKER);
    });
  });

  // ----------------------------------------------------------
  // Readiness Scoring
  // ----------------------------------------------------------

  describe('readiness scoring', () => {
    it('should return 0 for empty classification array', () => {
      expect(engine.scoreReadiness([])).toBe(0);
    });

    it('should return high score for all COMPATIBLE items', () => {
      const classifications: ClassificationResult[] = [
        engine.classifyItem(makeItem({ type: 'asset', sourcePath: '/content/dam/img.jpg' })),
        engine.classifyItem(makeItem({ type: 'asset', sourcePath: '/content/dam/img2.jpg' })),
      ];

      const score = engine.scoreReadiness(classifications);
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('should return lower score for BLOCKER items', () => {
      const blockerClassifications = [
        engine.classifyItem(makeItem({ name: 'javax.jcr', sourcePath: '/apps/legacy' })),
      ];
      const compatibleClassifications = [
        engine.classifyItem(makeItem({ type: 'asset', sourcePath: '/content/dam/ok.jpg' })),
      ];

      const blockerScore = engine.scoreReadiness(blockerClassifications);
      const compatibleScore = engine.scoreReadiness(compatibleClassifications);

      expect(blockerScore).toBeLessThan(compatibleScore);
    });

    it('should penalize items with low confidence', () => {
      const result = engine.classifyItem(makeItem({ type: 'content', sourcePath: '/x' }));
      // Manually reduce confidence to test penalty
      const lowConfResult = { ...result, confidence: 0.3 };
      const highConfResult = { ...result, confidence: 0.8 };

      const lowScore = engine.scoreReadiness([lowConfResult]);
      const highScore = engine.scoreReadiness([highConfResult]);

      expect(lowScore).toBeLessThan(highScore);
    });

    it('should penalize items with high risk scores', () => {
      const result = engine.classifyItem(makeItem({ type: 'asset', sourcePath: '/content/dam/a.jpg' }));
      const lowRisk = { ...result, riskScore: 0 };
      const highRisk = { ...result, riskScore: 0.9 };

      const lowRiskScore = engine.scoreReadiness([lowRisk]);
      const highRiskScore = engine.scoreReadiness([highRisk]);

      expect(highRiskScore).toBeLessThan(lowRiskScore);
    });

    it('should average scores across all classifications', () => {
      const compatible = engine.classifyItem(makeItem({ type: 'asset', sourcePath: '/content/dam/a.jpg' }));
      const blocker = engine.classifyItem(makeItem({ name: 'javax.jcr', sourcePath: '/apps/legacy' }));

      const mixedScore = engine.scoreReadiness([compatible, blocker]);
      const pureCompatible = engine.scoreReadiness([compatible]);
      const pureBLocker = engine.scoreReadiness([blocker]);

      // Mixed should be between the two
      expect(mixedScore).toBeGreaterThan(pureBLocker);
      expect(mixedScore).toBeLessThan(pureCompatible);
    });

    it('should clamp item scores between 0 and 100', () => {
      // Even the worst items should produce a score >= 0
      const terrible = engine.classifyItem(makeItem({ name: 'javax.jcr', sourcePath: '/apps/classic-ui' }));
      const score = engine.scoreReadiness([{ ...terrible, riskScore: 1, confidence: 0 }]);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ----------------------------------------------------------
  // Effort Estimation
  // ----------------------------------------------------------

  describe('effort estimation', () => {
    it('should assign lower effort to assets than code', () => {
      const assetResult = engine.classifyItem(makeItem({ type: 'asset', sourcePath: '/content/dam/a.jpg' }));
      const codeResult = engine.classifyItem(makeItem({ type: 'code', sourcePath: '/apps/bundle/Service.java' }));

      expect(assetResult.effortHours).toBeLessThan(codeResult.effortHours);
    });

    it('should multiply effort by compatibility factor', () => {
      const compatible = engine.classifyItem(makeItem({ type: 'page', name: 'regular-page', sourcePath: '/content/site/en' }));
      const blocker = engine.classifyItem(makeItem({ type: 'page', name: 'javax.jcr-page', sourcePath: '/apps/legacy' }));

      expect(blocker.effortHours).toBeGreaterThan(compatible.effortHours);
    });

    it('should increase effort for deeply nested paths', () => {
      const shallow = engine.classifyItem(makeItem({
        type: 'code',
        sourcePath: '/apps/code.ts',
      }));
      const deep = engine.classifyItem(makeItem({
        type: 'code',
        sourcePath: '/apps/a/b/c/d/e/f/code.ts',
      }));

      expect(deep.effortHours).toBeGreaterThan(shallow.effortHours);
    });

    it('should return non-negative effort for all item types', () => {
      const types = ['page', 'component', 'code', 'config', 'style', 'asset', 'content'];
      for (const type of types) {
        const result = engine.classifyItem(makeItem({ type, sourcePath: '/content/item' }));
        expect(result.effortHours).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ----------------------------------------------------------
  // Risk Scoring
  // ----------------------------------------------------------

  describe('risk scoring', () => {
    it('should assign zero risk to COMPATIBLE assets', () => {
      const result = engine.classifyItem(makeItem({
        type: 'asset',
        sourcePath: '/content/dam/photo.jpg',
      }));

      expect(result.riskScore).toBe(0);
    });

    it('should assign high risk to BLOCKER items', () => {
      const result = engine.classifyItem(makeItem({
        name: 'javax.jcr-session',
        sourcePath: '/apps/legacy',
      }));

      expect(result.riskScore).toBeGreaterThanOrEqual(0.8);
    });

    it('should add risk for code and component types', () => {
      const asset = engine.classifyItem(makeItem({ type: 'asset', sourcePath: '/content/dam/a.jpg' }));
      const code = engine.classifyItem(makeItem({ type: 'code', sourcePath: '/content/file.txt' }));

      expect(code.riskScore).toBeGreaterThanOrEqual(asset.riskScore);
    });

    it('should cap risk at 1.0', () => {
      // BLOCKER + code type + high effort should still be <= 1
      const result = engine.classifyItem(makeItem({
        type: 'code',
        name: 'javax.jcr-complex-code',
        sourcePath: '/apps/a/b/c/d/e/f/g/heavy.java',
      }));

      expect(result.riskScore).toBeLessThanOrEqual(1);
    });
  });

  // ----------------------------------------------------------
  // Duplicate Detection
  // ----------------------------------------------------------

  describe('duplicate detection', () => {
    it('should detect items with identical normalized paths', () => {
      const items = [
        makeItem({ id: 'a', sourcePath: '/content/page/en/home' }),
        makeItem({ id: 'b', sourcePath: '/content/page/en/home' }),
      ];

      const groups = engine.detectDuplicates(items);

      expect(groups).toHaveLength(1);
      expect(groups[0].canonicalId).toBe('a');
      expect(groups[0].duplicateIds).toContain('b');
    });

    it('should detect items with similar paths above threshold', () => {
      const items = [
        makeItem({ id: 'a', sourcePath: '/content/site/en/home' }),
        makeItem({ id: 'b', sourcePath: '/content/site/en/homee' }),
      ];

      const groups = engine.detectDuplicates(items);

      // Paths are very similar, should be above 0.85 threshold
      expect(groups.length).toBeGreaterThanOrEqual(1);
    });

    it('should not group dissimilar items', () => {
      const items = [
        makeItem({ id: 'a', sourcePath: '/content/dam/photos/sunset.jpg' }),
        makeItem({ id: 'b', sourcePath: '/apps/mysite/components/hero/hero.html' }),
      ];

      const groups = engine.detectDuplicates(items);

      expect(groups).toHaveLength(0);
    });

    it('should respect duplicate detection disabled option', () => {
      const noDetect = new SortEngine({ enableDuplicateDetection: false });
      const items = [
        makeItem({ id: 'a', sourcePath: '/content/page' }),
        makeItem({ id: 'b', sourcePath: '/content/page' }),
      ];

      const groups = noDetect.detectDuplicates(items);

      expect(groups).toHaveLength(0);
    });

    it('should handle path normalization with backslashes', () => {
      const items = [
        makeItem({ id: 'a', sourcePath: '/content/page/en' }),
        makeItem({ id: 'b', sourcePath: '\\content\\page\\en' }),
      ];

      const groups = engine.detectDuplicates(items);

      expect(groups).toHaveLength(1);
    });

    it('should normalize trailing slashes', () => {
      const items = [
        makeItem({ id: 'a', sourcePath: '/content/page/' }),
        makeItem({ id: 'b', sourcePath: '/content/page' }),
      ];

      const groups = engine.detectDuplicates(items);

      expect(groups).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // Batch Classification
  // ----------------------------------------------------------

  describe('batch classification', () => {
    it('should classify all items in a batch', async () => {
      const items = [
        makeItem({ type: 'page', sourcePath: '/content/site/en' }),
        makeItem({ type: 'asset', sourcePath: '/content/dam/img.png' }),
        makeItem({ type: 'code', name: 'osgi-config', sourcePath: '/apps/config' }),
      ];

      const results = await engine.classifyBatch(items);

      expect(results).toHaveLength(3);
      expect(results[0].seaCategory).toBe(SEACategory.SUPPORT);
      expect(results[2].compatibilityLevel).toBe(CompatibilityLevel.MANUAL_FIX);
    });

    it('should call onItemClassified callback for each item', async () => {
      const callback = vi.fn();
      const callbackEngine = new SortEngine({ onItemClassified: callback });

      const items = [
        makeItem({ sourcePath: '/content/page1' }),
        makeItem({ sourcePath: '/content/page2' }),
      ];

      await callbackEngine.classifyBatch(items);

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should return empty array for empty batch', async () => {
      const results = await engine.classifyBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // Tags and Reasoning
  // ----------------------------------------------------------

  describe('tags and reasoning', () => {
    it('should include type tag', () => {
      const result = engine.classifyItem(makeItem({ type: 'page', sourcePath: '/content/en' }));
      expect(result.tags).toContain('type:page');
    });

    it('should include sea tag', () => {
      const result = engine.classifyItem(makeItem({ type: 'asset', sourcePath: '/content/dam/a.jpg' }));
      expect(result.tags).toContain('sea:support');
    });

    it('should include product tags', () => {
      const result = engine.classifyItem(makeItem({
        type: 'page',
        name: 'homepage',
        sourcePath: '/content/site/en',
      }));
      expect(result.tags.some((t) => t.startsWith('product:'))).toBe(true);
    });

    it('should include file extension tag', () => {
      const result = engine.classifyItem(makeItem({ sourcePath: '/content/dam/doc.pdf' }));
      expect(result.tags).toContain('ext:pdf');
    });

    it('should produce a non-empty reasoning string', () => {
      const result = engine.classifyItem(makeItem({ sourcePath: '/content/page' }));
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain('test-item');
    });
  });

  // ----------------------------------------------------------
  // Confidence Calculation
  // ----------------------------------------------------------

  describe('confidence calculation', () => {
    it('should have higher confidence when products are detected', () => {
      const withProduct = engine.classifyItem(makeItem({
        type: 'page',
        name: 'homepage',
        sourcePath: '/content/site/en',
      }));
      const noProduct = engine.classifyItem(makeItem({
        type: 'content',
        name: 'misc',
        sourcePath: '/misc/data',
      }));

      expect(withProduct.confidence).toBeGreaterThan(noProduct.confidence);
    });

    it('should have higher confidence with specific type', () => {
      const typed = engine.classifyItem(makeItem({ type: 'page', sourcePath: '/a/b.html' }));
      const generic = engine.classifyItem(makeItem({ type: 'content', sourcePath: '/x' }));

      expect(typed.confidence).toBeGreaterThanOrEqual(generic.confidence);
    });

    it('should cap confidence at 1.0', () => {
      const result = engine.classifyItem(makeItem({
        type: 'page',
        name: 'template-component',
        sourcePath: '/content/site/en/page.html',
      }));

      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
});
