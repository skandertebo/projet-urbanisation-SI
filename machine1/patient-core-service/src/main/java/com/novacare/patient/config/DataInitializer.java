package com.novacare.patient.config;

import com.novacare.patient.model.Patient;
import com.novacare.patient.repository.PatientRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Arrays;

@Component
public class DataInitializer implements CommandLineRunner {
    
    @Autowired
    private PatientRepository patientRepository;
    
    @Override
    public void run(String... args) {
        // Créer un patient de test
        if (patientRepository.count() == 0) {
            Patient patient = new Patient();
            patient.setCin("12345678");
            patient.setFirstName("Ahmed");
            patient.setLastName("Tounsi");
            patient.setDateOfBirth(LocalDate.of(1980, 5, 15));
            patient.setEmail("ahmed.tounsi@example.com");
            patient.setPhone("+216 12 345 678");
            patient.setAddress("Tunis, Tunisie");
            patient.setAllergies(Arrays.asList("Pénicilline", "Aspirine"));
            patient.setMedicalHistory(Arrays.asList("Hypertension", "Diabète type 2"));
            
            patientRepository.save(patient);
            System.out.println("Patient de test créé : Ahmed Tounsi (CIN: 12345678)");
        }
    }
}


