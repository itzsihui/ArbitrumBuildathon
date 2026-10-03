#!/usr/bin/env bash
# Deploy Aisle protocol (API Gateway + Lambda + DynamoDB + CloudWatch).
# Requires: aws CLI, Node 20+, zip.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STACK="${STACK_NAME:-aisle-protocol}"
REGION="${AWS_REGION:-ap-southeast-1}"
MERCHANT="${MERCHANT_ADDRESS:?Set MERCHANT_ADDRESS}"

if ! command -v aws >/dev/null 2>&1; then
  echo "Install AWS CLI first: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  echo "Then: aws configure  (or use hackathon credits / SSO)"
  exit 1
fi

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${ARTIFACT_BUCKET:-aisle-protocol-artifacts-${ACCOUNT}-${REGION}}"

echo "==> Build Lambda bundle"
npm run protocol:build
rm -f dist/aisle-protocol.zip
(
  cd dist/protocol
  zip -qr ../aisle-protocol.zip index.js index.js.map
)

echo "==> Ensure artifact bucket s3://$BUCKET"
aws s3 mb "s3://$BUCKET" --region "$REGION" 2>/dev/null || true
aws s3 cp dist/aisle-protocol.zip "s3://$BUCKET/aisle-protocol.zip" --region "$REGION"

echo "==> Deploy stack $STACK"
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK" \
  --template-file infra/protocol.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    MerchantAddress="$MERCHANT" \
    ArtifactBucket="$BUCKET" \
    ArtifactKey=aisle-protocol.zip \
    TokenAddress="${TOKEN_ADDRESS:-0x036CbD53842c5426634e7929541eC2318f3dCF7e}" \
    AvalancheRpcUrl="${BASE_RPC_URL:-https://sepolia.base.org}" \
    AvalancheNetwork="${BASE_NETWORK:-base-sepolia}" \
    ChainId="${CHAIN_ID:-84532}" \
    ExplorerBase="${EXPLORER_BASE:-https://sepolia.basescan.org}"

URL="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='ProtocolBaseUrl'].OutputValue" --output text)"
TABLE="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='TableName'].OutputValue" --output text)"
DASH="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='DashboardName'].OutputValue" --output text)"

echo ""
echo "Deployed."
echo "  ProtocolBaseUrl: $URL"
echo "  Table:           $TABLE"
echo "  Dashboard:       $DASH"
echo ""
echo "Add to .env:"
echo "  PROTOCOL_BASE_URL=$URL"
echo "  NEXT_PUBLIC_PROTOCOL_BASE_URL=$URL"
echo "  AISLE_TABLE=$TABLE"
echo "  AWS_REGION=$REGION"
echo ""
echo "Smoke:"
echo "  curl -s $URL/health"
echo "  curl -s -X POST $URL/s/hackathon-shirts/buy -H 'content-type: application/json' -d '{\"skuId\":\"shirt\",\"quantity\":1}'"
echo "CloudWatch dashboard:"
echo "  https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${DASH}"
