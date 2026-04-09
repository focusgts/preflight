package com.example;

import org.apache.sling.api.resource.ResourceResolver;
import org.apache.sling.api.resource.ResourceResolverFactory;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;

@Component(service = LeakyService.class)
public class LeakyService {

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
