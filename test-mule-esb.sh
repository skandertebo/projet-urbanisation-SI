#!/bin/bash

echo "=== Testing MuleSoft ESB Integration ==="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to check health
check_health() {
    local name=$1
    local url=$2
    echo -n "Checking $name... "
    if curl -s "$url" | grep -q "UP"; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        echo "  Endpoint: $url"
        echo "  Ensure the Mule app is deployed and running."
    fi
}

# 1. Health Checks
echo -e "${YELLOW}1. Health Checks${NC}"
check_health "ESB Central" "http://localhost:8081/actuator/health"
check_health "ESB Local" "http://localhost:8082/actuator/health"
echo ""

# 2. Test ESB Central - Search Patient
echo -e "${YELLOW}2. ESB Central: Search Patient (CIN: 12345678)${NC}"
response=$(curl -s "http://localhost:8081/api/patient/search?cin=12345678")
if echo "$response" | grep -q "Ahmed"; then
    echo -e "${GREEN}✓ Success${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
else
    echo -e "${RED}✗ Failed${NC}"
    echo "Response: $response"
fi
echo ""

# 3. Test ESB Central - Create Patient
echo -e "${YELLOW}3. ESB Central: Create Patient${NC}"
new_patient='{
    "firstName": "Mule",
    "lastName": "Test",
    "cin": "99999999",
    "dateOfBirth": "1990-01-01",
    "address": "MuleSoft Lane",
    "phone": "123456789"
}'
response=$(curl -s -X POST "http://localhost:8081/api/patient/create" \
    -H "Content-Type: application/json" \
    -d "$new_patient")
if echo "$response" | grep -q "id"; then
    echo -e "${GREEN}✓ Success${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
else
    echo -e "${RED}✗ Failed${NC}"
    echo "Response: $response"
fi
echo ""

# 4. Test ESB Local - Check-in (Sync Flow)
echo -e "${YELLOW}4. ESB Local: Check-in (Sync Flow)${NC}"
# We use the CIN of the patient we just created to test the sync
cin="99999999"
echo "Attempting check-in for CIN: $cin"
response=$(curl -s "http://localhost:8082/api/checkin?cin=$cin")
if echo "$response" | grep -q "Mule"; then
    echo -e "${GREEN}✓ Success (Patient Synced)${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
else
    echo -e "${RED}✗ Failed${NC}"
    echo "Response: $response"
fi
echo ""

echo "=== Tests Completed ==="
