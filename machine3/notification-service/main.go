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

type NotificationRequest struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
	Type    string `json:"type"` // email, sms, etc.
}

type NotificationResponse struct {
	Success   bool   `json:"success"`
	MessageID string `json:"messageId"`
	Message   string `json:"message"`
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
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Simuler l'envoi de notification
	// Dans un vrai système, on utiliserait un service d'email (SendGrid, AWS SES, etc.)
	messageID := fmt.Sprintf("msg-%d", time.Now().UnixNano())

	log.Printf("Notification envoyée - Type: %s, To: %s, Subject: %s", req.Type, req.To, req.Subject)
	log.Printf("Body: %s", req.Body)

	response := NotificationResponse{
		Success:   true,
		MessageID: messageID,
		Message:   fmt.Sprintf("Notification %s envoyée avec succès à %s", req.Type, req.To),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}


