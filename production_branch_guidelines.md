# 🌿 Git Branch Management & DevOps Guidelines
**Sinhala Teaching AI Avatar — Main vs. Production Branch**

As a Senior DevOps Engineer, the golden rule of branch management is: **The `main` branch should always run perfectly on a local developer's laptop, while the `production` branch should be strictly configured for the cloud.** 

Since your friend has already tested the `main` branch, we will make sure our changes there are 100% non-breaking and backward-compatible. We will reserve cloud-specific overrides for the `production` branch.

---

## 🛠️ 1. Changes Needed in the `main` Branch
*These changes improve code quality and performance without breaking your friend's local testing environment.*

### A. Non-Breaking Performance Upgrades (Async)
Your friend tested the logic, but the server will freeze under load. You can safely convert the endpoints to `async` without changing the actual LangGraph logic.
**Action:** In `backend/main.py`, update the endpoints:
```python
import asyncio

# This behaves exactly the same locally, but prevents server freezing under load
@app.post("/submit-pre-quiz/")
async def submit_pre_quiz(data: QuizSubmission):
    final_state = await asyncio.to_thread(
        learning_graph.invoke,
        { ... } # keep the exact same dictionary payload
    )
    return { ... } # keep the exact same return structure
```

### B. Environment Variable Abstraction
Hardcoded values are bad practice. We need to abstract them so the `production` branch can inject cloud variables later without altering the Python logic.
**Action:** In `backend/main.py`, remove the hardcoded Ngrok URL and replace it with an environment variable that falls back to the current Ngrok URL for local testing.
```python
# OLD
FINETUNED_URL = "https://cupbearer-pointing-serotonin.ngrok-free.dev/ask"

# NEW (Safe for main)
import os
FINETUNED_URL = os.getenv("FINETUNED_URL", "https://cupbearer-pointing-serotonin.ngrok-free.dev/ask")
```

### C. ChromaDB Environment Toggle
Ensure `vector_store.py` can handle both local (embedded) and production (remote) modes seamlessly based on an `.env` file.
**Action:** In `backend/services/vector_store.py`:
```python
import os
import chromadb

# If ENVIRONMENT is not set, it defaults to local SQLite (what your friend tested)
if os.getenv("ENVIRONMENT") == "production":
    client = chromadb.HttpClient(
        host=os.getenv("CHROMA_HOST", "localhost"),
        port=os.getenv("CHROMA_PORT", "8000")
    )
else:
    client = chromadb.PersistentClient(path="./chroma_db")
```

---

## 🚀 2. Changes Needed in the `production` Branch
*After you run `git checkout production`, you will implement these Cloud & Security configurations. These changes are strictly for DigitalOcean/Azure and should not be merged back into `main`.*

### A. Strict CORS Configuration (Security)
In `main`, your CORS allows `http://localhost:3000`. In production, this is a massive security risk.
**Action:** In `backend/main.py` on the `production` branch:
```python
# PRODUCTION ONLY
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-azure-frontend-url.azurestaticapps.net", "https://learnsinhala.lk"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### B. Add Docker Configurations (Cloud Infrastructure)
DigitalOcean Droplets and Azure Container Instances require Docker. You will add these files *only* to the production branch.
**Action 1:** Create `backend/Dockerfile`.
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```
**Action 2:** Create `docker-compose.yml` in the root directory (as outlined in the Beta Launch Plan) to orchestrate FastAPI and ChromaDB.

### C. Clean up Unnecessary Local Files (Code Clean)
Cloud servers charge for storage and memory. You do not want to upload local garbage.
**Action:** In the `production` branch, add the following to your `.gitignore` or explicitly delete them before deployment:
*   `__pycache__/` folders.
*   `.env` files (Never commit production secrets to Git! You will inject these via DigitalOcean/Azure UI).
*   Any large local test databases like the `./chroma_db` folder (The production ChromaDB droplet will build its own clean database).

### D. Production Environment Variables (The Final Setup)
When you deploy the `production` branch to DigitalOcean/Azure, you must manually enter these variables into the Cloud Provider's UI (not in the code):
*   `ENVIRONMENT=production` (This triggers the `chromadb.HttpClient` logic we wrote in `main`).
*   `GROQ_API_KEY=<your-secret-key>`
*   `CHROMA_HOST=<ip-of-chromadb-droplet>`
*   `FINETUNED_URL=<your-groq-fallback-or-runpod-url>`

---
### 🔄 Summary of the Workflow
1. Stay on `main`. Make the `asyncio` and `os.getenv` changes. Test them locally to ensure your friend's logic still works flawlessly. Commit to `main`.
2. Run `git checkout production`. Merge `main` into `production`.
3. While on `production`, update the CORS URLs, add the `Dockerfile`, and commit to `production`.
4. Deploy the `production` branch to DigitalOcean/Azure!
