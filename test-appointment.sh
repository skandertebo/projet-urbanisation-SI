#!/bin/bash

# ╔════════════════════════════════════════════════════════════════╗
# ║     NovaCare - Tests Local Appointment Service (PHP)           ║
# ╚════════════════════════════════════════════════════════════════╝

BASE_URL="http://localhost:8002"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Compteurs
TESTS_PASSED=0
TESTS_FAILED=0

# Fonction de test
test_endpoint() {
  local description="$1"
  local url="$2"
  local method="${3:-GET}"
  local data="$4"
  local expected_code="${5:-200}"
  
  echo -e "${YELLOW}► $description${NC}"
  
  if [ "$method" == "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$url")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" == "$expected_code" ]; then
    echo -e "${GREEN}  ✓ HTTP $http_code (attendu: $expected_code)${NC}"
    echo "$body" | jq '.' 2>/dev/null | head -20
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}  ✗ HTTP $http_code (attendu: $expected_code)${NC}"
    echo "$body" | head -10
    ((TESTS_FAILED++))
    return 1
  fi
}

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     NovaCare - Tests Local Appointment Service (PHP)           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ══════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  HEALTH CHECK                                                    ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

test_endpoint "Health Check" "$BASE_URL/health"
echo ""

# ══════════════════════════════════════════════════════════════════
# CRÉATION DE RENDEZ-VOUS
# ══════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  CRÉATION DE RENDEZ-VOUS                                         ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# RDV 1: Consultation cardiologie
RDV1_DATA='{
  "patientId": "1",
  "patientCin": "12345678",
  "patientName": "Ahmed Tounsi",
  "doctorId": "DR-CARDIO-001",
  "doctorName": "Dr. Karim Mansour",
  "date": "2025-12-14",
  "time": "09:00",
  "reason": "Consultation de suivi cardiologique"
}'
test_endpoint "POST - Créer RDV cardiologie" "$BASE_URL/api/appointments" "POST" "$RDV1_DATA" 201

RDV1_ID=$(echo "$body" | jq -r '.id')
echo "RDV 1 ID: $RDV1_ID"
echo ""

# RDV 2: ECG
RDV2_DATA='{
  "patientId": "2",
  "patientCin": "87654321",
  "patientName": "Leila Bouazizi",
  "doctorId": "DR-CARDIO-002",
  "doctorName": "Dr. Sonia Ben Ali",
  "date": "2025-12-14",
  "time": "10:30",
  "reason": "ECG de contrôle post-opératoire"
}'
test_endpoint "POST - Créer RDV ECG" "$BASE_URL/api/appointments" "POST" "$RDV2_DATA" 201

RDV2_ID=$(echo "$body" | jq -r '.id')
echo "RDV 2 ID: $RDV2_ID"
echo ""

# RDV 3: Urgence
RDV3_DATA='{
  "patientId": "3",
  "patientCin": "11223344",
  "patientName": "Mohamed Trabelsi",
  "doctorId": "DR-CARDIO-001",
  "doctorName": "Dr. Karim Mansour",
  "date": "2025-12-14",
  "time": "14:00",
  "reason": "Douleur thoracique - consultation urgente"
}'
test_endpoint "POST - Créer RDV urgence" "$BASE_URL/api/appointments" "POST" "$RDV3_DATA" 201

RDV3_ID=$(echo "$body" | jq -r '.id')
echo "RDV 3 ID: $RDV3_ID"
echo ""

# ══════════════════════════════════════════════════════════════════
# CONSULTATION DES RENDEZ-VOUS
# ══════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  CONSULTATION DES RENDEZ-VOUS                                    ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

test_endpoint "GET - Liste des rendez-vous" "$BASE_URL/api/appointments"
echo ""

test_endpoint "GET - Détails RDV $RDV1_ID" "$BASE_URL/api/appointments/$RDV1_ID"
echo ""

test_endpoint "GET - RDV inexistant (404)" "$BASE_URL/api/appointments/99999" "GET" "" 404
echo ""

# ══════════════════════════════════════════════════════════════════
# FIN DE RENDEZ-VOUS (ENDPOINT /end)
# ══════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  FIN DE RENDEZ-VOUS - Génération des actes médicaux              ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Terminer RDV 1 - Consultation complète avec actes personnalisés
END_RDV1_DATA='{
  "diagnosis": "Hypertension artérielle de grade 1, bien contrôlée sous traitement",
  "notes": "Continuer Amlodipine 5mg/jour. Contrôle dans 3 mois.",
  "acts": [
    {
      "code": "CONS-CARDIO",
      "label": "Consultation cardiologie spécialisée",
      "category": "consultation",
      "price": 85.00
    },
    {
      "code": "ECG-12D",
      "label": "Électrocardiogramme 12 dérivations",
      "category": "examen",
      "price": 50.00
    },
    {
      "code": "TA-MESURE",
      "label": "Mesure tensionnelle",
      "category": "examen",
      "price": 15.00
    }
  ]
}'
test_endpoint "POST - Terminer RDV $RDV1_ID (consultation complète)" \
  "$BASE_URL/api/appointments/$RDV1_ID/end" "POST" "$END_RDV1_DATA"

TOTAL1=$(echo "$body" | jq -r '.totalAmount')
echo "Total actes RDV 1: $TOTAL1 TND"
echo ""

# Terminer RDV 2 - ECG avec échographie
END_RDV2_DATA='{
  "diagnosis": "Fonction cardiaque normale post-opératoire",
  "notes": "Reprise activité normale autorisée",
  "acts": [
    {
      "code": "ECG-12D",
      "label": "Électrocardiogramme 12 dérivations",
      "category": "examen",
      "price": 50.00
    },
    {
      "code": "ECHO-CARD",
      "label": "Échocardiographie transthoracique",
      "category": "imagerie",
      "price": 120.00
    },
    {
      "code": "CONS-SUIVI",
      "label": "Consultation de suivi",
      "category": "consultation",
      "price": 60.00
    }
  ]
}'
test_endpoint "POST - Terminer RDV $RDV2_ID (ECG + écho)" \
  "$BASE_URL/api/appointments/$RDV2_ID/end" "POST" "$END_RDV2_DATA"

TOTAL2=$(echo "$body" | jq -r '.totalAmount')
echo "Total actes RDV 2: $TOTAL2 TND"
echo ""

# Terminer RDV 3 - Urgence avec actes par défaut (sans spécifier les actes)
END_RDV3_DATA='{
  "diagnosis": "Douleur thoracique atypique - origine musculo-squelettique probable",
  "notes": "Pas de signe de syndrome coronarien. Anti-inflammatoires prescrits."
}'
test_endpoint "POST - Terminer RDV $RDV3_ID (actes par défaut)" \
  "$BASE_URL/api/appointments/$RDV3_ID/end" "POST" "$END_RDV3_DATA"

TOTAL3=$(echo "$body" | jq -r '.totalAmount')
echo "Total actes RDV 3 (défaut): $TOTAL3 TND"
echo ""

# Test terminer RDV inexistant
test_endpoint "POST - Terminer RDV inexistant (404)" \
  "$BASE_URL/api/appointments/99999/end" "POST" '{}' 404
echo ""

# ══════════════════════════════════════════════════════════════════
# VÉRIFICATION APRÈS MODIFICATION
# ══════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  VÉRIFICATION - État après modifications                         ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

test_endpoint "GET - Vérifier RDV $RDV1_ID (status=completed)" "$BASE_URL/api/appointments/$RDV1_ID"
STATUS=$(echo "$body" | jq -r '.status')
if [ "$STATUS" == "completed" ]; then
  echo -e "${GREEN}  ✓ Status correctement mis à jour: $STATUS${NC}"
else
  echo -e "${RED}  ✗ Status incorrect: $STATUS (attendu: completed)${NC}"
fi
echo ""

test_endpoint "GET - Liste finale des rendez-vous" "$BASE_URL/api/appointments"
COMPLETED_COUNT=$(echo "$body" | jq '[.[] | select(.status=="completed")] | length')
echo "Rendez-vous terminés: $COMPLETED_COUNT"
echo ""

# ══════════════════════════════════════════════════════════════════
# RÉSUMÉ
# ══════════════════════════════════════════════════════════════════
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                      RÉSUMÉ DES TESTS                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Tests réussis:  ${GREEN}$TESTS_PASSED${NC}"
echo "  Tests échoués:  ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✓ TOUS LES TESTS APPOINTMENT SONT PASSÉS !                      ${NC}"
  echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
  exit 0
else
  echo -e "${RED}══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}  ✗ CERTAINS TESTS ONT ÉCHOUÉ                                     ${NC}"
  echo -e "${RED}══════════════════════════════════════════════════════════════════${NC}"
  exit 1
fi

