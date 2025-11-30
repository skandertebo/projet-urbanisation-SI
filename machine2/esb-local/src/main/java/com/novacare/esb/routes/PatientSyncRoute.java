package com.novacare.esb.routes;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PatientSyncRoute extends RouteBuilder {
    
    @Value("${cardio.service.url:http://cardio-consultation-service:5000}")
    private String cardioServiceUrl;
    
    @Value("${esb.central.url:http://esb-central:8081}")
    private String esbCentralUrl;
    
    @Override
    public void configure() throws Exception {
        // Route principale pour le check-in (admission patient)
        // Cette route implémente le scénario : recherche locale -> si non trouvé -> recherche centrale -> synchronisation
        from("jetty:http://0.0.0.0:8082/api/checkin")
            .log("ESB Local: Check-in patient - CIN: ${header.cin}")
            .setHeader("CamelHttpMethod", constant("GET"))
            .removeHeaders("CamelHttp*")
            .setHeader("CamelHttpMethod", constant("GET"))
            
            // Étape 1: Rechercher localement (ne pas lever d'exception sur 404)
            .toD(cardioServiceUrl + "/api/local_patient/cin/${header.cin}?throwExceptionOnFailure=false")
            .choice()
                .when(header("CamelHttpResponseCode").isEqualTo(200))
                    .log("Patient trouvé localement")
                    .convertBodyTo(String.class)
                .otherwise()
                    .log("Patient non trouvé localement (code: ${header.CamelHttpResponseCode}), recherche au siège...")
                    // Étape 2: Appeler l'ESB Central
                    .removeHeaders("CamelHttpResponseCode")
                    .setHeader("CamelHttpMethod", constant("GET"))
                    .toD(esbCentralUrl + "/api/patient/search?cin=${header.cin}&throwExceptionOnFailure=false")
                    .choice()
                        .when(header("CamelHttpResponseCode").isEqualTo(200))
                            .log("Patient trouvé au siège, synchronisation...")
                            .convertBodyTo(String.class)
                            // Étape 3: Synchroniser vers la base locale
                            .process(exchange -> {
                                String patientJson = exchange.getIn().getBody(String.class);
                                exchange.getIn().setBody(patientJson);
                            })
                            .setHeader("CamelHttpMethod", constant("POST"))
                            .setHeader("Content-Type", constant("application/json"))
                            .toD(cardioServiceUrl + "/api/local_patient")
                            .log("Patient synchronisé avec succès")
                        .otherwise()
                            .log("Patient non trouvé nulle part")
                            .setBody(constant("{\"error\": \"Patient non trouvé\"}"))
                            .setHeader("CamelHttpResponseCode", constant(404))
                    .end()
            .end();
        
        // Route pour récupérer les consultations
        from("jetty:http://0.0.0.0:8082/api/consultation/patient/<patientId>")
            .log("ESB Local: Récupération consultations pour patient ${header.patientId}")
            .setHeader("CamelHttpMethod", constant("GET"))
            .toD(cardioServiceUrl + "/api/consultation/patient/${header.patientId}")
            .log("Consultations récupérées");
    }
}
