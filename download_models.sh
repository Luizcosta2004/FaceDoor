#!/usr/bin/env bash
set -e
OUTDIR="models"
mkdir -p "$OUTDIR"
BASE_URL="https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/weights"
files=("tiny_face_detector_model-weights_manifest.json" "tiny_face_detector_model-shard1" "face_landmark_68_model-weights_manifest.json" "face_landmark_68_model-shard1" "face_recognition_model-weights_manifest.json" "face_recognition_model-shard1")
echo "Baixando modelos do face-api.js (pode levar alguns minutos)..."
for f in "${files[@]}"; do
  url="$BASE_URL/$f"
  echo "Baixando $url"
  if command -v curl >/dev/null 2>&1; then
    curl -L -o "$OUTDIR/$f" "$url" || { echo 'Falha'; exit 2; }
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$OUTDIR/$f" "$url" || { echo 'Falha'; exit 2; }
  else
    echo "curl/wget não encontrado. Baixe manualmente e coloque em $OUTDIR"
    exit 3
  fi
done
echo "Modelos salvos em $OUTDIR"
echo "OBS: verifique o repo de modelos caso algum arquivo mude de nome."
