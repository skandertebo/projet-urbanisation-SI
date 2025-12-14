#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         NovaCare - Tests Insurance Service                     ║"
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

BASE_URL="http://localhost:3001"

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
# CONTRACTS CRUD
# ═══════════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  CONTRACTS - CRUD Operations                                     ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# GET - List all contracts
run_test "GET - Liste des contrats" "$BASE_URL/api/contracts"

# GET - Filter by patient CIN
run_test "GET - Contrats pour patient 12345678" "$BASE_URL/api/contracts?patientCin=12345678"

# POST - Create new contract
NEW_CONTRACT='{
  "patientCin": "87654321",
  "patientName": "Fatma Ben Ali",
  "insurerName": "CNAM Tunisie",
  "policyNumber": "CNAM-TEST-'$(date +%s)'",
  "coverageType": "basic",
  "coveragePercentage": 60,
  "maxAnnualAmount": 2000,
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}'

run_test "POST - Créer un nouveau contrat" "$BASE_URL/api/contracts" "POST" "$NEW_CONTRACT" "201"

# Capture contract ID for later tests
CONTRACT_ID=$(curl -s "$BASE_URL/api/contracts?patientCin=87654321" | jq -r '.[0].id')
echo "Contract ID capturé: $CONTRACT_ID"
echo ""

# GET - Get specific contract
if [ "$CONTRACT_ID" != "null" ] && [ -n "$CONTRACT_ID" ]; then
    run_test "GET - Détails du contrat" "$BASE_URL/api/contracts/$CONTRACT_ID"

    # PUT - Update contract
    UPDATE_CONTRACT='{
      "coveragePercentage": 70,
      "maxAnnualAmount": 2500
    }'
    run_test "PUT - Modifier le contrat" "$BASE_URL/api/contracts/$CONTRACT_ID" "PUT" "$UPDATE_CONTRACT"
fi

# ═══════════════════════════════════════════════════════════════════════
# COVERAGE VERIFICATION
# ═══════════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  COVERAGE - Vérification de couverture                           ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

run_test "Vérifier couverture patient 12345678 (montant: 500 TND)" \
    "$BASE_URL/api/coverage/verify?patientCin=12345678&amount=500"

run_test "Vérifier couverture patient sans assurance" \
    "$BASE_URL/api/coverage/verify?patientCin=99999999&amount=200"

# ═══════════════════════════════════════════════════════════════════════
# CLAIMS CRUD
# ═══════════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  CLAIMS - Réclamations de remboursement                          ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# Get a contract ID for claims
CLAIM_CONTRACT_ID=$(curl -s "$BASE_URL/api/contracts?patientCin=12345678&status=active" | jq -r '.[0].id')
echo "Contract ID pour réclamation: $CLAIM_CONTRACT_ID"
echo ""

if [ "$CLAIM_CONTRACT_ID" != "null" ] && [ -n "$CLAIM_CONTRACT_ID" ]; then
    # POST - Submit claim
    NEW_CLAIM="{
      \"contractId\": \"$CLAIM_CONTRACT_ID\",
      \"invoiceNumber\": \"INV-TEST-$(date +%s)\",
      \"totalAmount\": 430,
      \"acts\": [
        {\"code\": \"CARD001\", \"description\": \"Consultation cardiologie\", \"price\": 150},
        {\"code\": \"ECG001\", \"description\": \"Électrocardiogramme\", \"price\": 80},
        {\"code\": \"ECHO001\", \"description\": \"Échocardiographie\", \"price\": 200}
      ]
    }"

    run_test "POST - Soumettre une réclamation" "$BASE_URL/api/claims" "POST" "$NEW_CLAIM" "201"

    # GET - List claims
    run_test "GET - Liste des réclamations" "$BASE_URL/api/claims"

    # Get claim ID for processing
    CLAIM_ID=$(curl -s "$BASE_URL/api/claims?status=pending" | jq -r '.[0].id')
    echo "Claim ID: $CLAIM_ID"
    echo ""

    if [ "$CLAIM_ID" != "null" ] && [ -n "$CLAIM_ID" ]; then
        # PUT - Process claim (approve)
        APPROVE_CLAIM='{"action": "approve"}'
        run_test "PUT - Approuver la réclamation" "$BASE_URL/api/claims/$CLAIM_ID/process" "PUT" "$APPROVE_CLAIM"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════
# CLEANUP (optional)
# ═══════════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  CLEANUP - Nettoyage des données de test                         ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$CONTRACT_ID" != "null" ] && [ -n "$CONTRACT_ID" ]; then
    run_test "DELETE - Supprimer le contrat de test" "$BASE_URL/api/contracts/$CONTRACT_ID" "DELETE"
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
    echo -e "${GREEN}  ✓ TOUS LES TESTS INSURANCE SONT PASSÉS !                        ${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ✗ $TESTS_FAILED TEST(S) EN ÉCHEC                                 ${NC}"
    echo -e "${RED}══════════════════════════════════════════════════════════════════${NC}"
    exit 1
fi

