/**
 * Mock Code Review Data
 *
 * Realistic AEM code migration review items covering all change types.
 * Pre-seeded into the review engine for demo purposes.
 */

import { Severity } from '@/types';
import type { CodeReviewItem } from '@/types/review';

export const DEMO_MIGRATION_ID = 'mig-001';

export const mockReviewItems: CodeReviewItem[] = [
  // ── OSGi Config Conversions (3) ─────────────────────────────────────
  {
    id: 'rev-001',
    filePath: '/apps/mysite/config/com.day.cq.dam.core.impl.servlet.AssetDownloadServlet.xml',
    changeType: 'osgi_config',
    before: `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
    xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
    jcr:primaryType="sling:OsgiConfig"
    enabled="{Boolean}true"
    max.download.size="{Long}104857600"
    asset.download.prezip.maxcontentsize="{Long}52428800"
    max.num.can.download="{Long}100"/>`,
    after: `{
  "enabled": true,
  "max.download.size": 104857600,
  "asset.download.prezip.maxcontentsize": 52428800,
  "max.num.can.download": 100
}`,
    confidence: 0.98,
    status: 'pending',
    severity: Severity.MEDIUM,
    description: 'Convert OSGi XML config to .cfg.json format for AEM as a Cloud Service.',
    autoFixApplied: true,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },
  {
    id: 'rev-002',
    filePath: '/apps/mysite/config/org.apache.sling.commons.log.LogManager.factory.config.xml',
    changeType: 'osgi_config',
    before: `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
    xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
    jcr:primaryType="sling:OsgiConfig"
    org.apache.sling.commons.log.level="info"
    org.apache.sling.commons.log.file="logs/mysite.log"
    org.apache.sling.commons.log.names="{String}[com.mysite,com.mysite.core]"
    org.apache.sling.commons.log.pattern="{Date} *{Level}* [{Thread}] {Logger} {Message}"/>`,
    after: `{
  "org.apache.sling.commons.log.level": "info",
  "org.apache.sling.commons.log.file": "logs/mysite.log",
  "org.apache.sling.commons.log.names": [
    "com.mysite",
    "com.mysite.core"
  ],
  "org.apache.sling.commons.log.pattern": "{Date} *{Level}* [{Thread}] {Logger} {Message}"
}`,
    confidence: 0.97,
    status: 'pending',
    severity: Severity.MEDIUM,
    description: 'Convert Sling Log Manager factory config from XML to .cfg.json.',
    autoFixApplied: true,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },
  {
    id: 'rev-003',
    filePath: '/apps/mysite/config.publish/com.adobe.granite.auth.saml.SamlAuthenticationHandler.xml',
    changeType: 'osgi_config',
    before: `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
    xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
    jcr:primaryType="sling:OsgiConfig"
    path="{String}[/]"
    service.ranking="{Long}5000"
    idpUrl="https://idp.mysite.com/saml/sso"
    idpCertAlias="certalias"
    idpHttpRedirect="{Boolean}false"
    serviceProviderEntityId="https://publish.mysite.com"
    useEncryption="{Boolean}false"/>`,
    after: `{
  "path": ["/"],
  "service.ranking": 5000,
  "idpUrl": "https://idp.mysite.com/saml/sso",
  "idpCertAlias": "certalias",
  "idpHttpRedirect": false,
  "serviceProviderEntityId": "https://publish.mysite.com",
  "useEncryption": false
}`,
    confidence: 0.96,
    status: 'pending',
    severity: Severity.MEDIUM,
    description: 'Convert SAML authentication handler config to .cfg.json. Run mode "publish" preserved in file path.',
    autoFixApplied: true,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },

  // ── Deprecated API Replacements (3) ─────────────────────────────────
  {
    id: 'rev-004',
    filePath: '/core/src/main/java/com/mysite/core/services/impl/AdminServiceImpl.java',
    changeType: 'deprecated_api',
    before: `@Reference
private SlingRepository repository;

public Session getAdminSession() throws RepositoryException {
    return repository.loginAdministrative(null);
}`,
    after: `@Reference
private SlingRepository repository;

@Reference
private ResourceResolverFactory resolverFactory;

public ResourceResolver getServiceResolver() throws LoginException {
    Map<String, Object> params = Collections.singletonMap(
        ResourceResolverFactory.SUBSERVICE, "mysite-admin-service"
    );
    return resolverFactory.getServiceResourceResolver(params);
}`,
    confidence: 0.88,
    status: 'pending',
    severity: Severity.CRITICAL,
    description: 'Replace loginAdministrative() with service user via getServiceResourceResolver(). Requires service user mapping configuration.',
    autoFixApplied: false,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },
  {
    id: 'rev-005',
    filePath: '/core/src/main/java/com/mysite/core/listeners/ContentChangeListener.java',
    changeType: 'deprecated_api',
    before: `import javax.jcr.observation.EventListener;
import javax.jcr.observation.EventIterator;
import javax.jcr.observation.Event;

@Component(immediate = true)
public class ContentChangeListener implements EventListener {
    @Override
    public void onEvent(EventIterator events) {
        while (events.hasNext()) {
            Event event = events.nextEvent();
            // Process JCR events
            log.info("Content changed: {}", event.getPath());
        }
    }
}`,
    after: `import org.apache.sling.api.resource.observation.ResourceChange;
import org.apache.sling.api.resource.observation.ResourceChangeListener;

@Component(
    immediate = true,
    service = ResourceChangeListener.class,
    property = {
        ResourceChangeListener.PATHS + "=/content/mysite",
        ResourceChangeListener.CHANGES + "=ADDED",
        ResourceChangeListener.CHANGES + "=CHANGED",
        ResourceChangeListener.CHANGES + "=REMOVED"
    }
)
public class ContentChangeListener implements ResourceChangeListener {
    @Override
    public void onChange(List<ResourceChange> changes) {
        for (ResourceChange change : changes) {
            log.info("Content changed: {} ({})", change.getPath(), change.getType());
        }
    }
}`,
    confidence: 0.82,
    status: 'pending',
    severity: Severity.MEDIUM,
    description: 'Replace JCR EventListener with Sling ResourceChangeListener. Verify observed paths and change types match original behaviour.',
    autoFixApplied: false,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },
  {
    id: 'rev-006',
    filePath: '/core/src/main/java/com/mysite/core/servlets/ReplicationServlet.java',
    changeType: 'deprecated_api',
    before: `import com.day.cq.replication.ReplicationAction;
import com.day.cq.replication.ReplicationActionType;
import com.day.cq.replication.Replicator;

@Reference
private Replicator replicator;

public void activateContent(Session session, String path) throws ReplicationException {
    replicator.replicate(session, ReplicationActionType.ACTIVATE, path);
}`,
    after: `import com.adobe.granite.replication.api.ReplicationAction;
import com.adobe.granite.replication.api.ReplicationActionType;
import com.adobe.granite.replication.api.Replicator;

@Reference
private Replicator replicator;

public void activateContent(ResourceResolver resolver, String path) throws ReplicationException {
    replicator.replicate(resolver, ReplicationActionType.ACTIVATE, path);
}`,
    confidence: 0.91,
    status: 'pending',
    severity: Severity.MEDIUM,
    description: 'Migrate from Day CQ Replication API to Granite Replication API. Session replaced with ResourceResolver.',
    autoFixApplied: true,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },

  // ── Maven Restructuring (2) ─────────────────────────────────────────
  {
    id: 'rev-007',
    filePath: '/pom.xml',
    changeType: 'maven_structure',
    before: `<modules>
    <module>core</module>
    <module>ui.apps</module>
    <module>ui.content</module>
</modules>

<properties>
    <aem.host>localhost</aem.host>
    <aem.port>4502</aem.port>
    <sling.host>localhost</sling.host>
</properties>`,
    after: `<modules>
    <module>core</module>
    <module>ui.apps</module>
    <module>ui.apps.structure</module>
    <module>ui.config</module>
    <module>ui.content</module>
    <module>ui.frontend</module>
    <module>ui.tests</module>
    <module>it.tests</module>
    <module>all</module>
</modules>

<properties>
    <aem.host>localhost</aem.host>
    <aem.port>4502</aem.port>
    <sling.host>localhost</sling.host>
    <aem.sdk.api>2024.3.15529.20240307T072445Z-240100</aem.sdk.api>
</properties>`,
    confidence: 0.97,
    status: 'pending',
    severity: Severity.HIGH,
    description: 'Add missing Cloud Service Archetype 35+ modules: ui.apps.structure, ui.config, ui.frontend, ui.tests, it.tests, all.',
    autoFixApplied: true,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },
  {
    id: 'rev-008',
    filePath: '/ui.apps/pom.xml',
    changeType: 'maven_structure',
    before: `<plugin>
    <groupId>com.day.jcr.vault</groupId>
    <artifactId>content-package-maven-plugin</artifactId>
    <extensions>true</extensions>
    <configuration>
        <filterSource>src/main/content/META-INF/vault/filter.xml</filterSource>
        <targetURL>http://\${aem.host}:\${aem.port}/crx/packmgr/service.jsp</targetURL>
    </configuration>
</plugin>`,
    after: `<plugin>
    <groupId>org.apache.jackrabbit</groupId>
    <artifactId>filevault-package-maven-plugin</artifactId>
    <extensions>true</extensions>
    <configuration>
        <group>com.mysite</group>
        <name>mysite.ui.apps</name>
        <packageType>application</packageType>
        <repositoryStructurePackage>
            <groupId>com.mysite</groupId>
            <artifactId>mysite.ui.apps.structure</artifactId>
            <version>\${project.version}</version>
        </repositoryStructurePackage>
    </configuration>
</plugin>`,
    confidence: 0.95,
    status: 'pending',
    severity: Severity.HIGH,
    description: 'Replace Day JCR content-package-maven-plugin with Apache Jackrabbit filevault-package-maven-plugin.',
    autoFixApplied: true,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },

  // ── Dispatcher Config Conversions (2) ───────────────────────────────
  {
    id: 'rev-009',
    filePath: '/dispatcher/src/conf.d/available_farms/default.farm',
    changeType: 'dispatcher',
    before: `/farms {
  /publish-farm {
    /clientheaders {
      "*"
    }
    /virtualhosts {
      "*"
    }
    /renders {
      /rend01 {
        /hostname "\${PUBLISH_IP}"
        /port "4503"
      }
    }
    /allowedClients {
      /0001 { /glob "*" /type "deny" }
      /0002 { /glob "10.0.0.*" /type "allow" }
    }
    /statistics {
      /categories {
        /html { /glob "*.html" }
        /others { /glob "*" }
      }
    }
    /cache {
      /docroot "/opt/dispatcher/cache"
      /rules { /0001 { /glob "*" /type "allow" } }
    }
  }
}`,
    after: `/farms {
  /publish-farm {
    /clientheaders {
      "*"
    }
    /virtualhosts {
      "*"
    }
    /renders {
      /rend01 {
        /hostname "\${PUBLISH_IP}"
        /port "4503"
      }
    }
    # allowedClients removed - managed by Cloud CDN
    # statistics removed - Cloud handles load balancing
    /cache {
      /docroot "\${DOCROOT}"
      /rules { /0001 { /glob "*" /type "allow" } }
    }
  }
}`,
    confidence: 0.93,
    status: 'pending',
    severity: Severity.MEDIUM,
    description: 'Remove on-premise dispatcher directives (allowedClients, statistics) and use Cloud CDN variables for docroot.',
    autoFixApplied: true,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },
  {
    id: 'rev-010',
    filePath: '/dispatcher/src/conf.d/rewrites/rewrite.rules',
    changeType: 'dispatcher',
    before: `RewriteEngine On

# Force SSL
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]

# Vanity URL redirects
RewriteRule ^/products$ /content/mysite/us/en/products.html [PT,L]
RewriteRule ^/about$ /content/mysite/us/en/about.html [PT,L]

# Legacy URL mappings
RewriteRule ^/dam/(.*)$ /content/dam/mysite/$1 [PT,L]`,
    after: `RewriteEngine On

# Force SSL - handled by Cloud CDN, kept for local dev
# RewriteCond %{HTTPS} off
# RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]

# Vanity URL redirects
RewriteRule ^/products$ /content/mysite/us/en/products.html [PT,L]
RewriteRule ^/about$ /content/mysite/us/en/about.html [PT,L]

# Legacy URL mappings
RewriteRule ^/dam/(.*)$ /content/dam/mysite/$1 [PT,L]`,
    confidence: 0.85,
    status: 'pending',
    severity: Severity.LOW,
    description: 'Comment out SSL enforcement rules handled by Cloud CDN. Verify vanity URLs still work with Sling mappings.',
    autoFixApplied: true,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },

  // ── Workflow Modernizations (2) ─────────────────────────────────────
  {
    id: 'rev-011',
    filePath: '/var/workflow/models/dam/update_asset/jcr:content/model.xml',
    changeType: 'workflow',
    before: `<flow jcr:primaryType="nt:unstructured">
    <node1 jcr:primaryType="cq:WorkflowNode"
        title="Extract Metadata"
        type="PROCESS"
        impl="com.day.cq.dam.core.process.ExtractMetadataProcess">
    </node1>
    <node2 jcr:primaryType="cq:WorkflowNode"
        title="Create Thumbnail"
        type="PROCESS"
        impl="com.day.cq.dam.core.process.CreateThumbnailProcess">
        <metaData thumbnailSize="140" />
    </node2>
    <node3 jcr:primaryType="cq:WorkflowNode"
        title="Custom Watermark"
        type="PROCESS"
        impl="com.mysite.core.workflow.WatermarkProcess">
    </node3>
</flow>`,
    after: `<!-- DAM Update Asset workflow replaced by Asset Compute / Processing Profiles -->
<!--
  Standard processing (metadata extraction, thumbnails) is handled
  automatically by AEM as a Cloud Service asset microservices.

  Custom processing (watermarking) must be migrated to an
  Asset Compute worker:

  1. Create Asset Compute worker: /src/dx-asset-compute-worker/
  2. Register processing profile in AEM Cloud
  3. Map to /content/dam/mysite folder

  See: https://experienceleague.adobe.com/docs/asset-compute
-->

// Asset Compute worker skeleton for WatermarkProcess:
// exports.main = async (source, rendition, params) => {
//   const { overlayImage } = params;
//   // Apply watermark to source, write to rendition
// };`,
    confidence: 0.62,
    status: 'pending',
    severity: Severity.HIGH,
    description: 'Custom DAM Update Asset workflow must be replaced with Asset Compute workers. Contains custom watermark step requiring manual migration.',
    autoFixApplied: false,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },
  {
    id: 'rev-012',
    filePath: '/etc/workflow/launcher/config/dam_asset_upload.xml',
    changeType: 'workflow',
    before: `<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
    jcr:primaryType="cq:WorkflowLauncher"
    conditions="jcr:content/jcr:mimeType!=video/.*"
    enabled="{Boolean}true"
    eventType="{Long}1"
    glob="/content/dam(/.*/)renditions/original"
    nodetype="nt:file"
    runMode="author"
    workflow="/var/workflow/models/dam/update_asset"/>`,
    after: `<!-- Relocated to /libs/settings/workflow/launcher/config/ -->
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
    jcr:primaryType="cq:WorkflowLauncher"
    conditions="jcr:content/jcr:mimeType!=video/.*"
    enabled="{Boolean}true"
    eventType="{Long}1"
    glob="/content/dam(/.*/)renditions/original"
    nodetype="nt:file"
    runMode="author"
    workflow="/var/workflow/models/dam/update_asset"/>

<!-- Target path: /libs/settings/workflow/launcher/config/dam_asset_upload -->`,
    confidence: 0.94,
    status: 'pending',
    severity: Severity.MEDIUM,
    description: 'Relocate workflow launcher config from /etc/workflow/launcher to /libs/settings/workflow/launcher.',
    autoFixApplied: true,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },

  // ── Index Conversions (2) ───────────────────────────────────────────
  {
    id: 'rev-013',
    filePath: '/oak:index/mysite-lucene/jcr:content/.content.xml',
    changeType: 'index',
    before: `<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
    xmlns:oak="http://jackrabbit.apache.org/oak/ns/1.0"
    jcr:primaryType="oak:QueryIndexDefinition"
    type="lucene"
    reindex="{Boolean}false"
    includePropertyNames="{String}[jcr:title,jcr:description,cq:tags]"
    queryPaths="/content/mysite">
    <indexRules jcr:primaryType="nt:unstructured">
        <cq:Page jcr:primaryType="nt:unstructured">
            <properties jcr:primaryType="nt:unstructured">
                <title name="jcr:title" propertyIndex="{Boolean}true" analyzed="{Boolean}true"/>
                <desc name="jcr:description" propertyIndex="{Boolean}true"/>
            </properties>
        </cq:Page>
    </indexRules>
</jcr:root>`,
    after: `<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
    xmlns:oak="http://jackrabbit.apache.org/oak/ns/1.0"
    jcr:primaryType="oak:QueryIndexDefinition"
    type="lucene"
    async="[async, nrt]"
    compatVersion="{Long}2"
    reindex="{Boolean}false"
    includePropertyNames="{String}[jcr:title,jcr:description,cq:tags]"
    queryPaths="/content/mysite">
    <indexRules jcr:primaryType="nt:unstructured">
        <cq:Page jcr:primaryType="nt:unstructured">
            <properties jcr:primaryType="nt:unstructured">
                <title name="jcr:title" propertyIndex="{Boolean}true" analyzed="{Boolean}true"/>
                <desc name="jcr:description" propertyIndex="{Boolean}true"/>
            </properties>
        </cq:Page>
    </indexRules>
</jcr:root>`,
    confidence: 0.98,
    status: 'pending',
    severity: Severity.HIGH,
    description: 'Add async="[async, nrt]" and compatVersion=2 required for Cloud Service index definitions.',
    autoFixApplied: true,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },
  {
    id: 'rev-014',
    filePath: '/content/mysite/oak:index/tags-property-index/.content.xml',
    changeType: 'index',
    before: `<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
    xmlns:oak="http://jackrabbit.apache.org/oak/ns/1.0"
    jcr:primaryType="oak:QueryIndexDefinition"
    type="property"
    propertyNames="{String}[cq:tags]"
    unique="{Boolean}false"/>`,
    after: `<!-- RELOCATED from /content/mysite/oak:index/ to /apps/_oak_index/ -->
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
    xmlns:oak="http://jackrabbit.apache.org/oak/ns/1.0"
    jcr:primaryType="oak:QueryIndexDefinition"
    type="lucene"
    async="[async, nrt]"
    compatVersion="{Long}2"
    includePropertyNames="{String}[cq:tags]">
    <indexRules jcr:primaryType="nt:unstructured">
        <nt:base jcr:primaryType="nt:unstructured">
            <properties jcr:primaryType="nt:unstructured">
                <tags name="cq:tags" propertyIndex="{Boolean}true"/>
            </properties>
        </nt:base>
    </indexRules>
</jcr:root>

<!-- Target path: /apps/_oak_index/tags-lucene-index -->`,
    confidence: 0.96,
    status: 'pending',
    severity: Severity.CRITICAL,
    description: 'Relocate property index from /content to /apps/_oak_index and convert from property type to lucene type.',
    autoFixApplied: true,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },

  // ── Complex Business Logic Change (1) ───────────────────────────────
  {
    id: 'rev-015',
    filePath: '/core/src/main/java/com/mysite/core/services/impl/ContentSyncServiceImpl.java',
    changeType: 'deprecated_api',
    before: `@Component(service = ContentSyncService.class, immediate = true)
public class ContentSyncServiceImpl implements ContentSyncService {

    @Reference
    private ResourceResolverFactory resolverFactory;

    @Reference
    private Replicator replicator;

    @Override
    public void syncContent(String sourcePath, String targetPath) throws Exception {
        ResourceResolver resolver = resolverFactory.getAdministrativeResourceResolver(null);
        try {
            Session session = resolver.adaptTo(Session.class);
            Workspace workspace = session.getWorkspace();

            // Clone content tree
            workspace.clone("crx.default", sourcePath, targetPath, true);

            // Activate each child node
            Node targetNode = session.getNode(targetPath);
            NodeIterator children = targetNode.getNodes();
            while (children.hasNext()) {
                Node child = children.nextNode();
                replicator.replicate(session, ReplicationActionType.ACTIVATE, child.getPath());
            }

            session.save();
        } finally {
            resolver.close();
        }
    }
}`,
    after: `@Component(service = ContentSyncService.class, immediate = true)
public class ContentSyncServiceImpl implements ContentSyncService {

    @Reference
    private ResourceResolverFactory resolverFactory;

    @Reference
    private Replicator replicator;

    private static final String SUBSERVICE = "mysite-content-sync";

    @Override
    public void syncContent(String sourcePath, String targetPath) throws Exception {
        Map<String, Object> params = Collections.singletonMap(
            ResourceResolverFactory.SUBSERVICE, SUBSERVICE
        );

        try (ResourceResolver resolver = resolverFactory.getServiceResourceResolver(params)) {
            Resource sourceResource = resolver.getResource(sourcePath);
            if (sourceResource == null) {
                throw new IllegalArgumentException("Source path not found: " + sourcePath);
            }

            // Use Resource API instead of JCR workspace clone
            Map<String, Object> properties = new HashMap<>();
            sourceResource.getValueMap().forEach(properties::put);

            Resource targetParent = resolver.getResource(
                targetPath.substring(0, targetPath.lastIndexOf('/'))
            );
            resolver.create(targetParent, ResourceUtil.getName(targetPath), properties);

            // Copy children recursively using Resource API
            copyChildren(resolver, sourceResource, resolver.getResource(targetPath));

            resolver.commit();

            // Use Granite Replication API with ResourceResolver
            replicator.replicate(resolver, ReplicationActionType.ACTIVATE, targetPath);
        }
    }

    private void copyChildren(ResourceResolver resolver, Resource source, Resource target)
            throws PersistenceException {
        for (Resource child : source.getChildren()) {
            Map<String, Object> props = new HashMap<>();
            child.getValueMap().forEach(props::put);
            Resource newChild = resolver.create(target, child.getName(), props);
            copyChildren(resolver, child, newChild);
        }
    }
}`,
    confidence: 0.58,
    status: 'pending',
    severity: Severity.CRITICAL,
    description: 'Complex refactor: Replace administrative resolver, JCR workspace clone, and session-based replication with service user, Resource API, and Granite Replication. Requires thorough testing.',
    autoFixApplied: false,
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
  },
];
