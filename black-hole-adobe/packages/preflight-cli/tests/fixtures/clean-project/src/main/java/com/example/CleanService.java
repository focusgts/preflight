package com.example;

import org.apache.sling.api.resource.ResourceResolver;
import org.apache.sling.api.resource.ResourceResolverFactory;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;

@Component(service = CleanService.class)
public class CleanService {

    @Reference
    private ResourceResolverFactory resolverFactory;

    public String readPath(String path) {
        try (ResourceResolver resolver = resolverFactory.getServiceResourceResolver(null)) {
            return resolver.getResource(path).getPath();
        } catch (Exception e) {
            return null;
        }
    }
}
