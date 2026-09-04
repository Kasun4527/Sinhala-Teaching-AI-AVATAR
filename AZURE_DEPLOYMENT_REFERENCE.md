# Azure Deployment Reference

## Resource identifiers

| Item | Value |
|---|---|
| Resource Group | `ai-avatar-rg` |
| Location | East US |
| Subscription ID | `18215114-464d-4c7c-93d5-82e325708b6d` |
| Tenant ID | `13156a78-b7cd-4f1d-b9fa-cdcf266a459f` |
| Azure account | kgunasekara643@gmail.com |
| ACR name | `aiavatarregistry15626` |
| ACR login server | `aiavatarregistry15626.azurecr.io` |
| Storage account | `aiavatarstorage15626` |
| File share | `avatar-data` |
| Container Apps environment | `ai-avatar-env` |
| Backend app name | `ai-avatar-backend` |
| Engagement app name | `ai-avatar-engagement` |

## Live URLs

- Backend: `https://ai-avatar-backend.thankfulpond-f76d3e0c.eastus.azurecontainerapps.io`
- Engagement engine: `https://ai-avatar-engagement.thankfulpond-f76d3e0c.eastus.azurecontainerapps.io`
- Frontend (Azure Static Web Apps): `https://witty-moss-04a910200.7.azurestaticapps.net`

## GitHub Actions OIDC (for CI to deploy without a password)

- App registration name: `ai-avatar-github-deploy`
- Client/App ID: `0fbea6a3-5d04-492e-8cb2-ec8687c395fb`
- Service principal Object ID: `39a3e652-c72c-4dc6-ac9a-1a3d7dcfa663`
- Federated credential subject: `repo:Kasun4527/Sinhala-Teaching-AI-AVATAR:ref:refs/heads/new_production`
- Role: Contributor on `ai-avatar-rg`

### GitHub repo secrets (Settings → Secrets and variables → Actions)
```
AZURE_CLIENT_ID       = 0fbea6a3-5d04-492e-8cb2-ec8687c395fb
AZURE_TENANT_ID       = 13156a78-b7cd-4f1d-b9fa-cdcf266a459f
AZURE_SUBSCRIPTION_ID = 18215114-464d-4c7c-93d5-82e325708b6d
AZURE_RESOURCE_GROUP  = ai-avatar-rg
AZURE_ACR_NAME        = aiavatarregistry15626
```

## Backend Container App secrets (set via `az containerapp secret set`)

Names only — values live in your local `backend/.env` / Brevo/YouTube dashboards, never commit them:
```
mongodb-uri
secret-key
groq-api-key
google-api-key
gemini-api-key
sinhala-llm-url      (ngrok tunnel URL — changes when you restart the tunnel!)
youtube-api-key
gmail-user
brevo-api-key
```

## Resources sizing (backend)

- CPU: 4.0 vCPU, Memory: 8Gi
- min-replicas: 1 (always warm, no cold-start ML-model reload), max-replicas: 2
- `chroma_db` is baked into the Docker image (NOT mounted — SQLite doesn't work over Azure Files/SMB)
- `documents_unicode` and `images` ARE mounted from Azure Files (`avatar-data-storage`)

## Common commands

```bash
# Login
az login

# Tail live logs
az containerapp logs show -n ai-avatar-backend -g ai-avatar-rg --follow
az containerapp logs show -n ai-avatar-engagement -g ai-avatar-rg --follow

# Add/update a secret + wire it to an env var
az containerapp secret set -n ai-avatar-backend -g ai-avatar-rg --secrets my-key="value"
az containerapp update -n ai-avatar-backend -g ai-avatar-rg --set-env-vars MY_ENV=secretref:my-key

# Change resources/scaling
az containerapp update -n ai-avatar-backend -g ai-avatar-rg --cpu 4.0 --memory 8Gi --min-replicas 1 --max-replicas 2

# Full spec edit (e.g. volume mounts)
az containerapp show -n ai-avatar-backend -g ai-avatar-rg -o yaml > backend-app.yaml
# ...edit the file...
az containerapp update -n ai-avatar-backend -g ai-avatar-rg --yaml backend-app.yaml

# Check subscription/account
az account show
```

## Troubleshooting playbook

**Step 1 — always start here: is it a build/deploy failure, or a runtime failure?**

- Build/deploy failure → check GitHub Actions (repo → Actions tab → click the red ✗ run → expand the failed step).
- Runtime failure (app is deployed but broken/erroring for users) → check Container App logs (below).

### A. GitHub Actions workflow failed
1. GitHub repo → **Actions** tab → click the failed run → expand the red step to read the actual error.
2. Common causes we hit:
   - `git checkout` "File name too long" → a file with a long Unicode name isn't excluded from `sparse-checkout` in the workflow's `actions/checkout@v4` step.
   - `az login`/OIDC failure ("Unable to get ACTIONS_ID_TOKEN_REQUEST_URL") → workflow's `permissions:` block is missing `id-token: write`.
   - `AZURE_CLIENT_ID`/`AZURE_TENANT_ID` "not present" → a GitHub secret is missing or misnamed (Settings → Secrets and variables → Actions → check exact names).
   - `MissingSubscriptionRegistration` → a resource provider isn't registered: `az provider register --namespace Microsoft.X`.

### B. App is deployed but broken/erroring (500s, "Network Error", crashes)
```bash
# Tail live logs, then reproduce the error in the browser
az containerapp logs show -n ai-avatar-backend -g ai-avatar-rg --follow
az containerapp logs show -n ai-avatar-engagement -g ai-avatar-rg --follow

# Or just the last N lines without following
az containerapp logs show -n ai-avatar-backend -g ai-avatar-rg --tail 50
```
Read the traceback at the bottom — it names the exact file/line that failed. Common patterns we hit:
- `requests.exceptions.HTTPError: 401/403 ...` calling an external API → a required env var/secret isn't set on the Container App (check `az containerapp show -n ai-avatar-backend -g ai-avatar-rg --query "properties.template.containers[0].env"`).
- `WORKER TIMEOUT` / `SIGKILL` → either out of memory (bump `--cpu`/`--memory`) or something is hanging (check what the code was doing right before the gap in the logs — for us it was SQLite over an Azure Files mount).
- Hang with no error at all, just silence then a timeout → suspect a network-mounted volume being used for something that needs real file locking (e.g. SQLite/ChromaDB) — don't mount those, bake them into the image instead.

### C. Verify current live config for a Container App
```bash
az containerapp show -n ai-avatar-backend -g ai-avatar-rg -o yaml
# or just specific fields:
az containerapp show -n ai-avatar-backend -g ai-avatar-rg --query "properties.template.containers[0].env"
az containerapp show -n ai-avatar-backend -g ai-avatar-rg --query "properties.template.containers[0].resources"
az containerapp show -n ai-avatar-backend -g ai-avatar-rg --query "properties.template.scale"
```

### D. `az login` itself fails
```bash
# If you get AADSTS50076 (MFA required) via the Windows account-picker/broker:
az config set core.enable_broker_on_windows=false
az login
```

### E. When genuinely stuck
Paste the exact error text (not a paraphrase) — Azure/GitHub error messages are usually specific enough to point straight at the fix.


## Notes / known gotchas

- `az login` on Windows may need `az config set core.enable_broker_on_windows=false` if you hit an MFA/AADSTS50076 error.
- `az acr build` (ACR Tasks) is BLOCKED on this trial subscription — images are built by GitHub Actions (which has Docker preinstalled) and pushed via `az acr login` + `docker push`, not `az acr build`.
- New resource providers may need `az provider register --namespace <Microsoft.X>` the first time you use a new Azure service on this subscription.
- $200 free trial credit expires 30 days from signup — check the Azure Portal home banner for remaining days.
