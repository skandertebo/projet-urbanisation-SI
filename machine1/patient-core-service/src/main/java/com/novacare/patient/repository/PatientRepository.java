package com.novacare.patient.repository;

import com.novacare.patient.model.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PatientRepository extends JpaRepository<Patient, Long> {
    Optional<Patient> findByCin(String cin);
    Optional<Patient> findByFirstNameAndLastName(String firstName, String lastName);
}


