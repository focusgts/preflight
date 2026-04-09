package com.example;

import javax.servlet.Servlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.osgi.service.component.annotations.Component;

@Component(
    service = Servlet.class,
    property = {
        "sling.servlet.paths=/bin/bad-servlet"
    }
)
public class BadServlet {
    public void doGet(HttpServletRequest req, HttpServletResponse res) {
        res.setStatus(200);
    }
}
