#!/bin/bash

echo "=== Test Rapide NovaCare POC ==="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Vérifier que les services sont démarrés
echo -e "${YELLOW}1. Vérification des services...${NC}"
services=("patient-core-service:8080" "billing-service:3000" "cardio-consultation-service:5001" "notification-service:8083")
all_up=true

for service in "${services[@]}"; do
    name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name"
    else
        echo -e "${RED}✗${NC} $name (non disponible)"
        all_up=false
    fi
done

if [ "$all_up" = false ]; then
    echo -e "\n${RED}Certains services ne sont pas disponibles.${NC}"
    echo "Lancez: docker-compose up -d"
    exit 1
fi

echo -e "\n${YELLOW}2. Test Patient-Core-Service${NC}"
patient=$(curl -s http://localhost:8080/api/patients/1)
if echo "$patient" | grep -q "Ahmed"; then
    echo -e "${GREEN}✓${NC} Patient trouvé au siège"
    echo "   Nom: $(echo $patient | grep -o '"firstName":"[^"]*"' | cut -d'"' -f4) $(echo $patient | grep -o '"lastName":"[^"]*"' | cut -d'"' -f4)"
else
    echo -e "${RED}✗${NC} Patient non trouvé"
fi

echo -e "\n${YELLOW}3. Test Check-in (Scénario Principal)${NC}"
cin="12345678"
checkin=$(curl -s "http://localhost:8082/api/checkin?cin=$cin")
if echo "$checkin" | grep -q "Ahmed\|Tounsi"; then
    echo -e "${GREEN}✓${NC} Check-in réussi - Patient synchronisé"
else
    echo -e "${YELLOW}⚠${NC} Vérifiez les logs: docker-compose logs esb-local"
fi

echo -e "\n${YELLOW}4. Test Consultation${NC}"
consultation=$(curl -s -X POST http://localhost:5001/api/consultation \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "1",
    "doctorId": "doc1",
    "diagnosis": "Test consultation",
    "acts": [{"code": "TEST", "description": "Test", "price": 100}]
  }')
if echo "$consultation" | grep -q "id"; then
    echo -e "${GREEN}✓${NC} Consultation créée"
else
    echo -e "${RED}✗${NC} Erreur création consultation"
fi

echo -e "\n${YELLOW}5. Test Facturation${NC}"
invoice=$(curl -s -X POST http://localhost:3000/api/billing/generate \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "1",
    "consultationId": "1",
    "acts": [{"code": "TEST", "description": "Test", "price": 100}]
  }')
if echo "$invoice" | grep -q "success.*true"; then
    echo -e "${GREEN}✓${NC} Facture générée"
    invoice_num=$(echo "$invoice" | grep -o '"invoiceNumber":"[^"]*"' | cut -d'"' -f4)
    echo "   Numéro: $invoice_num"
else
    echo -e "${RED}✗${NC} Erreur génération facture"
fi

echo -e "\n${YELLOW}6. Test Notification${NC}"
notification=$(curl -s -X POST http://localhost:8083/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test",
    "body": "Test notification",
    "type": "email"
  }')
if echo "$notification" | grep -q "success.*true"; then
    echo -e "${GREEN}✓${NC} Notification envoyée"
else
    echo -e "${RED}✗${NC} Erreur envoi notification"
fi

echo -e "\n${GREEN}=== Tests terminés ===${NC}"
echo ""
echo "Pour plus de détails, consultez TESTING.md"


