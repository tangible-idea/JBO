#!/bin/zsh
# Tidymark API를 Cloud Run에 배포합니다. 사용법: make deploy-api
set -euo pipefail
cd "$(dirname "$0")/.."

: ${GCP_PROJECT:?".env에 GCP_PROJECT를 설정하세요"}
REGION=${GCP_REGION:-asia-northeast3}
SERVICE=${CWS_API_SERVICE:-tidymark-api}
EXTENSION_ID=${CWS_ITEM_ID:-nglhhhkgognkifklfokjakljcopimcjg}

# 키는 커밋되지 않는 .env에서 읽어 Cloud Run 환경변수로만 넘깁니다.
env_vars="TYPESAFE_API_KEY=${TYPESAFE_API_KEY:?},POE_API_KEY=${POE_API_KEY:-}"
[[ -n "${TYPESAFE_MODEL:-}" ]] && env_vars+=",TYPESAFE_MODEL=$TYPESAFE_MODEL"
[[ -n "${POE_MODEL:-}" ]] && env_vars+=",POE_MODEL=$POE_MODEL"
env_vars+=",ALLOWED_ORIGINS=chrome-extension://$EXTENSION_ID"

gcloud run deploy "$SERVICE" \
  --project "$GCP_PROJECT" --region "$REGION" --source . \
  --allow-unauthenticated \
  --memory 512Mi --cpu 1 --concurrency 20 \
  --min-instances 0 --max-instances 2 --timeout 900 \
  --set-env-vars "$env_vars"

gcloud run services describe "$SERVICE" --project "$GCP_PROJECT" --region "$REGION" --format 'value(status.url)'
