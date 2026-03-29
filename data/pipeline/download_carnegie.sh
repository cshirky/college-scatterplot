#!/bin/bash
# Download supplemental IPEDS data for the Carnegie 2025 pipeline.
# The Carnegie 2025 xlsx files (2025-Public-Data-File.xlsx and
# 2025-SAEC-Public-Data-File.xlsx) must be placed in the project root.
set -euo pipefail

RAW_DIR="$(dirname "$0")/../raw"
mkdir -p "$RAW_DIR"

BASE_URL="https://nces.ed.gov/ipeds/datacenter/data"

# Institution directory: try 2024 first (updated info), fall back to 2023
if [ ! -f "$RAW_DIR/HD2024.csv" ]; then
  echo "Downloading HD2024..."
  if curl -sf -L -o "$RAW_DIR/HD2024.zip" "$BASE_URL/HD2024.zip" 2>/dev/null; then
    unzip -o "$RAW_DIR/HD2024.zip" -d "$RAW_DIR"
  else
    echo "  HD2024 not available, downloading HD2023..."
    curl -sL -o "$RAW_DIR/HD2023.zip" "$BASE_URL/HD2023.zip"
    unzip -o "$RAW_DIR/HD2023.zip" -d "$RAW_DIR"
  fi
fi

# Core IPEDS files for supplemental metrics
IPEDS_FILES=(
  "drvadm2023"   # Admission rates (0-100 % scale)
  "drvgr2023"    # 6-year graduation rates
  "drvef2023"    # Enrollment & demographics
  "IC2023_AY"    # Tuition (in-state / out-of-state)
  "ADM2023"      # SAT/ACT scores, yield rate
  "SFA2223"      # Pell grant percentage
  "C2023_A"      # CIP completions (bachelor's degrees by field)
)

for f in "${IPEDS_FILES[@]}"; do
  LOWER="${f,,}"
  # Check for both lower-case and original-case .csv
  if [ -f "$RAW_DIR/${LOWER}.csv" ] || [ -f "$RAW_DIR/${f}.csv" ] || [ -f "$RAW_DIR/${LOWER}.csv.gz" ]; then
    echo "Already have $f, skipping..."
    continue
  fi
  echo "Downloading $f..."
  curl -sL -o "$RAW_DIR/${f}.zip" "$BASE_URL/${f}.zip"
  unzip -o "$RAW_DIR/${f}.zip" -d "$RAW_DIR"
done

# IC2023 for religious affiliation (try RV variant first)
if [ ! -f "$RAW_DIR/IC2023_RV.csv" ] && [ ! -f "$RAW_DIR/IC2023.csv" ]; then
  echo "Downloading IC2023..."
  curl -sL -o "$RAW_DIR/IC2023.zip" "$BASE_URL/IC2023.zip" || true
  if [ -f "$RAW_DIR/IC2023.zip" ]; then
    unzip -o "$RAW_DIR/IC2023.zip" -d "$RAW_DIR"
  fi
fi

echo "Done. Files in $RAW_DIR:"
ls "$RAW_DIR"/*.csv 2>/dev/null || true
ls "$RAW_DIR"/*.csv.gz 2>/dev/null || true
