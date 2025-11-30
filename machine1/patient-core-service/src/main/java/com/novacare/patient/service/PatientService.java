package com.novacare.patient.service;

import com.novacare.patient.model.Patient;
import com.novacare.patient.repository.PatientRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class PatientService {
    
    @Autowired
    private PatientRepository patientRepository;
    
    public Optional<Patient> findById(Long id) {
        return patientRepository.findById(id);
    }
    
    public Optional<Patient> findByCin(String cin) {
        return patientRepository.findByCin(cin);
    }
    
    public Optional<Patient> findByFirstNameAndLastName(String firstName, String lastName) {
        return patientRepository.findByFirstNameAndLastName(firstName, lastName);
    }
    
    public Patient save(Patient patient) {
        return patientRepository.save(patient);
    }
    
    public List<Patient> findAll() {
        return patientRepository.findAll();
    }
}


