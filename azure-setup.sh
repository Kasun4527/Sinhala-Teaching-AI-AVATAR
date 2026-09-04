#!/usr/bin/env bash
# One-time Azure setup for backend + engagement_engine.
# Run this yourself after `az login`. Safe to re-run (idempotent-ish); review before use.
set -euo pipefail

# ---- Config: edit these ----
RESOURCE_GROUP="ai-avatar-rg"
LOCATION="eastus"                # pick a region close to you / with quota
ACR_NAME="aiavatarregistry15626"     # already created on the first (partial) run - reused, not regenerated
ENV_NAME="ai-avatar-env"
BACKEND_APP="ai-avatar-backend"
ENGAGEMENT_APP="ai-avatar-engagement"
STORAGE_ACCOUNT="aiavatarstorage15626" # globally unique, lowercase alnum
FILE_SHARE="avatar-data"
PLACEHOLDER_IMAGE="mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"

# ---- 1. Resource group ----
az group create -n "$RESOURCE_GROUP" -l "$LOCATION"

# ---- 1b. Register resource providers (needed once per subscription) ----
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.Storage
# Registration is async; wait for ACR's to finish before creating the registry.
az provider show -n Microsoft.ContainerRegistry --query registrationState -o tsv
while [ "$(az provider show -n Microsoft.ContainerRegistry --query registrationState -o tsv)" != "Registered" ]; do
  echo "Waiting for Microsoft.ContainerRegistry registration..."
  sleep 5
done

# ---- 2. Container registry (ACR) ----
# ACR Tasks (`az acr build`) is blocked on trial subscriptions, so images are NOT
# built here. GitHub Actions (which has Docker preinstalled) builds and pushes them
# instead — see .github/workflows/*-deploy-azure.yml. This just ensures the registry exists.
az acr show -n "$ACR_NAME" -g "$RESOURCE_GROUP" &>/dev/null || \
  az acr create -n "$ACR_NAME" -g "$RESOURCE_GROUP" --sku Basic --admin-enabled true

# The container apps below are created pointing at a public placeholder image;
# push to `new_production` (with the two Azure workflows in place) to have CI
# build your real images and swap them in via `az containerapp update --image`.

# ---- 3. Storage account + file share (persistent data for backend) ----
az storage account create -n "$STORAGE_ACCOUNT" -g "$RESOURCE_GROUP" -l "$LOCATION" --sku Standard_LRS
STORAGE_KEY=$(az storage account keys list -n "$STORAGE_ACCOUNT" -g "$RESOURCE_GROUP" --query "[0].value" -o tsv)
az storage share-rm create --resource-group "$RESOURCE_GROUP" --storage-account "$STORAGE_ACCOUNT" --name "$FILE_SHARE" --quota 10

# Seed the share with your existing local data so it's not empty on first run
az storage file upload-batch \
  --account-name "$STORAGE_ACCOUNT" --account-key "$STORAGE_KEY" \
  -d "$FILE_SHARE" -s "./backend/chroma_db" --destination-path chroma_db
az storage file upload-batch \
  --account-name "$STORAGE_ACCOUNT" --account-key "$STORAGE_KEY" \
  -d "$FILE_SHARE" -s "./backend/documents_unicode" --destination-path documents_unicode
az storage file upload-batch \
  --account-name "$STORAGE_ACCOUNT" --account-key "$STORAGE_KEY" \
  -d "$FILE_SHARE" -s "./backend/images" --destination-path images

# ---- 4. Container Apps environment ----
az extension add --name containerapp --upgrade

az containerapp env create -n "$ENV_NAME" -g "$RESOURCE_GROUP" -l "$LOCATION"

# Register the file share as a mountable storage in the environment
az containerapp env storage set \
  -n "$ENV_NAME" -g "$RESOURCE_GROUP" \
  --storage-name avatar-data-storage \
  --azure-file-account-name "$STORAGE_ACCOUNT" \
  --azure-file-account-key "$STORAGE_KEY" \
  --azure-file-share-name "$FILE_SHARE" \
  --access-mode ReadWrite

ACR_SERVER=$(az acr show -n "$ACR_NAME" --query loginServer -o tsv)
ACR_USER=$(az acr credential show -n "$ACR_NAME" --query username -o tsv)
ACR_PASS=$(az acr credential show -n "$ACR_NAME" --query "passwords[0].value" -o tsv)

# ---- 5. Backend container app ----
# Fill in the real secret values from backend/.env before running this.
az containerapp create \
  -n "$BACKEND_APP" -g "$RESOURCE_GROUP" \
  --environment "$ENV_NAME" \
  --image "$PLACEHOLDER_IMAGE" \
  --registry-server "$ACR_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
  --target-port 8000 --ingress external \
  --min-replicas 0 --max-replicas 2 --cpu 1 --memory 2Gi \
  --secrets \
    mongodb-uri="<value>" \
    secret-key="<value>" \
    groq-api-key="<value>" \
    google-api-key="<value>" \
    gemini-api-key="<value>" \
  --env-vars \
    MONGODB_URI=secretref:mongodb-uri \
    SECRET_KEY=secretref:secret-key \
    GROQ_API_KEY=secretref:groq-api-key \
    GOOGLE_API_KEY=secretref:google-api-key \
    GEMINI_API_KEY=secretref:gemini-api-key \
    FRONTEND_URL=https://witty-moss-04a910200.7.azurestaticapps.net

# Mount the file share into the backend app's containers.
# `containerapp create/update` has no dedicated volume-mount flags, so export the
# current spec, add a volume + volumeMounts entry, then apply it back.
az containerapp show -n "$BACKEND_APP" -g "$RESOURCE_GROUP" -o yaml > backend-app.yaml
echo "Now edit backend-app.yaml:"
echo "  - under properties.template, add:"
echo "      volumes:"
echo "        - name: avatar-data"
echo "          storageType: AzureFile"
echo "          storageName: avatar-data-storage"
echo "  - under properties.template.containers[0], add (subPath keeps the app's"
echo "    existing relative paths ./chroma_db etc. working unchanged):"
echo "      volumeMounts:"
echo "        - volumeName: avatar-data"
echo "          mountPath: /app/chroma_db"
echo "          subPath: chroma_db"
echo "        - volumeName: avatar-data"
echo "          mountPath: /app/documents_unicode"
echo "          subPath: documents_unicode"
echo "        - volumeName: avatar-data"
echo "          mountPath: /app/images"
echo "          subPath: images"
echo "Then run: az containerapp update -n \"$BACKEND_APP\" -g \"$RESOURCE_GROUP\" --yaml backend-app.yaml"

# ---- 6. Engagement engine container app (stateless, simpler) ----
az containerapp create \
  -n "$ENGAGEMENT_APP" -g "$RESOURCE_GROUP" \
  --environment "$ENV_NAME" \
  --image "$PLACEHOLDER_IMAGE" \
  --registry-server "$ACR_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
  --target-port 5000 --ingress external \
  --min-replicas 0 --max-replicas 2 --cpu 1 --memory 2Gi \
  --env-vars FRONTEND_URL=https://witty-moss-04a910200.7.azurestaticapps.net

echo "Backend URL:"
az containerapp show -n "$BACKEND_APP" -g "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv
echo "Engagement URL:"
az containerapp show -n "$ENGAGEMENT_APP" -g "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv

# ---- 7. GitHub Actions OIDC login (so CI can redeploy without a stored password) ----
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
GITHUB_ORG="Kasun4527"
GITHUB_REPO="Sinhala-Teaching-AI-AVATAR"

APP_ID=$(az ad app create --display-name "ai-avatar-github-deploy" --query appId -o tsv)
az ad sp create --id "$APP_ID"
az role assignment create --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP"

az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-new_production-branch",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:'"$GITHUB_ORG"'/'"$GITHUB_REPO"':ref:refs/heads/new_production",
  "audiences": ["api://AzureADTokenExchange"]
}'

echo "Add these as GitHub repo secrets (Settings > Secrets and variables > Actions):"
echo "  AZURE_CLIENT_ID=$APP_ID"
echo "  AZURE_TENANT_ID=$TENANT_ID"
echo "  AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID"
echo "  AZURE_RESOURCE_GROUP=$RESOURCE_GROUP"
echo "  AZURE_ACR_NAME=$ACR_NAME"
