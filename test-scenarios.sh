#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         NovaCare POC - Tests des Scénarios Métier              ║"
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

# Fonction de test
run_test() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=$4
    local expected_code=${5:-200}

    echo -e "${YELLOW}► $name${NC}"

    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json; charset=utf-8" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "$expected_code" ]; then
        echo -e "${GREEN}  ✓ HTTP $http_code (attendu: $expected_code)${NC}"
        echo "$body" | node -e "try { const input = fs.readFileSync(0, 'utf-8'); const json = JSON.parse(input); console.log(JSON.stringify(json, null, 2)); } catch (e) { console.log(input); }" 2>/dev/null | head -15 || echo "  $body" | head -3
        ((TESTS_PASSED++))
    else
        echo -e "${RED}  ✗ HTTP $http_code (attendu: $expected_code)${NC}"
        echo "  $body"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# PROCESSUS A : ADMISSION PATIENT & SYNCHRONISATION
# ═══════════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PROCESSUS A : ADMISSION PATIENT (CHECK-IN)                      ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# --- Scénario A1: Patient existant au siège ---
echo -e "${BLUE}--- Scénario A1: Check-in patient existant au siège (CIN: 12345678) ---${NC}"
echo ""
echo "Flux: Cardio-Service → ESB-Local → (local 404) → ESB-Central → Patient-Core"
echo "      → Patient trouvé → Sync locale → Retour patient"
echo ""

CHECKIN_EXISTING='{
  "cin": "12345678"
}'

run_test "A1.1 - Cardio-Service: Check-in patient existant" \
    "http://localhost:5001/api/checkin" "POST" "$CHECKIN_EXISTING"

run_test "A1.2 - Vérification: Patient synchronisé localement" \
    "http://localhost:5001/api/local_patient/cin/12345678"

# --- Scénario A2: Patient inconnu partout ---
echo -e "${BLUE}--- Scénario A2: Check-in patient inconnu (CIN seul) ---${NC}"
echo ""
echo "Flux: Cardio-Service → ESB-Local → (local 404) → ESB-Central → (siège 404)"
echo "      → 404 + demande de données pour création"
echo ""

# Générer un CIN unique pour A2
UNKNOWN_CIN="8$(date +%s | tail -c 8)"
CHECKIN_UNKNOWN="{
  \"cin\": \"$UNKNOWN_CIN\"
}"

run_test "A2.1 - Cardio-Service: Check-in patient inconnu (retourne 404 + champs requis)" \
    "http://localhost:5001/api/checkin" "POST" "$CHECKIN_UNKNOWN" "404"

# --- Scénario A3: Nouveau patient - Création complète ---
echo -e "${BLUE}--- Scénario A3: Check-in nouveau patient (création + sync vers siège) ---${NC}"
echo ""
echo "Flux: Cardio-Service → ESB-Local → (local 404) → ESB-Central → (siège 404)"
echo "      → Création locale → Sync vers siège via ESB → Patient check-in"
echo ""

# Générer un CIN unique
UNIQUE_CIN="9$(date +%s | tail -c 8)"
echo "CIN généré pour le test: $UNIQUE_CIN"

NEW_PATIENT_CHECKIN="{
  \"cin\": \"$UNIQUE_CIN\",
  \"firstName\": \"Sami\",
  \"lastName\": \"Trabelsi\",
  \"dateOfBirth\": \"1995-03-22\",
  \"email\": \"sami.trabelsi@example.com\",
  \"phone\": \"+216 99 999 999\",
  \"address\": \"Monastir, Tunisie\",
  \"allergies\": [\"Latex\"],
  \"medicalHistory\": [\"Migraines\"]
}"

run_test "A3.1 - Cardio-Service: Check-in nouveau patient (création + sync)" \
    "http://localhost:5001/api/checkin" "POST" "$NEW_PATIENT_CHECKIN" "201"

run_test "A3.2 - Vérification: Patient existe localement" \
    "http://localhost:5001/api/local_patient/cin/$UNIQUE_CIN"

run_test "A3.3 - Vérification: Patient synchronisé au siège" \
    "http://localhost:8080/api/patients/cin/$UNIQUE_CIN"

# ═══════════════════════════════════════════════════════════════════════
# PROCESSUS B : PARCOURS SOIN VERS FACTURATION
# ═══════════════════════════════════════════════════════════════════════
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PROCESSUS B : PARCOURS SOIN VERS FACTURATION                   ${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# --- Récupération de l'ID patient réel ---
echo -e "${BLUE}--- Récupération de l'ID patient Ahmed Tounsi ---${NC}"
PATIENT_RESPONSE=$(curl -s "http://localhost:8080/api/patients/cin/12345678")
PATIENT_ID=$(echo "$PATIENT_RESPONSE" | node -e "const fs = require('fs'); try { const input = fs.readFileSync(0, 'utf-8'); const json = JSON.parse(input); console.log(json.id); } catch (e) { console.error(e); }")
echo "Patient ID récupéré: $PATIENT_ID"
echo ""

# --- Scénario B1: Consultation cardiaque complète ---
echo -e "${BLUE}--- Scénario B1: Consultation cardiaque ---${NC}"
echo ""

CONSULTATION="{
  \"patientId\": \"$PATIENT_ID\",
  \"patientCin\": \"12345678\",
  \"doctorId\": \"DR-CARDIO-001\",
  \"doctorName\": \"Dr. Karim Mansour\",
  \"diagnosis\": \"Hypertension arterielle legere - Recommandation suivi regulier\",
  \"prescription\": [\"Amlodipine 5mg - 1x/jour\", \"Regime hyposode\"],
  \"notes\": \"Patient stable, controle dans 3 mois\",
  \"acts\": [
    {\"code\": \"CARD001\", \"description\": \"Consultation cardiologie specialisee\", \"price\": 150},
    {\"code\": \"ECG001\", \"description\": \"Electrocardiogramme 12 derivations\", \"price\": 80},
    {\"code\": \"ECHO001\", \"description\": \"Echocardiographie transthoracique\", \"price\": 200}
  ]
}"

run_test "B1.1 - Cardio-Service: Créer consultation" \
    "http://localhost:5001/api/consultation" "POST" "$CONSULTATION" "201"

# --- Scénario B2: Génération de facture ---
echo -e "${BLUE}--- Scénario B2: Génération de facture ---${NC}"
echo ""

INVOICE_REQUEST="{
  \"patientId\": \"$PATIENT_ID\",
  \"patientName\": \"Ahmed Tounsi\",
  \"consultationId\": \"1\",
  \"acts\": [
    {\"code\": \"CARD001\", \"description\": \"Consultation cardiologie specialisee\", \"price\": 150},
    {\"code\": \"ECG001\", \"description\": \"Electrocardiogramme 12 derivations\", \"price\": 80},
    {\"code\": \"ECHO001\", \"description\": \"Echocardiographie transthoracique\", \"price\": 200}
  ]
}"

run_test "B2.1 - Billing-Service: Générer facture" \
    "http://localhost:3000/api/billing/generate" "POST" "$INVOICE_REQUEST" "201"

# --- Scénario B3: Notification au patient ---
echo -e "${BLUE}--- Scénario B3: Notification au patient ---${NC}"
echo ""

NOTIFICATION='{
  "to": "ahmed.tounsi@example.com",
  "subject": "NovaCare - Votre facture de consultation",
  "body": "Bonjour Ahmed Tounsi,\n\nVotre facture pour la consultation du jour est disponible.\nMontant total: 430 TND\n\nMerci de votre confiance.\nNovaCare Medical Group",
  "type": "email"
}'

run_test "B3.1 - Notification-Service: Envoyer notification email" \
    "http://localhost:8083/api/notifications/send" "POST" "$NOTIFICATION"

# --- Scénario B4: Flux ESB Central ---
echo -e "${BLUE}--- Scénario B4: Vérification flux ESB Central ---${NC}"
echo ""

run_test "B4.1 - ESB Central: Recherche patient" \
    "http://localhost:8081/api/patient/search?cin=12345678"

ESB_BILLING="{
  \"patientId\": \"$PATIENT_ID\",
  \"patientName\": \"Ahmed Tounsi\",
  \"consultationId\": \"2\",
  \"acts\": [
    {\"code\": \"CONS001\", \"description\": \"Consultation de suivi\", \"price\": 80}
  ]
}"

run_test "B4.2 - ESB Central: Facturation via médiation" \
    "http://localhost:8081/api/billing/generate" "POST" "$ESB_BILLING"

# ═══════════════════════════════════════════════════════════════════════
# RÉSUMÉ DES TESTS
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
    echo -e "${GREEN}  ✓ TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS !                      ${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ✗ $TESTS_FAILED TEST(S) EN ÉCHEC                                 ${NC}"
    echo -e "${RED}══════════════════════════════════════════════════════════════════${NC}"
    exit 1
fi
