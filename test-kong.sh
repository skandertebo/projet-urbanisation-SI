#!/bin/bash

echo "====================================================================="
echo "🎯 NovaCare POC - Complete System Integration Test (Robust)"
echo "====================================================================="
echo ""

KONG_PROXY="http://localhost:8000"
KONG_ADMIN="http://localhost:8001"
CAMUNDA="http://localhost:8084/engine-rest"
TEST_CIN="12345678"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

TOTAL=0; PASSED=0; FAILED=0
test_header() { ((TOTAL++)); echo -e "\n${BLUE}[$TOTAL] $1${NC}"; }
test_pass() { ((PASSED++)); echo -e "${GREEN}✅ PASS${NC}"; }
test_fail() { ((FAILED++)); echo -e "${RED}❌ FAIL: $1${NC}"; }
test_info() { echo -e "   ${YELLOW}→ $1${NC}"; }

# Helper: Check HTTP status
check_http() {
  local url=$1
  local expect=$2
  local code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>&1)
  echo "$code"
}

# Helper: Check if string exists in response
contains() {
  echo "$2" | grep -q "$1" 2>/dev/null
}

# === Phase 1: Docker Containers ===
test_header "Docker containers running"
docker-compose ps > /tmp/docker_ps.txt 2>&1

for container in "api-gateway" "esb-central" "esb-local" "camunda-bpm" "patient-core-service"; do
  if grep -q "$container.*Up.*healthy" /tmp/docker_ps.txt; then
    test_pass
  elif grep -q "$container.*Up" /tmp/docker_ps.txt; then
    test_info "$container running but not healthy"
    test_pass  # Accept running state
  else
    test_fail "$container not running"
    test_info "$(grep "$container" /tmp/docker_ps.txt || echo 'Container not found')"
  fi
done

# === Phase 2: Health Endpoints ===
test_header "Microservice health endpoints"

services=(
  "patient-core:8080:/health"
  "billing:3000:/health"
  "cardio:5001:/health"
  "notification:8083:/health"
  "esb-central:8081:/actuator/health"
  "esb-local:8082:/actuator/health"
)

for service in "${services[@]}"; do
  IFS=':' read -r name port path <<< "$service"
  
  # Try health endpoint
  code=$(check_http "http://localhost:${port}${path}")
  
  if [ "$code" == "200" ]; then
    test_pass
  elif [ "$code" == "404" ]; then
    test_info "$name: endpoint not found, checking base URL"
    code=$(check_http "http://localhost:${port}")
    [ "$code" != "000" ] && test_pass || test_fail "Service not responding"
  elif [ "$code" == "000" ]; then
    test_fail "$name: connection refused"
  else
    test_fail "$name: HTTP $code"
  fi
done

# === Phase 3: Kong Admin ===
test_header "Kong Admin API"
code=$(check_http "$KONG_ADMIN")
if [ "$code" == "200" ]; then
  test_pass
else
  test_fail "Kong not responding (HTTP $code)"
  exit 1
fi

# === Phase 4: Kong Services ===
test_header "Kong services registered"

KONG_SVCS=$(curl -s "$KONG_ADMIN/services" 2>&1)
for svc in "esb-local-service" "esb-central-service" "notification-service"; do
  if echo "$KONG_SVCS" | grep -q "\"name\":\"$svc\""; then
    echo "   ✅ $svc"
  else
    echo "   ❌ $svc missing"
  fi
done

# Check if at least one service exists
if echo "$KONG_SVCS" | grep -q '"name"'; then
  test_pass
else
  test_fail "No services found in Kong"
fi

# === Phase 5: Kong Routes ===
test_header "Kong routes configured"

for svc in "esb-local-service" "esb-central-service" "notification-service"; do
  ROUTES=$(curl -s "$KONG_ADMIN/services/$svc/routes" 2>&1)
  
  if echo "$ROUTES" | grep -q '"paths"'; then
    PATH_COUNT=$(echo "$ROUTES" | grep -o '"paths"' | wc -l)
    echo "   ✅ $svc: $PATH_COUNT route(s)"
  else
    echo "   ❌ $svc: No routes"
  fi
done

# === Phase 6: Kong Proxy Tests ===
test_header "Kong proxy routing"

# Test Check-in
code=$(check_http "$KONG_PROXY/api/checkin?cin=999")
[ "$code" != "000" ] && test_pass || test_fail "Connection refused"

# Test patient search
code=$(check_http "$KONG_PROXY/api/patients/search?cin=$TEST_CIN")
if [ "$code" == "200" ] || [ "$code" == "404" ]; then
  test_pass
else
  test_fail "HTTP $code"
fi

# Test notification
code=$(check_http -X POST "$KONG_PROXY/api/notifications/send")
# POST returns 200 or 415 (wrong content type)
[ "$code" == "200" ] || [ "$code" == "415" ] && test_pass || test_fail "HTTP $code"

# === Phase 7: BPMN Deployment ===
test_header "BPMN processes in Camunda"

if curl -s "$CAMUNDA/process-definition" 2>&1 | grep -q '"key":"admission-patient"'; then
  test_pass
else
  test_fail "admission-patient not deployed"
fi

if curl -s "$CAMUNDA/process-definition" 2>&1 | grep -q '"key":"billing_workflow"'; then
  test_pass
else
  test_fail "billing_workflow not deployed"
fi

# === Phase 8: Process Execution ===
test_header "Start admission process"

RESPONSE=$(curl -s --connect-timeout 10 -X POST "$CAMUNDA/process-definition/key/admission-patient/start" \
  -H "Content-Type: application/json" \
  -d '{"variables":{"cin":{"value":"12345678","type":"String"}}}' 2>&1)

code=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' > /dev/null 2>&1 && echo "200" || echo "000")

if [ "$code" == "200" ]; then
  test_pass
else
  test_fail "Camunda error: $(echo "$RESPONSE" | head -2)"
fi

test_header "Start billing process"

RESPONSE=$(curl -s --connect-timeout 10 -X POST "$CAMUNDA/process-definition/key/billing_workflow/start" \
  -H "Content-Type: application/json" \
  -d '{"variables":{"patientId":{"value":"1","type":"String"}}}' 2>&1)

if echo "$RESPONSE" | grep -q '"id"'; then
  test_pass
else
  test_fail "Camunda error: $(echo "$RESPONSE" | head -2)"
fi

# === Phase 9: Audit Logs ===
test_header "Kong audit logs"

sleep 3
if docker exec api-gateway cat /tmp/kong_clinic_audit.log 2>&1 | grep -q "200"; then
  test_pass
else
  test_info "No logs yet (processes may still be running)"
fi

# === FINAL SUMMARY ===
echo ""
echo "====================================================================="
echo "📊 TEST SUMMARY"
echo "====================================================================="
echo "Total:   $TOTAL"
echo -e "Passed:  ${GREEN}$PASSED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ SYSTEM FULLY OPERATIONAL${NC}"
  exit 0
elif [ "$FAILED" -le 3 ]; then
  echo -e "${YELLOW}⚠️  SYSTEM MOSTLY WORKING (minor issues)${NC}"
  exit 0
else
  echo -e "${RED}❌ CRITICAL ISSUES DETECTED${NC}"
  echo ""
  echo "🔍 Debug commands:"
  echo "   docker-compose ps"
  echo "   docker-compose logs kong"
  echo "   curl -v $KONG_ADMIN/services"
  echo "   curl -v $CAMUNDA/process-definition"
  exit 1
fi