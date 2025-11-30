#!/bin/bash

echo "=== Tests des Scénarios NovaCare POC ==="
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour tester un endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=$4
    
    echo -e "${YELLOW}Test: $name${NC}"
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" "$url")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ Succès (HTTP $http_code)${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ Échec (HTTP $http_code)${NC}"
        echo "$body"
    fi
    echo ""
}

# Attendre que les services soient prêts
echo "Attente du démarrage des services..."
sleep 10

# Test 1: Health checks
echo "=== Health Checks ==="
test_endpoint "Patient-Core-Service" "http://localhost:8080/actuator/health"
test_endpoint "Billing-Service" "http://localhost:3000/health"
test_endpoint "Cardio-Consultation-Service" "http://localhost:5001/health"
test_endpoint "Notification-Service" "http://localhost:8083/health"

# Test 2: Récupérer un patient existant
echo "=== Test 2: Récupérer un patient existant ==="
test_endpoint "Patient par ID" "http://localhost:8080/api/patients/1"

# Test 3: Check-in Patient (Scénario Principal)
echo "=== Test 3: Check-in Patient (Scénario Principal) ==="
test_endpoint "Check-in par CIN" "http://localhost:8082/api/checkin?cin=12345678"

# Test 4: Créer une consultation
echo "=== Test 4: Créer une consultation cardiaque ==="
consultation_data='{
  "patientId": "1",
  "doctorId": "doc1",
  "diagnosis": "Examen cardiaque de routine",
  "prescription": ["Aspirine 100mg"],
  "acts": [
    {"code": "CARD001", "description": "Consultation cardiologie", "price": 150},
    {"code": "ECG001", "description": "Électrocardiogramme", "price": 80}
  ]
}'
test_endpoint "Créer consultation" "http://localhost:5001/api/consultation" "POST" "$consultation_data"

# Test 5: Générer une facture
echo "=== Test 5: Générer une facture ==="
billing_data='{
  "patientId": "1",
  "consultationId": "1",
  "acts": [
    {"code": "CARD001", "description": "Consultation cardiologie", "price": 150},
    {"code": "ECG001", "description": "Électrocardiogramme", "price": 80}
  ]
}'
test_endpoint "Générer facture" "http://localhost:3000/api/billing/generate" "POST" "$billing_data"

# Test 6: Envoyer une notification
echo "=== Test 6: Envoyer une notification ==="
notification_data='{
  "to": "patient@example.com",
  "subject": "Votre facture NovaCare",
  "body": "Votre facture est prête. Merci de votre visite.",
  "type": "email"
}'
test_endpoint "Envoyer notification" "http://localhost:8083/api/notifications/send" "POST" "$notification_data"

echo "=== Tests terminés ==="


