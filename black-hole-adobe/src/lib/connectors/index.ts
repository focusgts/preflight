/**
 * Black Hole Connectors - Barrel Export
 *
 * All connector types, factories, and shared types for the
 * Black Hole for Adobe Marketing Cloud migration platform.
 */

// Base connector and shared types
export {
  BaseConnector,
  FetchHttpClient,
  ConnectorError,
  type ConnectorCapability,
  type ExtractionProgress,
  type ExtractionResult,
  type RateLimitConfig,
  type RetryConfig,
  type HttpMethod,
  type HttpRequestOptions,
  type HttpResponse,
  type HttpClient,
  type ProgressCallback,
} from './base-connector';

// AEM Connector
export {
  AEMConnector,
  type AEMContent,
  type AEMAsset,
  type AEMComponent,
  type AEMWorkflow,
  type AEMWorkflowStep,
  type AEMOSGiConfig,
  type AEMIndex,
  type AEMDispatcherConfig,
  type AEMDispatcherFarm,
  type AEMDispatcherRule,
  type AEMDispatcherFilter,
  type AEMExtractionData,
} from './aem-connector';

// Analytics Connector
export {
  AnalyticsConnector,
  type AnalyticsPlatform,
  type ReportSuite,
  type AnalyticsDimension,
  type AnalyticsMetric,
  type AnalyticsSegment,
  type CalculatedMetric,
  type GAProperty,
  type GAEvent,
  type GAAudience,
  type VariableMapping,
  type ImplementationAnalysis,
  type AnalyticsExtractionData,
} from './analytics-connector';

// Campaign Connector
export {
  CampaignConnector,
  type CampaignPlatform,
  type CampaignProfile,
  type CampaignWorkflow,
  type CampaignActivity,
  type CampaignDelivery,
  type CampaignTemplate,
  type SFMCDataExtension,
  type SFMCField,
  type SFMCJourney,
  type CampaignExtractionData,
} from './campaign-connector';

// AEP Connector
export {
  AEPConnector,
  type XDMSchema,
  type XDMFieldGroup,
  type XDMField,
  type AEPDataset,
  type AEPSegment,
  type AEPSegmentExpression,
  type AEPDestination,
  type AEPDataflow,
  type AEPIdentityNamespace,
  type AEPExtractionData,
} from './aep-connector';

// Commerce Connector
export {
  CommerceConnector,
  type CommercePlatform,
  type CommerceProduct,
  type CommerceImage,
  type CommerceVariant,
  type CommerceCategory,
  type CommerceCustomer,
  type CommerceAddress,
  type CommerceOrder,
  type CommerceOrderItem,
  type CommerceExtractionData,
} from './commerce-connector';

// CMS Connector
export {
  CMSConnector,
  type CMSPlatform,
  type CMSPage,
  type CMSSeoMeta,
  type CMSMedia,
  type CMSTemplate,
  type CMSTaxonomy,
  type CMSMenu,
  type CMSMenuItem,
  type URLRedirectMapping,
  type CMSExtractionData,
} from './cms-connector';

// File Connector
export {
  FileConnector,
  type FileFormat,
  type DetectedField,
  type DetectedSchema,
  type FieldMapping,
  type FieldTransform,
  type ParseOptions,
  type FileExtractionData,
} from './file-connector';

// Factory
export {
  ConnectorFactory,
  type ConnectorType,
  type ConnectorTypeInfo,
  type CreateConnectorOptions,
} from './connector-factory';
