/**
 * Public Pre-Flight Sample Snippets (ADR-064)
 *
 * Canned "failing" code examples for the public /preflight page. Each
 * sample is a short, self-contained snippet that the real Cloud Manager
 * rule engine flags for at least one specific rule. The `expectedRuleIds`
 * array is asserted in tests so samples stay in sync with rule changes.
 *
 * These are intentionally tiny — big enough to trip a rule, small enough
 * that the user can read, understand, and share them in a single glance.
 */

export type PublicSampleLanguage = 'java' | 'xml';

export interface PublicSample {
  /** Stable ID used as React key / analytics label. */
  id: string;
  /** Dropdown label shown in the UI. */
  label: string;
  /** One-line description of what's wrong. */
  description: string;
  /** Highlighting language (also drives the engine's file extension). */
  language: PublicSampleLanguage;
  /** Synthetic file path passed to the engine (drives rule applicability). */
  filePath: string;
  /** The code snippet itself. */
  code: string;
  /** Rule IDs this sample should trigger when run through the engine. */
  expectedRuleIds: string[];
}

export const PUBLIC_SAMPLES: readonly PublicSample[] = [
  {
    id: 'javax-to-jakarta',
    label: 'javax.* to jakarta.* (Critical)',
    description:
      'Uses the old javax.servlet namespace. AEMaaCS SDK 2024.x+ requires jakarta.*.',
    language: 'java',
    filePath: 'src/main/java/com/example/MyServlet.java',
    code: `package com.example;

import javax.servlet.Servlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.osgi.service.component.annotations.Component;

@Component(service = Servlet.class)
public class MyServlet {
    public void doGet(HttpServletRequest req, HttpServletResponse res) {
        res.setStatus(200);
    }
}
`,
    expectedRuleIds: ['JavaCompat:JavaxToJakarta'],
  },

  {
    id: 'sun-packages',
    label: 'sun.* internal packages (Blocker)',
    description:
      'Uses sun.misc internal APIs that are removed/encapsulated in Java 17+.',
    language: 'java',
    filePath: 'src/main/java/com/example/UnsafeHelper.java',
    code: `package com.example;

import sun.misc.Unsafe;
import java.lang.reflect.Field;

public class UnsafeHelper {
    public static Unsafe getUnsafe() throws Exception {
        Field f = Unsafe.class.getDeclaredField("theUnsafe");
        f.setAccessible(true);
        return (Unsafe) f.get(null);
    }
}
`,
    expectedRuleIds: ['JavaCompat:SunPackages'],
  },

  {
    id: 'oak-async-flag',
    label: 'Lucene index missing async flag (Blocker)',
    description:
      'Custom Lucene index without async="[async, nrt]" — not supported in AEMaaCS.',
    language: 'xml',
    filePath: 'ui.apps/src/main/content/jcr_root/_oak_index/customLucene/.content.xml',
    code: `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
          xmlns:oak="http://jackrabbit.apache.org/oak/ns/1.0"
          jcr:primaryType="oak:QueryIndexDefinition"
          type="lucene"
          compatVersion="{Long}2"
          evaluatePathRestrictions="{Boolean}true">
    <indexRules jcr:primaryType="nt:unstructured">
        <cq:Page jcr:primaryType="nt:unstructured">
            <properties jcr:primaryType="nt:unstructured"/>
        </cq:Page>
    </indexRules>
</jcr:root>
`,
    expectedRuleIds: ['OakPAL:AsyncFlag'],
  },

  {
    id: 'cqbp-84-resolver-lifecycle',
    label: 'ResourceResolver lifecycle (Critical)',
    description:
      'ResourceResolver stored as an instance field in an OSGi component — leaks resources in AEMaaCS.',
    language: 'java',
    filePath: 'src/main/java/com/example/MyService.java',
    code: `package com.example;

import org.apache.sling.api.resource.ResourceResolver;
import org.apache.sling.api.resource.ResourceResolverFactory;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;

@Component(service = MyService.class)
public class MyService {

    @Reference
    private ResourceResolverFactory resolverFactory;

    private ResourceResolver resolver;

    @Activate
    protected void activate() throws Exception {
        this.resolver = resolverFactory.getServiceResourceResolver(null);
    }

    public String readPath(String path) {
        return resolver.getResource(path).getPath();
    }
}
`,
    expectedRuleIds: ['CQRules:CQBP-84'],
  },
] as const;

/** Lookup helper for UI + tests. */
export function getSampleById(id: string): PublicSample | undefined {
  return PUBLIC_SAMPLES.find((s) => s.id === id);
}
