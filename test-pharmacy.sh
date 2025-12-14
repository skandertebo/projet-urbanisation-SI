#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         NovaCare - Tests Pharmacy Service                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Compteurs
TESTS_PASSED=0
TESTS_FAILED=0

BASE_URL="http://localhost:3002"

# Fonction de test
run_test() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=$4
    local expected_code=${5:-200}
    
    echo -e "${YELLOW}► $name${NC}"
    
    if [ "$method" = "POST" ] || [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$url" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_code" ]; then
        echo -e "${GREEN}  ✓ HTTP $http_code (attendu: $expected_code)${NC}"
        echo "$body" | jq '.' 2>/dev/null | head -12 || echo "  $body" | head -3
        ((TESTS_PASSED++))
    else
        echo -e "${RED}  ✗ HTTP $http_code (attendu: $expected_code)${NC}"
        echo "  $body"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  HEALTH CHECK                                                    ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

run_test "Health Check" "$BASE_URL/health"

# ═══════════════════════════════════════════════════════════════════════
# MEDICATIONS (INVENTORY) CRUD
# ═══════════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  MEDICATIONS - Gestion de l'inventaire                           ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# GET - List all medications
run_test "GET - Liste des médicaments" "$BASE_URL/api/medications"

# GET - Search by name
run_test "GET - Recherche 'Aspirine'" "$BASE_URL/api/medications?search=Aspirine"

# GET - Filter by category
run_test "GET - Médicaments cardiovasculaires" "$BASE_URL/api/medications?category=cardiovascular"

# POST - Create new medication
NEW_MEDICATION='{
  "name": "Doliprane",
  "genericName": "Paracetamol",
  "dosage": "1000mg",
  "form": "tablet",
  "manufacturer": "Sanofi",
  "category": "analgesic",
  "requiresPrescription": 0,
  "unitPrice": 1.5,
  "stockQuantity": 500,
  "minStockLevel": 50,
  "expirationDate": "2025-12-31"
}'

run_test "POST - Ajouter un médicament" "$BASE_URL/api/medications" "POST" "$NEW_MEDICATION" "201"

# Get medication ID
MED_ID=$(curl -s "$BASE_URL/api/medications?search=Doliprane" | jq -r '.[0].id')
echo "Medication ID: $MED_ID"
echo ""

if [ "$MED_ID" != "null" ] && [ -n "$MED_ID" ]; then
    # GET - Get specific medication
    run_test "GET - Détails du médicament" "$BASE_URL/api/medications/$MED_ID"

    # PUT - Update medication
    UPDATE_MED='{"unitPrice": 1.8, "stockQuantity": 600}'
    run_test "PUT - Modifier le médicament" "$BASE_URL/api/medications/$MED_ID" "PUT" "$UPDATE_MED"

    # POST - Adjust stock (add)
    STOCK_ADD='{"adjustment": 100, "reason": "Réception commande"}'
    run_test "POST - Ajouter au stock (+100)" "$BASE_URL/api/medications/$MED_ID/stock" "POST" "$STOCK_ADD"

    # POST - Adjust stock (remove)
    STOCK_REMOVE='{"adjustment": -50, "reason": "Correction inventaire"}'
    run_test "POST - Retirer du stock (-50)" "$BASE_URL/api/medications/$MED_ID/stock" "POST" "$STOCK_REMOVE"
fi

# ═══════════════════════════════════════════════════════════════════════
# PRESCRIPTIONS CRUD
# ═══════════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PRESCRIPTIONS - Gestion des ordonnances                         ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Get a medication ID for prescription
AMLODIPINE_ID=$(curl -s "$BASE_URL/api/medications?search=Amlodipine" | jq -r '.[0].id')
METFORMINE_ID=$(curl -s "$BASE_URL/api/medications?search=Metformine" | jq -r '.[0].id')
echo "Amlodipine ID: $AMLODIPINE_ID"
echo "Metformine ID: $METFORMINE_ID"
echo ""

# POST - Create prescription
NEW_PRESCRIPTION="{
  \"patientCin\": \"12345678\",
  \"patientName\": \"Ahmed Tounsi\",
  \"doctorId\": \"DR-CARDIO-001\",
  \"doctorName\": \"Dr. Karim Mansour\",
  \"consultationId\": \"CONS-001\",
  \"notes\": \"Traitement hypertension et diabète\",
  \"items\": [
    {
      \"medicationId\": \"$AMLODIPINE_ID\",
      \"medicationName\": \"Amlodipine 5mg\",
      \"dosage\": \"5mg\",
      \"quantity\": 30,
      \"frequency\": \"1x par jour\",
      \"duration\": \"30 jours\",
      \"instructions\": \"Prendre le matin avec un verre d'eau\"
    },
    {
      \"medicationId\": \"$METFORMINE_ID\",
      \"medicationName\": \"Metformine 500mg\",
      \"dosage\": \"500mg\",
      \"quantity\": 60,
      \"frequency\": \"2x par jour\",
      \"duration\": \"30 jours\",
      \"instructions\": \"Prendre pendant les repas\"
    }
  ]
}"

run_test "POST - Créer une ordonnance" "$BASE_URL/api/prescriptions" "POST" "$NEW_PRESCRIPTION" "201"

# GET - List prescriptions
run_test "GET - Liste des ordonnances" "$BASE_URL/api/prescriptions"

# GET - Filter by patient
run_test "GET - Ordonnances patient 12345678" "$BASE_URL/api/prescriptions?patientCin=12345678"

# Get prescription ID
PRESCRIPTION_ID=$(curl -s "$BASE_URL/api/prescriptions?patientCin=12345678&status=active" | jq -r '.[0].id')
echo "Prescription ID: $PRESCRIPTION_ID"
echo ""

if [ "$PRESCRIPTION_ID" != "null" ] && [ -n "$PRESCRIPTION_ID" ]; then
    run_test "GET - Détails de l'ordonnance" "$BASE_URL/api/prescriptions/$PRESCRIPTION_ID"
fi

# ═══════════════════════════════════════════════════════════════════════
# DISPENSATIONS (SALES)
# ═══════════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DISPENSATIONS - Ventes et délivrance                            ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Get medication IDs for dispensation (using generic names without accents)
PARACETAMOL_ID=$(curl -s "$BASE_URL/api/medications?search=Paracetamol" | jq -r '.[0].id')
IBUPROFENE_ID=$(curl -s "$BASE_URL/api/medications?search=Ibuprofen" | jq -r '.[0].id')
echo "Paracetamol ID: $PARACETAMOL_ID"
echo "Ibuprofen ID: $IBUPROFENE_ID"
echo ""

# POST - Create dispensation (OTC sale without prescription)
OTC_SALE="{
  \"patientCin\": \"99999999\",
  \"pharmacistId\": \"PHARM-001\",
  \"paymentMethod\": \"cash\",
  \"notes\": \"Vente libre sans ordonnance\",
  \"items\": [
    {\"medicationId\": \"$PARACETAMOL_ID\", \"quantity\": 2},
    {\"medicationId\": \"$IBUPROFENE_ID\", \"quantity\": 1}
  ]
}"

run_test "POST - Vente libre (sans ordonnance)" "$BASE_URL/api/dispensations" "POST" "$OTC_SALE" "201"

# POST - Dispensation with prescription
if [ "$PRESCRIPTION_ID" != "null" ] && [ -n "$PRESCRIPTION_ID" ]; then
    PRESCRIPTION_SALE="{
      \"prescriptionId\": \"$PRESCRIPTION_ID\",
      \"patientCin\": \"12345678\",
      \"pharmacistId\": \"PHARM-001\",
      \"paymentMethod\": \"card\",
      \"items\": [
        {\"medicationId\": \"$AMLODIPINE_ID\", \"quantity\": 30},
        {\"medicationId\": \"$METFORMINE_ID\", \"quantity\": 60}
      ]
    }"

    run_test "POST - Délivrance sur ordonnance" "$BASE_URL/api/dispensations" "POST" "$PRESCRIPTION_SALE" "201"
fi

# GET - List dispensations
run_test "GET - Liste des ventes" "$BASE_URL/api/dispensations"

# GET - Filter by patient
run_test "GET - Ventes patient 12345678" "$BASE_URL/api/dispensations?patientCin=12345678"

# ═══════════════════════════════════════════════════════════════════════
# REPORTS
# ═══════════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  REPORTS - Rapports                                              ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

run_test "GET - Rapport stock bas" "$BASE_URL/api/reports/low-stock"

run_test "GET - Médicaments bientôt périmés" "$BASE_URL/api/reports/expiring"

# ═══════════════════════════════════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  CLEANUP - Nettoyage des données de test                         ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$MED_ID" != "null" ] && [ -n "$MED_ID" ]; then
    run_test "DELETE - Supprimer le médicament de test" "$BASE_URL/api/medications/$MED_ID" "DELETE"
fi

# ═══════════════════════════════════════════════════════════════════════
# RÉSUMÉ
# ═══════════════════════════════════════════════════════════════════════
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                      RÉSUMÉ DES TESTS                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "  Tests réussis:  ${GREEN}$TESTS_PASSED${NC}"
echo -e "  Tests échoués:  ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✓ TOUS LES TESTS PHARMACY SONT PASSÉS !                         ${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ✗ $TESTS_FAILED TEST(S) EN ÉCHEC                                 ${NC}"
    echo -e "${RED}══════════════════════════════════════════════════════════════════${NC}"
    exit 1
fi

