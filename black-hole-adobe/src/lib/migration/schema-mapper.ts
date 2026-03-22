/**
 * Schema Mapping Engine
 *
 * Maps source data model schemas to target schemas with field-level
 * transformations, type conversions, and validation. Includes predefined
 * mappings for GA, SFMC, WordPress, Sitecore, and Jira migrations.
 */
import { Severity } from '@/types';

export interface SchemaDefinition { id: string; name: string; source: string; fields: SchemaField[]; metadata: Record<string, unknown>; }
export interface SchemaField { name: string; type: FieldType; required: boolean; description: string; enumValues?: string[]; maxLength?: number; nested?: SchemaField[]; }
export type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime' | 'array' | 'object' | 'email' | 'url' | 'phone' | 'currency' | 'enum';
export interface FieldMapping { sourceField: string; targetField: string; transformation: FieldTransformation; confidence: number; notes: string; }
export type FieldTransformation =
  | { type: 'direct' } | { type: 'rename'; targetName: string } | { type: 'typecast'; fromType: FieldType; toType: FieldType }
  | { type: 'format'; pattern: string } | { type: 'concatenate'; fields: string[]; separator: string }
  | { type: 'split'; delimiter: string; index: number } | { type: 'lookup'; table: Record<string, string> }
  | { type: 'custom'; expression: string } | { type: 'drop' } | { type: 'default'; value: unknown };
export interface SchemaMappingResult { id: string; sourceSchema: SchemaDefinition; targetSchema: SchemaDefinition; mappings: FieldMapping[]; unmappedSource: string[]; unmappedTarget: string[]; completeness: number; warnings: SchemaMappingWarning[]; }
export interface SchemaMappingWarning { field: string; severity: Severity; message: string; }
export interface XDMSchema { $id: string; title: string; description: string; type: 'object'; meta_extends: string[]; properties: Record<string, XDMProperty>; required: string[]; }
export interface XDMProperty { title: string; type: string; description: string; 'meta:xdmType'?: string; enum?: string[]; items?: XDMProperty; properties?: Record<string, XDMProperty>; }

type MappingEntry = { target: string; notes: string };

/** GA dimensions/metrics to Adobe Analytics. */
const GA_ANALYTICS: Record<string, MappingEntry> = {
  'ga:pageTitle': { target: 'pageName', notes: 'Direct mapping' }, 'ga:pagePath': { target: 'pageURL', notes: 'Page path' },
  'ga:hostname': { target: 'server', notes: 'Hostname' }, 'ga:source': { target: 'eVar10', notes: 'Traffic source' },
  'ga:medium': { target: 'eVar11', notes: 'Traffic medium' }, 'ga:campaign': { target: 'campaign', notes: 'Campaign v0' },
  'ga:deviceCategory': { target: 'prop1', notes: 'Device' }, 'ga:browser': { target: 'prop2', notes: 'Browser' },
  'ga:country': { target: 'prop4', notes: 'Country' }, 'ga:sessions': { target: 'event1', notes: 'Sessions event' },
  'ga:pageviews': { target: 'event3', notes: 'Pageviews event' }, 'ga:transactionRevenue': { target: 'revenue', notes: 'Products revenue' },
  'ga:dimension1': { target: 'eVar1', notes: 'Custom dim 1' }, 'ga:dimension2': { target: 'eVar2', notes: 'Custom dim 2' },
  'ga:dimension3': { target: 'eVar3', notes: 'Custom dim 3' }, 'ga:dimension4': { target: 'eVar4', notes: 'Custom dim 4' },
  'ga:dimension5': { target: 'eVar5', notes: 'Custom dim 5' },
};

/** SFMC Data Extension fields to XDM. */
const SFMC_XDM: Record<string, MappingEntry> = {
  'SubscriberKey': { target: '_id', notes: 'Primary identity' }, 'EmailAddress': { target: 'personalEmail.address', notes: 'Email' },
  'FirstName': { target: 'person.name.firstName', notes: 'First name' }, 'LastName': { target: 'person.name.lastName', notes: 'Last name' },
  'Phone': { target: 'mobilePhone.number', notes: 'Phone' }, 'Status': { target: 'consents.marketing.email.val', notes: 'Email consent' },
  'Country': { target: 'homeAddress.country', notes: 'Country' }, 'City': { target: 'homeAddress.city', notes: 'City' },
  'PostalCode': { target: 'homeAddress.postalCode', notes: 'Postal code' }, 'BirthDate': { target: 'person.birthDate', notes: 'DOB' },
};

/** WordPress post types to AEM. */
const WP_AEM: Record<string, MappingEntry> = {
  'post': { target: 'contentFragment', notes: 'Blog to CF' }, 'page': { target: 'page', notes: 'Page to AEM Page' },
  'attachment': { target: 'asset', notes: 'Media to DAM' }, 'nav_menu_item': { target: 'experienceFragment', notes: 'Menu to XF' },
  'wp_block': { target: 'contentFragment', notes: 'Block to CF' }, 'product': { target: 'page', notes: 'WooCommerce product' },
};

/** Sitecore templates to AEM. */
const SC_AEM: Record<string, MappingEntry> = {
  'User Defined/Rich Text': { target: 'component', notes: 'Text component' }, 'User Defined/Image': { target: 'component', notes: 'Image component' },
  'User Defined/Hero Banner': { target: 'component', notes: 'Teaser component' }, 'User Defined/Navigation': { target: 'component', notes: 'Nav component' },
  'User Defined/Form': { target: 'component', notes: 'Form container' }, 'Media/Image': { target: 'asset', notes: 'Image asset' },
};

/** Jira fields to Workfront. */
const JIRA_WF: Record<string, MappingEntry> = {
  'summary': { target: 'name', notes: 'Title to name' }, 'description': { target: 'description', notes: 'MD to HTML' },
  'status': { target: 'status', notes: 'Status mapping needed' }, 'priority': { target: 'priority', notes: 'Priority mapping needed' },
  'assignee': { target: 'assignedToID', notes: 'User mapping needed' }, 'created': { target: 'entryDate', notes: 'Created date' },
  'duedate': { target: 'plannedCompletionDate', notes: 'Due date' }, 'labels': { target: 'tags', notes: 'Labels to tags' },
  'storyPoints': { target: 'storyPoints', notes: 'Custom field' }, 'sprint': { target: 'iterationID', notes: 'Sprint to iteration' },
  'timeestimate': { target: 'plannedHours', notes: 'Estimate to hours' }, 'timespent': { target: 'actualHours', notes: 'Time to hours' },
};

const MAPPING_TABLES: Record<string, Record<string, MappingEntry>> = {
  'ga_to_adobe_analytics': GA_ANALYTICS, 'sfmc_to_xdm': SFMC_XDM,
  'wordpress_to_aem': WP_AEM, 'sitecore_to_aem': SC_AEM, 'jira_to_workfront': JIRA_WF,
};

export class SchemaMapper {
  /** Map source schema to target using similarity and predefined tables. */
  async mapSchema(source: SchemaDefinition, target: SchemaDefinition, path?: string): Promise<SchemaMappingResult> {
    const mappings: FieldMapping[] = [], warnings: SchemaMappingWarning[] = [];
    const usedSrc = new Set<string>(), usedTgt = new Set<string>();
    const predefined = path ? MAPPING_TABLES[path] : null;
    if (predefined) for (const sf of source.fields) {
      const m = predefined[sf.name];
      if (m) { const tf = target.fields.find((f) => f.name === m.target);
        mappings.push({ sourceField: sf.name, targetField: m.target, transformation: tf ? this.transform(sf, tf) : { type: 'direct' }, confidence: 0.95, notes: m.notes });
        usedSrc.add(sf.name); usedTgt.add(m.target); }
    }
    for (const sf of source.fields) {
      if (usedSrc.has(sf.name)) continue;
      let best: { f: SchemaField; s: number } | null = null;
      for (const tf of target.fields) { if (usedTgt.has(tf.name)) continue; const s = this.fieldSim(sf, tf); if (s > 0.6 && (!best || s > best.s)) best = { f: tf, s }; }
      if (best) {
        mappings.push({ sourceField: sf.name, targetField: best.f.name, transformation: this.transform(sf, best.f), confidence: best.s, notes: `Auto-matched (${Math.round(best.s * 100)}%)` });
        usedSrc.add(sf.name); usedTgt.add(best.f.name);
        if (best.s < 0.8) warnings.push({ field: sf.name, severity: Severity.MEDIUM, message: `Low confidence: ${sf.name} -> ${best.f.name} (${Math.round(best.s * 100)}%)` });
      }
    }
    for (const tf of target.fields) if (tf.required && !usedTgt.has(tf.name))
      warnings.push({ field: tf.name, severity: Severity.CRITICAL, message: `Required target "${tf.name}" unmapped.` });
    return { id: `mapping-${Date.now()}`, sourceSchema: source, targetSchema: target, mappings,
      unmappedSource: source.fields.filter((f) => !usedSrc.has(f.name)).map((f) => f.name),
      unmappedTarget: target.fields.filter((f) => !usedTgt.has(f.name)).map((f) => f.name),
      completeness: target.fields.length > 0 ? (usedTgt.size / target.fields.length) * 100 : 0, warnings };
  }

  /** Generate AEP XDM schema from source data model. */
  async generateXDMSchema(source: SchemaDefinition, cls: 'profile' | 'experienceEvent' | 'record' = 'profile'): Promise<XDMSchema> {
    const clsMap: Record<string, string> = { profile: 'https://ns.adobe.com/xdm/context/profile', experienceEvent: 'https://ns.adobe.com/xdm/context/experienceevent', record: 'https://ns.adobe.com/xdm/data/record' };
    const props: Record<string, XDMProperty> = {};
    const req: string[] = ['_id'];
    props['_id'] = { title: 'Identifier', type: 'string', description: 'Primary identity.', 'meta:xdmType': 'string' };
    for (const f of source.fields) { props[f.name] = this.toXDM(f); if (f.required) req.push(f.name); }
    if (cls === 'experienceEvent') { props['timestamp'] = { title: 'Timestamp', type: 'string', description: 'ISO 8601 timestamp.', 'meta:xdmType': 'date-time' }; req.push('timestamp'); }
    return { $id: `https://ns.adobe.com/tenant/schemas/${source.id}`, title: source.name, description: `XDM from ${source.source}`, type: 'object', meta_extends: [clsMap[cls]], properties: props, required: req };
  }

  /** Field-level mapping with type conversion. */
  async mapFields(src: SchemaField[], tgt: SchemaField[], custom?: Record<string, string>): Promise<FieldMapping[]> {
    const mappings: FieldMapping[] = [], used = new Set<string>();
    if (custom) for (const [s, t] of Object.entries(custom)) {
      const sf = src.find((f) => f.name === s), tf = tgt.find((f) => f.name === t);
      if (sf && tf) { mappings.push({ sourceField: s, targetField: t, transformation: this.transform(sf, tf), confidence: 1.0, notes: 'Custom' }); used.add(s); }
    }
    for (const sf of src) {
      if (used.has(sf.name)) continue;
      let best: { f: SchemaField; s: number } | null = null;
      for (const tf of tgt) { if (mappings.some((m) => m.targetField === tf.name)) continue; const s = this.fieldSim(sf, tf); if (s > 0.5 && (!best || s > best.s)) best = { f: tf, s }; }
      if (best) mappings.push({ sourceField: sf.name, targetField: best.f.name, transformation: this.transform(sf, best.f), confidence: best.s, notes: `Auto (${Math.round(best.s * 100)}%)` });
    }
    return mappings;
  }

  /** Validate mapping completeness and correctness. */
  async validateMapping(result: SchemaMappingResult): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [], warns: string[] = [];
    for (const tf of result.targetSchema.fields) if (tf.required && !result.mappings.some((m) => m.targetField === tf.name))
      errors.push(`Required target "${tf.name}" unmapped.`);
    for (const m of result.mappings) { if (m.confidence < 0.5) errors.push(`${m.sourceField}->${m.targetField}: very low confidence.`); else if (m.confidence < 0.7) warns.push(`${m.sourceField}->${m.targetField}: low confidence.`); }
    if (result.completeness < 50) errors.push(`Completeness ${Math.round(result.completeness)}% below 50% minimum.`);
    else if (result.completeness < 80) warns.push(`Completeness ${Math.round(result.completeness)}%. Add custom mappings.`);
    for (const w of result.warnings) (w.severity === Severity.CRITICAL ? errors : warns).push(w.message);
    return { valid: errors.length === 0, errors, warnings: warns };
  }

  private fieldSim(a: SchemaField, b: SchemaField): number {
    let s = 0, f = 0;
    const na = a.name.toLowerCase().replace(/[_-]/g, ''), nb = b.name.toLowerCase().replace(/[_-]/g, '');
    if (na === nb) s += 1; else if (na.includes(nb) || nb.includes(na)) s += 0.8;
    else { const wa = a.name.toLowerCase().split(/[_\-.\s]+/), wb = b.name.toLowerCase().split(/[_\-.\s]+/);
      const shared = wa.filter((w) => wb.includes(w)).length; s += new Set([...wa, ...wb]).size > 0 ? shared / new Set([...wa, ...wb]).size : 0; }
    f++;
    const compat: Record<string, string[]> = { string: ['email', 'url', 'phone', 'enum'], number: ['integer', 'currency'], date: ['datetime', 'string'], datetime: ['date', 'string'] };
    if (a.type === b.type) { s += 1; f++; } else if (compat[a.type]?.includes(b.type)) { s += 0.7; f++; }
    return f > 0 ? s / f : 0;
  }

  private transform(src: SchemaField, tgt: SchemaField): FieldTransformation {
    if (src.type === tgt.type && src.name === tgt.name) return { type: 'direct' };
    if (src.name !== tgt.name && src.type === tgt.type) return { type: 'rename', targetName: tgt.name };
    if (src.type !== tgt.type) return { type: 'typecast', fromType: src.type, toType: tgt.type };
    return { type: 'direct' };
  }

  private toXDM(f: SchemaField): XDMProperty {
    const tMap: Record<string, string> = { string: 'string', number: 'number', integer: 'integer', boolean: 'boolean', date: 'string', datetime: 'string', array: 'array', object: 'object', email: 'string', url: 'string', phone: 'string', currency: 'number', enum: 'string' };
    const xMap: Record<string, string> = { string: 'string', number: 'double', integer: 'long', boolean: 'boolean', date: 'date', datetime: 'date-time', email: 'string', url: 'string', phone: 'string', currency: 'double', enum: 'string' };
    const p: XDMProperty = { title: f.description || f.name, type: tMap[f.type] ?? 'string', description: f.description, 'meta:xdmType': xMap[f.type] ?? 'string' };
    if (f.enumValues) p.enum = f.enumValues;
    if (f.type === 'array' && f.nested) p.items = this.toXDM(f.nested[0]);
    if (f.type === 'object' && f.nested) { p.properties = {}; for (const n of f.nested) p.properties[n.name] = this.toXDM(n); }
    return p;
  }
}
