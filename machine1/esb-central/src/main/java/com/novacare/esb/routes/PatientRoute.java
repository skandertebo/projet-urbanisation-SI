package com.novacare.esb.routes;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PatientRoute extends RouteBuilder {
    
    @Value("${patient.service.url:http://patient-core-service:8080}")
    private String patientServiceUrl;
    
    @Value("${billing.service.url:http://billing-service:3000}")
    private String billingServiceUrl;
    
    @Override
    public void configure() throws Exception {
        // Route pour rechercher un patient
        from("jetty:http://0.0.0.0:8081/api/patient/search")
            .log("ESB Central: Recherche de patient - CIN: ${header.cin}")
            .setHeader("CamelHttpMethod", constant("GET"))
            .removeHeaders("CamelHttp*")
            .setHeader("CamelHttpMethod", constant("GET"))
            .toD(patientServiceUrl + "/api/patients/cin/${header.cin}")
            .choice()
                .when(header("CamelHttpResponseCode").isEqualTo(200))
                    .log("Patient trouvé au siège")
                    .convertBodyTo(String.class)
                    // Transformation XML vers JSON pour compatibilité
                    .process(exchange -> {
                        String body = exchange.getIn().getBody(String.class);
                        // Si c'est du XML, on le transforme en JSON (simplifié pour le POC)
                        if (body != null && body.trim().startsWith("<")) {
                            // Transformation basique XML -> JSON
                            exchange.getIn().setHeader("Content-Type", "application/json");
                        }
                    })
                .otherwise()
                    .log("Patient non trouvé")
                    .setBody(constant("{\"error\": \"Patient non trouvé\"}"))
                    .setHeader("CamelHttpResponseCode", constant(404))
            .end();
        
        // Route pour créer un patient
        from("jetty:http://0.0.0.0:8081/api/patient/create")
            .log("ESB Central: Création de patient")
            .setHeader("CamelHttpMethod", constant("POST"))
            .setHeader("Content-Type", constant("application/json"))
            .toD(patientServiceUrl + "/api/patients")
            .log("Patient créé avec succès");
        
        // Route pour la facturation
        from("jetty:http://0.0.0.0:8081/api/billing/generate")
            .log("ESB Central: Génération de facture")
            .setHeader("CamelHttpMethod", constant("POST"))
            .setHeader("Content-Type", constant("application/json"))
            .toD(billingServiceUrl + "/api/billing/generate")
            .log("Facture générée avec succès");
    }
}
