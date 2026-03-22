/**
 * Tests for SchemaMapper
 *
 * Tests GA to Adobe Analytics dimension mapping, WordPress to AEM
 * content type mapping, Sitecore to AEM template mapping, XDM schema
 * generation, field type conversion, and custom field mapping.
 */

import { describe, it, expect } from 'vitest';

// ---- SchemaMapper implementation ----

interface FieldMapping {
  sourceField: string;
  targetField: string;
  sourceType: string;
  targetType: string;
  transform: string | null;
  confidence: number;
}

interface SchemaMapping {
  sourcePlatform: string;
  targetPlatform: string;
  mappings: FieldMapping[];
  unmappedSourceFields: string[];
  unmappedTargetFields: string[];
}

interface XDMSchema {
  $id: string;
  title: string;
  type: string;
  properties: Record<string, XDMProperty>;
  required: string[];
}

interface XDMProperty {
  type: string;
  title: string;
  description: string;
  'meta:xdmType'?: string;
}

const GA_TO_ANALYTICS_MAP: Record<string, { target: string; transform: string | null }> = {
  'ga:pageTitle': { target: 'pageName', transform: null },
  'ga:pagePath': { target: 'pageURL', transform: null },
  'ga:hostname': { target: 'server', transform: null },
  'ga:source': { target: 'eVar1', transform: 'concatenate with ga:medium' },
  'ga:medium': { target: 'eVar2', transform: null },
  'ga:campaign': { target: 'campaign', transform: null },
  'ga:deviceCategory': { target: 'eVar3', transform: 'map: desktop->Desktop, mobile->Mobile, tablet->Tablet' },
  'ga:browser': { target: 'eVar4', transform: null },
  'ga:country': { target: 'eVar5', transform: null },
  'ga:language': { target: 'eVar6', transform: null },
  'ga:sessions': { target: 'event1', transform: 'counter event' },
  'ga:pageviews': { target: 'event2', transform: 'counter event' },
  'ga:bounceRate': { target: 'event3', transform: 'numeric event, divide by 100' },
  'ga:avgSessionDuration': { target: 'event4', transform: 'numeric event, seconds' },
  'ga:transactionRevenue': { target: 'revenue', transform: 'currency conversion if needed' },
  'ga:transactionId': { target: 'purchaseID', transform: null },
  'ga:itemQuantity': { target: 'units', transform: null },
};

const WP_TO_AEM_CONTENT_MAP: Record<string, { aemType: string; template: string }> = {
  'post': { aemType: 'cq:Page', template: '/conf/site/settings/wcm/templates/article' },
  'page': { aemType: 'cq:Page', template: '/conf/site/settings/wcm/templates/content-page' },
  'attachment': { aemType: 'dam:Asset', template: '' },
  'nav_menu_item': { aemType: 'cq:Page', template: '/conf/site/settings/wcm/templates/navigation' },
  'wp_block': { aemType: 'cq:Page', template: '/conf/site/settings/wcm/templates/content-fragment' },
  'product': { aemType: 'cq:Page', template: '/conf/site/settings/wcm/templates/product-detail' },
  'category': { aemType: 'cq:Tag', template: '' },
};

const SITECORE_TO_AEM_MAP: Record<string, { aemTemplate: string; resourceType: string }> = {
  'Sample Item': { aemTemplate: '/conf/site/settings/wcm/templates/page', resourceType: 'site/components/page' },
  'Article': { aemTemplate: '/conf/site/settings/wcm/templates/article', resourceType: 'site/components/article' },
  'Landing Page': { aemTemplate: '/conf/site/settings/wcm/templates/landing', resourceType: 'site/components/landing' },
  'Content Page': { aemTemplate: '/conf/site/settings/wcm/templates/content-page', resourceType: 'site/components/content-page' },
  'Product Page': { aemTemplate: '/conf/site/settings/wcm/templates/product', resourceType: 'site/components/product' },
  'Blog Post': { aemTemplate: '/conf/site/settings/wcm/templates/blog-post', resourceType: 'site/components/blog-post' },
  'Form Page': { aemTemplate: '/conf/site/settings/wcm/templates/form', resourceType: 'site/components/form-page' },
  'Redirect': { aemTemplate: '', resourceType: 'site/components/redirect' },
};

const TYPE_CONVERSIONS: Record<string, string> = {
  'varchar': 'String',
  'text': 'String',
  'longtext': 'String',
  'int': 'Long',
  'integer': 'Long',
  'bigint': 'Long',
  'float': 'Double',
  'double': 'Double',
  'decimal': 'Double',
  'boolean': 'Boolean',
  'bool': 'Boolean',
  'datetime': 'Date',
  'timestamp': 'Date',
  'date': 'Date',
  'blob': 'Binary',
  'json': 'String',
  'array': 'String[]',
};

function mapGAToAnalytics(gaFields: string[]): SchemaMapping {
  const mappings: FieldMapping[] = [];
  const unmappedSource: string[] = [];

  for (const field of gaFields) {
    const target = GA_TO_ANALYTICS_MAP[field];
    if (target) {
      mappings.push({
        sourceField: field,
        targetField: target.target,
        sourceType: 'string',
        targetType: target.target.startsWith('event') ? 'event' : 'evar',
        transform: target.transform,
        confidence: target.transform ? 0.85 : 1.0,
      });
    } else {
      unmappedSource.push(field);
    }
  }

  return {
    sourcePlatform: 'google_analytics',
    targetPlatform: 'adobe_analytics',
    mappings,
    unmappedSourceFields: unmappedSource,
    unmappedTargetFields: [],
  };
}

function mapWordPressToAEM(wpTypes: string[]): SchemaMapping {
  const mappings: FieldMapping[] = [];
  const unmapped: string[] = [];

  for (const wpType of wpTypes) {
    const aemMapping = WP_TO_AEM_CONTENT_MAP[wpType];
    if (aemMapping) {
      mappings.push({
        sourceField: wpType,
        targetField: aemMapping.aemType,
        sourceType: 'wp_post_type',
        targetType: 'jcr_node_type',
        transform: aemMapping.template ? `template:${aemMapping.template}` : null,
        confidence: 0.9,
      });
    } else {
      unmapped.push(wpType);
    }
  }

  return {
    sourcePlatform: 'wordpress',
    targetPlatform: 'aem',
    mappings,
    unmappedSourceFields: unmapped,
    unmappedTargetFields: [],
  };
}

function mapSitecoreToAEM(sitecoreTemplates: string[]): SchemaMapping {
  const mappings: FieldMapping[] = [];
  const unmapped: string[] = [];

  for (const tmpl of sitecoreTemplates) {
    const aemMapping = SITECORE_TO_AEM_MAP[tmpl];
    if (aemMapping) {
      mappings.push({
        sourceField: tmpl,
        targetField: aemMapping.resourceType,
        sourceType: 'sitecore_template',
        targetType: 'sling:resourceType',
        transform: aemMapping.aemTemplate ? `template:${aemMapping.aemTemplate}` : null,
        confidence: 0.85,
      });
    } else {
      unmapped.push(tmpl);
    }
  }

  return {
    sourcePlatform: 'sitecore',
    targetPlatform: 'aem',
    mappings,
    unmappedSourceFields: unmapped,
    unmappedTargetFields: [],
  };
}

function generateXDMSchema(
  name: string,
  fields: Array<{ name: string; type: string; required: boolean; description: string }>,
): XDMSchema {
  const properties: Record<string, XDMProperty> = {};
  const required: string[] = [];

  for (const field of fields) {
    const xdmType = convertFieldType(field.type);
    properties[field.name] = {
      type: xdmType.toLowerCase() === 'date' ? 'string' : xdmType.toLowerCase(),
      title: field.name.replace(/([A-Z])/g, ' $1').trim(),
      description: field.description,
      ...(xdmType.toLowerCase() === 'date' ? { 'meta:xdmType': 'date-time' } : {}),
    };
    if (field.required) required.push(field.name);
  }

  return {
    $id: `https://ns.adobe.com/xdm/schemas/${name}`,
    title: name,
    type: 'object',
    properties,
    required,
  };
}

function convertFieldType(sourceType: string): string {
  return TYPE_CONVERSIONS[sourceType.toLowerCase()] ?? 'String';
}

function mapCustomFields(
  sourceFields: Array<{ name: string; type: string }>,
  targetFields: Array<{ name: string; type: string }>,
): SchemaMapping {
  const mappings: FieldMapping[] = [];
  const unmappedSource: string[] = [];
  const unmappedTarget = targetFields.map((f) => f.name);

  for (const source of sourceFields) {
    // Exact match
    const exactMatch = targetFields.find(
      (t) => t.name.toLowerCase() === source.name.toLowerCase(),
    );
    if (exactMatch) {
      mappings.push({
        sourceField: source.name,
        targetField: exactMatch.name,
        sourceType: source.type,
        targetType: exactMatch.type,
        transform: source.type !== exactMatch.type ? `convert ${source.type} -> ${exactMatch.type}` : null,
        confidence: 1.0,
      });
      const idx = unmappedTarget.indexOf(exactMatch.name);
      if (idx > -1) unmappedTarget.splice(idx, 1);
      continue;
    }

    // Fuzzy match (contains)
    const fuzzyMatch = targetFields.find(
      (t) =>
        t.name.toLowerCase().includes(source.name.toLowerCase()) ||
        source.name.toLowerCase().includes(t.name.toLowerCase()),
    );
    if (fuzzyMatch) {
      mappings.push({
        sourceField: source.name,
        targetField: fuzzyMatch.name,
        sourceType: source.type,
        targetType: fuzzyMatch.type,
        transform: `fuzzy match: ${source.name} -> ${fuzzyMatch.name}`,
        confidence: 0.7,
      });
      const idx = unmappedTarget.indexOf(fuzzyMatch.name);
      if (idx > -1) unmappedTarget.splice(idx, 1);
      continue;
    }

    unmappedSource.push(source.name);
  }

  return {
    sourcePlatform: 'custom',
    targetPlatform: 'custom',
    mappings,
    unmappedSourceFields: unmappedSource,
    unmappedTargetFields: unmappedTarget,
  };
}

// ============================================================
// Tests
// ============================================================

describe('SchemaMapper', () => {

  // ----------------------------------------------------------
  // GA to Adobe Analytics Dimension Mapping
  // ----------------------------------------------------------

  describe('GA to Adobe Analytics dimension mapping', () => {
    it('should map pageTitle to pageName', () => {
      const result = mapGAToAnalytics(['ga:pageTitle']);
      expect(result.mappings[0].targetField).toBe('pageName');
      expect(result.mappings[0].confidence).toBe(1.0);
    });

    it('should map pagePath to pageURL', () => {
      const result = mapGAToAnalytics(['ga:pagePath']);
      expect(result.mappings[0].targetField).toBe('pageURL');
    });

    it('should map campaign to campaign', () => {
      const result = mapGAToAnalytics(['ga:campaign']);
      expect(result.mappings[0].targetField).toBe('campaign');
    });

    it('should map sessions to event1', () => {
      const result = mapGAToAnalytics(['ga:sessions']);
      expect(result.mappings[0].targetField).toBe('event1');
      expect(result.mappings[0].targetType).toBe('event');
    });

    it('should map transactionRevenue to revenue', () => {
      const result = mapGAToAnalytics(['ga:transactionRevenue']);
      expect(result.mappings[0].targetField).toBe('revenue');
      expect(result.mappings[0].transform).toContain('currency');
    });

    it('should add transform note for source requiring concatenation', () => {
      const result = mapGAToAnalytics(['ga:source']);
      expect(result.mappings[0].transform).toContain('concatenate');
    });

    it('should report unmapped GA fields', () => {
      const result = mapGAToAnalytics(['ga:customDimension1', 'ga:nonExistent']);
      expect(result.unmappedSourceFields).toHaveLength(2);
      expect(result.unmappedSourceFields).toContain('ga:customDimension1');
    });

    it('should map multiple fields at once', () => {
      const result = mapGAToAnalytics([
        'ga:pageTitle', 'ga:pagePath', 'ga:sessions', 'ga:bounceRate',
      ]);
      expect(result.mappings).toHaveLength(4);
    });

    it('should identify platform names', () => {
      const result = mapGAToAnalytics(['ga:pageTitle']);
      expect(result.sourcePlatform).toBe('google_analytics');
      expect(result.targetPlatform).toBe('adobe_analytics');
    });

    it('should lower confidence for fields requiring transforms', () => {
      const noTransform = mapGAToAnalytics(['ga:pageTitle']);
      const withTransform = mapGAToAnalytics(['ga:source']);
      expect(withTransform.mappings[0].confidence).toBeLessThan(
        noTransform.mappings[0].confidence,
      );
    });
  });

  // ----------------------------------------------------------
  // WordPress to AEM Content Type Mapping
  // ----------------------------------------------------------

  describe('WordPress to AEM content type mapping', () => {
    it('should map post to cq:Page with article template', () => {
      const result = mapWordPressToAEM(['post']);
      expect(result.mappings[0].targetField).toBe('cq:Page');
      expect(result.mappings[0].transform).toContain('article');
    });

    it('should map page to cq:Page with content-page template', () => {
      const result = mapWordPressToAEM(['page']);
      expect(result.mappings[0].targetField).toBe('cq:Page');
      expect(result.mappings[0].transform).toContain('content-page');
    });

    it('should map attachment to dam:Asset', () => {
      const result = mapWordPressToAEM(['attachment']);
      expect(result.mappings[0].targetField).toBe('dam:Asset');
    });

    it('should map category to cq:Tag', () => {
      const result = mapWordPressToAEM(['category']);
      expect(result.mappings[0].targetField).toBe('cq:Tag');
    });

    it('should report unknown WP types as unmapped', () => {
      const result = mapWordPressToAEM(['custom_post_type']);
      expect(result.unmappedSourceFields).toContain('custom_post_type');
    });

    it('should map product to product-detail template', () => {
      const result = mapWordPressToAEM(['product']);
      expect(result.mappings[0].transform).toContain('product-detail');
    });
  });

  // ----------------------------------------------------------
  // Sitecore to AEM Template Mapping
  // ----------------------------------------------------------

  describe('Sitecore to AEM template mapping', () => {
    it('should map Article to article template', () => {
      const result = mapSitecoreToAEM(['Article']);
      expect(result.mappings[0].transform).toContain('article');
    });

    it('should map Landing Page to landing template', () => {
      const result = mapSitecoreToAEM(['Landing Page']);
      expect(result.mappings[0].transform).toContain('landing');
    });

    it('should map Content Page to content-page template', () => {
      const result = mapSitecoreToAEM(['Content Page']);
      expect(result.mappings[0].targetField).toContain('content-page');
    });

    it('should map Blog Post to blog-post template', () => {
      const result = mapSitecoreToAEM(['Blog Post']);
      expect(result.mappings[0].targetField).toContain('blog-post');
    });

    it('should map Form Page to form template', () => {
      const result = mapSitecoreToAEM(['Form Page']);
      expect(result.mappings[0].transform).toContain('form');
    });

    it('should handle Redirect without template', () => {
      const result = mapSitecoreToAEM(['Redirect']);
      expect(result.mappings[0].transform).toBeNull();
      expect(result.mappings[0].targetField).toContain('redirect');
    });

    it('should report unknown Sitecore templates as unmapped', () => {
      const result = mapSitecoreToAEM(['CustomSitecoreTemplate']);
      expect(result.unmappedSourceFields).toContain('CustomSitecoreTemplate');
    });

    it('should identify platforms correctly', () => {
      const result = mapSitecoreToAEM(['Article']);
      expect(result.sourcePlatform).toBe('sitecore');
      expect(result.targetPlatform).toBe('aem');
    });
  });

  // ----------------------------------------------------------
  // XDM Schema Generation
  // ----------------------------------------------------------

  describe('XDM schema generation', () => {
    it('should generate a valid XDM schema', () => {
      const schema = generateXDMSchema('user-profile', [
        { name: 'firstName', type: 'varchar', required: true, description: 'First name' },
        { name: 'email', type: 'varchar', required: true, description: 'Email address' },
        { name: 'age', type: 'int', required: false, description: 'Age in years' },
      ]);

      expect(schema.$id).toContain('user-profile');
      expect(schema.type).toBe('object');
      expect(schema.required).toContain('firstName');
      expect(schema.required).toContain('email');
      expect(schema.required).not.toContain('age');
    });

    it('should convert field types to XDM types', () => {
      const schema = generateXDMSchema('test', [
        { name: 'strField', type: 'varchar', required: false, description: 'String' },
        { name: 'intField', type: 'int', required: false, description: 'Integer' },
        { name: 'boolField', type: 'boolean', required: false, description: 'Boolean' },
        { name: 'dateField', type: 'datetime', required: false, description: 'Date' },
      ]);

      expect(schema.properties.strField.type).toBe('string');
      expect(schema.properties.intField.type).toBe('long');
      expect(schema.properties.boolField.type).toBe('boolean');
      expect(schema.properties.dateField.type).toBe('string');
      expect(schema.properties.dateField['meta:xdmType']).toBe('date-time');
    });

    it('should include Adobe XDM namespace in $id', () => {
      const schema = generateXDMSchema('events', []);
      expect(schema.$id).toContain('ns.adobe.com/xdm');
    });

    it('should handle empty fields array', () => {
      const schema = generateXDMSchema('empty', []);
      expect(Object.keys(schema.properties)).toHaveLength(0);
      expect(schema.required).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // Field Type Conversion
  // ----------------------------------------------------------

  describe('field type conversion', () => {
    it('should convert varchar to String', () => {
      expect(convertFieldType('varchar')).toBe('String');
    });

    it('should convert int to Long', () => {
      expect(convertFieldType('int')).toBe('Long');
    });

    it('should convert bigint to Long', () => {
      expect(convertFieldType('bigint')).toBe('Long');
    });

    it('should convert float to Double', () => {
      expect(convertFieldType('float')).toBe('Double');
    });

    it('should convert boolean to Boolean', () => {
      expect(convertFieldType('boolean')).toBe('Boolean');
    });

    it('should convert datetime to Date', () => {
      expect(convertFieldType('datetime')).toBe('Date');
    });

    it('should convert blob to Binary', () => {
      expect(convertFieldType('blob')).toBe('Binary');
    });

    it('should be case-insensitive', () => {
      expect(convertFieldType('VARCHAR')).toBe('String');
      expect(convertFieldType('INT')).toBe('Long');
    });

    it('should default to String for unknown types', () => {
      expect(convertFieldType('custom_type')).toBe('String');
    });

    it('should convert json to String', () => {
      expect(convertFieldType('json')).toBe('String');
    });
  });

  // ----------------------------------------------------------
  // Custom Field Mapping
  // ----------------------------------------------------------

  describe('custom field mapping', () => {
    it('should exact-match fields by name', () => {
      const result = mapCustomFields(
        [{ name: 'email', type: 'varchar' }],
        [{ name: 'email', type: 'string' }],
      );

      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].confidence).toBe(1.0);
    });

    it('should be case-insensitive for exact matching', () => {
      const result = mapCustomFields(
        [{ name: 'Email', type: 'varchar' }],
        [{ name: 'email', type: 'string' }],
      );

      expect(result.mappings).toHaveLength(1);
    });

    it('should add transform note when types differ', () => {
      const result = mapCustomFields(
        [{ name: 'count', type: 'int' }],
        [{ name: 'count', type: 'string' }],
      );

      expect(result.mappings[0].transform).toContain('convert');
    });

    it('should fuzzy match fields by substring', () => {
      const result = mapCustomFields(
        [{ name: 'user', type: 'varchar' }],
        [{ name: 'userName', type: 'string' }],
      );

      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].confidence).toBe(0.7);
    });

    it('should report unmapped source fields', () => {
      const result = mapCustomFields(
        [{ name: 'legacyId', type: 'int' }],
        [{ name: 'email', type: 'string' }],
      );

      expect(result.unmappedSourceFields).toContain('legacyId');
    });

    it('should report unmapped target fields', () => {
      const result = mapCustomFields(
        [{ name: 'email', type: 'varchar' }],
        [
          { name: 'email', type: 'string' },
          { name: 'phone', type: 'string' },
        ],
      );

      expect(result.unmappedTargetFields).toContain('phone');
    });

    it('should handle empty source and target fields', () => {
      const result = mapCustomFields([], []);

      expect(result.mappings).toHaveLength(0);
      expect(result.unmappedSourceFields).toHaveLength(0);
      expect(result.unmappedTargetFields).toHaveLength(0);
    });
  });
});
