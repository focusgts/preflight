#!/usr/bin/env bash
set -euo pipefail

# Black Hole for Adobe Marketing Cloud — Seed demo data
# Usage: bash scripts/seed.sh [BASE_URL]
#
# Populates the running instance with sample migrations, assessments,
# and connectors so you can explore the UI immediately.

BASE_URL="${1:-http://localhost:3000}"
API="$BASE_URL/api"

echo "Seeding demo data against $BASE_URL ..."
echo

# ---------- Helper ----------
post() {
  local endpoint="$1"
  local payload="$2"
  local label="$3"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API/$endpoint" \
    -H "Content-Type: application/json" \
    -d "$payload")

  if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "[ok]  $label"
  else
    echo "[FAIL] $label (HTTP $HTTP_CODE)"
  fi
}

# ---------- Connectors ----------
echo "--- Connectors ---"

post "connectors" '{
  "name": "Adobe Analytics Production",
  "type": "adobe-analytics",
  "config": {
    "orgId": "DEMO_ORG_001@AdobeOrg",
    "reportSuiteId": "blackhole.prod",
    "environment": "production"
  }
}' "Adobe Analytics connector"

post "connectors" '{
  "name": "Adobe Campaign Standard",
  "type": "adobe-campaign",
  "config": {
    "orgId": "DEMO_ORG_001@AdobeOrg",
    "tenant": "blackhole-demo",
    "environment": "staging"
  }
}' "Adobe Campaign connector"

post "connectors" '{
  "name": "Adobe Target",
  "type": "adobe-target",
  "config": {
    "orgId": "DEMO_ORG_001@AdobeOrg",
    "clientCode": "blackholedemo",
    "environment": "production"
  }
}' "Adobe Target connector"

echo

# ---------- Migrations ----------
echo "--- Migrations ---"

post "migrations" '{
  "name": "Analytics to Customer Journey Analytics",
  "sourceSystem": "adobe-analytics",
  "targetSystem": "customer-journey-analytics",
  "description": "Migrate legacy Adobe Analytics implementation to CJA with XDM schema mapping.",
  "priority": "high"
}' "Analytics -> CJA migration"

post "migrations" '{
  "name": "Campaign Classic to Campaign Standard",
  "sourceSystem": "campaign-classic",
  "targetSystem": "campaign-standard",
  "description": "Modernise email workflows from Campaign Classic v7 to Campaign Standard.",
  "priority": "medium"
}' "Campaign Classic -> Standard migration"

post "migrations" '{
  "name": "Target Classic to Target Premium",
  "sourceSystem": "adobe-target-classic",
  "targetSystem": "adobe-target-premium",
  "description": "Upgrade personalisation rules and audiences to Target Premium with Automated Personalization.",
  "priority": "low"
}' "Target Classic -> Premium migration"

echo

# ---------- Assessments ----------
echo "--- Assessments ---"

post "assessments" '{
  "migrationId": "analytics-cja",
  "type": "readiness",
  "scope": ["data-layer", "schemas", "segments", "calculated-metrics"],
  "notes": "Initial readiness check before CJA migration kick-off."
}' "CJA readiness assessment"

post "assessments" '{
  "migrationId": "campaign-modernise",
  "type": "complexity",
  "scope": ["workflows", "delivery-templates", "audiences"],
  "notes": "Evaluate complexity of Campaign Classic workflow migration."
}' "Campaign complexity assessment"

echo
echo "================================================"
echo "  Seed complete. Visit $BASE_URL to explore."
echo "================================================"
