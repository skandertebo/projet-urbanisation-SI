package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/robfig/cron/v3"
)

// Patient represents a patient record
type Patient struct {
	ID             string   `json:"id"`
	CIN            string   `json:"cin"`
	FirstName      string   `json:"firstName"`
	LastName       string   `json:"lastName"`
	DateOfBirth    string   `json:"dateOfBirth"`
	Email          string   `json:"email"`
	Phone          string   `json:"phone"`
	Address        string   `json:"address"`
	Allergies      []string `json:"allergies"`
	MedicalHistory []string `json:"medicalHistory"`
	CreatedAt      string   `json:"createdAt"`
	UpdatedAt      string   `json:"updatedAt"`
	SyncedAt       string   `json:"syncedAt"`
	CentralID      int      `json:"centralId,omitempty"`
}

// CentralPatient represents a patient from central service
type CentralPatient struct {
	ID             int      `json:"id"`
	CIN            string   `json:"cin"`
	FirstName      string   `json:"firstName"`
	LastName       string   `json:"lastName"`
	DateOfBirth    string   `json:"dateOfBirth"`
	Email          string   `json:"email"`
	Phone          string   `json:"phone"`
	Address        string   `json:"address"`
	Allergies      []string `json:"allergies"`
	MedicalHistory []string `json:"medicalHistory"`
}

// Config holds service configuration
type Config struct {
	CardioServiceURL string
	ESBCentralURL    string
	SyncInterval     string
	Port             string
}

var config Config

func init() {
	config = Config{
		CardioServiceURL: getEnv("CARDIO_SERVICE_URL", "http://cardio-consultation-service:5000"),
		ESBCentralURL:    getEnv("ESB_CENTRAL_URL", "http://esb-central:8081"),
		SyncInterval:     getEnv("SYNC_INTERVAL", "* * * * *"), // Every minute
		Port:             getEnv("PORT", "8085"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	log.Println("╔════════════════════════════════════════════════════════════╗")
	log.Println("║       NovaCare - Sync Service (Machine 2 - El Hayet)       ║")
	log.Println("╚════════════════════════════════════════════════════════════╝")
	log.Printf("[SYNC] Cardio Service URL: %s", config.CardioServiceURL)
	log.Printf("[SYNC] ESB Central URL: %s", config.ESBCentralURL)
	log.Printf("[SYNC] Sync Interval: %s", config.SyncInterval)

	// Create cron scheduler
	c := cron.New()

	// Schedule sync job
	_, err := c.AddFunc(config.SyncInterval, syncPatients)
	if err != nil {
		log.Fatalf("[SYNC] Failed to schedule sync job: %v", err)
	}

	// Start cron scheduler
	c.Start()
	log.Println("[SYNC] Cron scheduler started - running every minute")

	// Run initial sync
	log.Println("[SYNC] Running initial synchronization...")
	syncPatients()

	// Start HTTP server for health check
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/sync", manualSyncHandler)

	log.Printf("[SYNC] HTTP server listening on port %s", config.Port)
	if err := http.ListenAndServe(":"+config.Port, nil); err != nil {
		log.Fatalf("[SYNC] Server failed: %v", err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "UP",
		"service": "sync-service",
	})
}

func manualSyncHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("[SYNC] Manual sync triggered via API")
	syncPatients()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "completed",
		"message": "Synchronization completed",
	})
}

func syncPatients() {
	log.Println("────────────────────────────────────────────────────────────────")
	log.Printf("[SYNC] Starting synchronization at %s", time.Now().Format(time.RFC3339))

	// Get all local patients
	localPatients, err := getLocalPatients()
	if err != nil {
		log.Printf("[SYNC] ❌ Error fetching local patients: %v", err)
		return
	}

	if len(localPatients) == 0 {
		log.Println("[SYNC] No local patients found")
		return
	}

	log.Printf("[SYNC] Found %d local patient(s)", len(localPatients))

	// Calculate time threshold (1 minute ago)
	threshold := time.Now().Add(-1 * time.Minute)
	syncCount := 0
	createCount := 0
	updateCount := 0
	skipCount := 0

	for _, patient := range localPatients {
		// Check if patient was recently created or updated
		needsSync := false
		
		if patient.CreatedAt != "" {
			createdAt, err := parseTime(patient.CreatedAt)
			if err == nil && createdAt.After(threshold) {
				needsSync = true
			}
		}
		
		if patient.UpdatedAt != "" {
			updatedAt, err := parseTime(patient.UpdatedAt)
			if err == nil && updatedAt.After(threshold) {
				needsSync = true
			}
		}

		// Also sync if never synced before
		if patient.SyncedAt == "" && patient.CentralID == 0 {
			needsSync = true
		}

		if !needsSync {
			skipCount++
			continue
		}

		log.Printf("[SYNC] 🔄 Processing patient: %s %s (CIN: %s)", 
			patient.FirstName, patient.LastName, patient.CIN)

		// Check if patient exists in central
		centralPatient, exists := getPatientFromCentral(patient.CIN)

		if !exists {
			// Create patient in central
			log.Printf("[SYNC] ➕ Patient not found in central, creating...")
			err := createPatientInCentral(patient)
			if err != nil {
				log.Printf("[SYNC] ❌ Failed to create patient in central: %v", err)
			} else {
				log.Printf("[SYNC] ✅ Patient created in central successfully")
				createCount++
				syncCount++
			}
		} else {
			// Patient already exists in central
			log.Printf("[SYNC] 📋 Patient already exists in central (ID: %d)", centralPatient.ID)
			
			// Check if this is a patient that was already synced during check-in
			if patient.CentralID > 0 {
				log.Printf("[SYNC] ⏭️ Patient already synced (centralId: %d), skipping", patient.CentralID)
				skipCount++
			} else if patient.SyncedAt != "" {
				log.Printf("[SYNC] ⏭️ Patient previously synced, skipping")
				skipCount++
			} else {
				// Link local patient to central for future reference
				log.Printf("[SYNC] 🔗 Linking local patient to central ID %d", centralPatient.ID)
				syncCount++
			}
		}
	}

	log.Println("────────────────────────────────────────────────────────────────")
	log.Printf("[SYNC] 📊 Synchronization Summary:")
	log.Printf("[SYNC]    - Total patients processed: %d", len(localPatients))
	log.Printf("[SYNC]    - Created in central: %d", createCount)
	log.Printf("[SYNC]    - Updated in central: %d", updateCount)
	log.Printf("[SYNC]    - Skipped (no changes): %d", skipCount)
	log.Printf("[SYNC]    - Total synced: %d", syncCount)
	log.Printf("[SYNC] Synchronization completed at %s", time.Now().Format(time.RFC3339))
	log.Println("────────────────────────────────────────────────────────────────")
}

func parseTime(timeStr string) (time.Time, error) {
	// Try different time formats
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05.999999",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	}

	for _, format := range formats {
		if t, err := time.Parse(format, timeStr); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unable to parse time: %s", timeStr)
}

func getLocalPatients() ([]Patient, error) {
	resp, err := http.Get(config.CardioServiceURL + "/api/local_patients")
	if err != nil {
		return nil, fmt.Errorf("failed to connect to cardio service: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("cardio service returned status %d: %s", resp.StatusCode, string(body))
	}

	var patients []Patient
	if err := json.NewDecoder(resp.Body).Decode(&patients); err != nil {
		return nil, fmt.Errorf("failed to decode patients: %v", err)
	}

	return patients, nil
}

func getPatientFromCentral(cin string) (*CentralPatient, bool) {
	resp, err := http.Get(config.ESBCentralURL + "/api/patient/search?cin=" + cin)
	if err != nil {
		log.Printf("[SYNC] Error checking central: %v", err)
		return nil, false
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, false
	}

	if resp.StatusCode != http.StatusOK {
		return nil, false
	}

	var patient CentralPatient
	if err := json.NewDecoder(resp.Body).Decode(&patient); err != nil {
		log.Printf("[SYNC] Error decoding central patient: %v", err)
		return nil, false
	}

	return &patient, true
}

func createPatientInCentral(patient Patient) error {
	payload := map[string]interface{}{
		"cin":            patient.CIN,
		"firstName":      patient.FirstName,
		"lastName":       patient.LastName,
		"dateOfBirth":    patient.DateOfBirth,
		"email":          patient.Email,
		"phone":          patient.Phone,
		"address":        patient.Address,
		"allergies":      patient.Allergies,
		"medicalHistory": patient.MedicalHistory,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal patient data: %v", err)
	}

	resp, err := http.Post(
		config.ESBCentralURL+"/api/patient/create",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return fmt.Errorf("failed to create patient in central: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		// Check if it's a duplicate error (409)
		if resp.StatusCode == http.StatusConflict {
			log.Printf("[SYNC] ⚠️ Patient already exists in central (conflict)")
			return nil
		}
		return fmt.Errorf("central returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func updatePatientInCentral(centralID int, patient Patient) error {
	// For this POC, we'll recreate/update via the create endpoint
	// A real implementation would have a PUT endpoint
	payload := map[string]interface{}{
		"cin":            patient.CIN,
		"firstName":      patient.FirstName,
		"lastName":       patient.LastName,
		"dateOfBirth":    patient.DateOfBirth,
		"email":          patient.Email,
		"phone":          patient.Phone,
		"address":        patient.Address,
		"allergies":      patient.Allergies,
		"medicalHistory": patient.MedicalHistory,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal patient data: %v", err)
	}

	// Use PUT to patient-core-service directly for update
	req, err := http.NewRequest(
		"PUT",
		fmt.Sprintf("http://patient-core-service:8080/api/patients/%d", centralID),
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update patient in central: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("central returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

