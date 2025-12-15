package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
)

// NotificationRequest - Internal format uses different field names
// Expects: recipient_address, message_title, message_content, delivery_channel
type NotificationRequest struct {
	RecipientAddress string `json:"recipient_address"`
	MessageTitle     string `json:"message_title"`
	MessageContent   string `json:"message_content"`
	DeliveryChannel  string `json:"delivery_channel"` // EMAIL, SMS, PUSH
	Priority         string `json:"priority"`         // HIGH, NORMAL, LOW
	Metadata         map[string]string `json:"metadata,omitempty"`
}

// NotificationResponse - Response in internal format
type NotificationResponse struct {
	DeliveryStatus   string `json:"delivery_status"` // SENT, FAILED, QUEUED
	TransactionID    string `json:"transaction_id"`
	StatusMessage    string `json:"status_message"`
	Timestamp        string `json:"timestamp"`
	DeliveryChannel  string `json:"delivery_channel"`
}

type HealthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}

	r := mux.NewRouter()

	// Health check
	r.HandleFunc("/health", healthHandler).Methods("GET")

	// Send notification
	r.HandleFunc("/api/notifications/send", sendNotificationHandler).Methods("POST")

	log.Printf("Notification Service démarré sur le port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(HealthResponse{
		Status:  "OK",
		Service: "notification-service",
	})
}

func sendNotificationHandler(w http.ResponseWriter, r *http.Request) {
	var req NotificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"delivery_status": "FAILED", "status_message": "Invalid request body format. Expected: recipient_address, message_title, message_content, delivery_channel"}`, http.StatusBadRequest)
		return
	}

	// Validate required fields in internal format
	if req.RecipientAddress == "" || req.MessageContent == "" {
		http.Error(w, `{"delivery_status": "FAILED", "status_message": "recipient_address and message_content are required"}`, http.StatusBadRequest)
		return
	}

	// Default delivery channel
	if req.DeliveryChannel == "" {
		req.DeliveryChannel = "EMAIL"
	}

	// Simuler l'envoi de notification
	transactionID := fmt.Sprintf("TXN-%d", time.Now().UnixNano())
	timestamp := time.Now().Format(time.RFC3339)

	log.Printf("[NOTIFICATION] Channel: %s, To: %s, Title: %s", req.DeliveryChannel, req.RecipientAddress, req.MessageTitle)
	log.Printf("[NOTIFICATION] Content: %s", req.MessageContent)
	if req.Priority != "" {
		log.Printf("[NOTIFICATION] Priority: %s", req.Priority)
	}

	// Response in internal format
	response := NotificationResponse{
		DeliveryStatus:  "SENT",
		TransactionID:   transactionID,
		StatusMessage:   fmt.Sprintf("Notification delivered via %s to %s", req.DeliveryChannel, req.RecipientAddress),
		Timestamp:       timestamp,
		DeliveryChannel: req.DeliveryChannel,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}


