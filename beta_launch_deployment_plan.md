# 🚀 1-Month Beta Launch Architecture & Deployment Plan
**Sinhala Teaching AI Avatar — Low Cost / High Credit Utilization Strategy**

Based on your new constraints, the goal is drastically different: you do not need an enterprise global-scale system *yet*. You need a highly stable beta-testing environment for 1 month to gather student feedback, utilizing your **$200 DigitalOcean credit** and **$200 Azure Free Account credit**, while keeping actual out-of-pocket expenses strictly under **$50**.

This document outlines how to perfectly balance those credits to achieve a stable architecture that prevents the memory crashes (OOM) and database locks you experienced previously.

---

## 🛑 1. The Core Problems to Solve (The "Back Clashes")

Regardless of which cloud provider you use, you **must** solve these architectural bottlenecks in your code, or the system will crash even with free credits.

1. **Memory Starvation (OOM Kills)**: Your backend loads `tensorflow`, `sentence-transformers`, and `langchain`. This requires a **minimum of 4GB to 8GB of RAM**. Deploying to a 1GB or 2GB server will instantly crash.
2. **Synchronous Blocking**: Your FastAPI `def submit_pre_quiz` functions block the server while waiting for LLM APIs. If 5 students submit a quiz simultaneously, the server freezes. You must use `async def` and `await asyncio.to_thread()`.
3. **Embedded ChromaDB SQLite Lock**: You cannot run ChromaDB in embedded mode (`PersistentClient`) if you use serverless platforms or scale out.

---

## 🏗️ 2. The Three Deployment Paths (Beta Launch Focus)

Here are three distinct paths tailored strictly to burning your existing credits over the next 30 days.

### PATH 1: The Multi-Cloud Hybrid (Highly Recommended)
*Use Azure for what it does best (Frontend/DB) and use DigitalOcean's raw power for the heavy memory backend.*

**How it works:**
- **Frontend**: Azure Static Web Apps (Free Tier on Azure).
- **Database**: Azure Cosmos DB for MongoDB (Serverless tier on Azure — uses a fraction of the $200 Azure credit).
- **Backend API + ChromaDB**: A robust 8GB RAM **DigitalOcean Droplet** (Virtual Machine). You run both the FastAPI server and ChromaDB inside Docker containers on this single, powerful machine.
- **Finetuned Model**: Keep it running on your local PC via **Ngrok**. Since this is a 1-month beta for a specific group of students, you don't need 24/7 cloud GPU reliability. Just keep the PC running during testing hours.

**Cost Estimation (1 Month):**
*   **Azure Usage**: Static Web App ($0) + Cosmos DB Serverless (~$5). Covered by the $200 Azure credit.
*   **DigitalOcean Usage**: Droplet (4 vCPUs, 8GB RAM, 160GB SSD) = **$48.00/month**.
*   **Total Out-of-Pocket Cash**: **$0.00** (You burn $48 of the $200 DO credit, and $5 of the $200 Azure credit).

**Pros & Cons:**
*   ✅ **Pros**: Safest architecture for your budget. The 8GB RAM Droplet completely solves the OOM crash. Zero real money spent.
*   ❌ **Cons**: You have to manually SSH into the DigitalOcean Droplet, install Docker, and deploy the code (IaaS management).

---

### PATH 2: The Pure DigitalOcean "App Platform"
*DigitalOcean's version of Azure App Service. Easier to deploy, but slightly more expensive.*

**How it works:**
- **Frontend**: DigitalOcean App Platform (Static Site - Free).
- **Database**: DigitalOcean Managed MongoDB (Basic node - $15/mo).
- **Backend API**: DigitalOcean App Platform (Professional Tier, 8GB RAM - $40/mo).
- **Vector DB**: ChromaDB running on a separate App Platform container ($12/mo).
- **Finetuned Model**: Ngrok on local PC.

**Cost Estimation (1 Month):**
*   **DigitalOcean Usage**: $15 (DB) + $40 (Backend) + $12 (Chroma) = **$67.00/month**.
*   **Total Out-of-Pocket Cash**: **$0.00** (Covered entirely by the $200 DO credit).

**Pros & Cons:**
*   ✅ **Pros**: Very easy deployment. You just connect your GitHub repo to DO App Platform and it builds everything automatically. No SSH required.
*   ❌ **Cons**: App Platform can sometimes struggle with heavy Python ML builds during the deployment phase.

---

### PATH 3: The Pure Azure Cloud (Burn the $200 Azure Credit)
*Keep everything in Microsoft Azure by utilizing the $200 30-day introductory credit.*

**How it works:**
- **Frontend**: Azure Static Web Apps (Free).
- **Backend API**: Azure App Service **Premium V3 (P1V3 - 8GB RAM)**. This costs ~$130/month.
- **Vector DB**: Azure Container Instances (ACI) running ChromaDB server (~$30/month).
- **Database**: Azure Cosmos DB Serverless (~$5/month).
- **Finetuned Model**: Ngrok on local PC.

**Cost Estimation (1 Month):**
*   **Azure Usage**: $130 (App Service) + $30 (ACI) + $5 (Cosmos) = **$165.00/month**.
*   **Total Out-of-Pocket Cash**: **$0.00** (Covered entirely by the $200 Azure free credit).
*   **Warning**: On day 31, if you don't delete these resources, your credit card will be charged.

**Pros & Cons:**
*   ✅ **Pros**: Keeps you in the Microsoft ecosystem. Very professional setup. Easiest to transition to an enterprise architecture later.
*   ❌ **Cons**: You will burn through the entire $200 credit in exactly one month.

---

## 🏆 3. The Recommended Decision: Path 1 (Multi-Cloud Hybrid)

For a 1-month beta with a hard $50 budget boundary, **Path 1 is the safest and most reliable.** DigitalOcean Droplets offer raw, dedicated Linux power which is perfect for memory-heavy ML scripts like TensorFlow, and it barely touches your $200 credit.

### How to Implement Path 1 (Step-by-Step)

#### Phase 1: Fix the Codebase (CRITICAL)
Before deploying, your team MUST fix the synchronous blocking issue. If you don't, the server will freeze during beta testing.

**File:** `backend/main.py`
```python
import asyncio

# Wrap ALL endpoints that call the LangGraph learning_graph or external APIs in async
@app.post("/submit-pre-quiz/")
async def submit_pre_quiz(data: QuizSubmission):
    
    # Run the heavy graph execution in a separate threadpool
    final_state = await asyncio.to_thread(
        learning_graph.invoke,
        {
            "student_id": data.student_id,
            "subject": data.subject,
            "lesson": data.lesson,
            "topic": data.topic,
            "student_answers": data.student_answers,
            "correct_answers": data.correct_answers,
            "quiz_type": "pre",
            "quiz_questions": data.quiz_questions
        }
    )
    # return statement...
```

#### Phase 2: Setup Azure Resources
1. Go to Azure Portal.
2. Create **Azure Cosmos DB for MongoDB** (Capacity Mode: Serverless). Copy the connection string.
3. Create **Azure Static Web Apps**. Connect your GitHub repository (`frontend` folder). Add the `NEXT_PUBLIC_API_URL` environment variable pointing to the IP address of your DigitalOcean Droplet (e.g., `http://138.197.x.x:8000`).

#### Phase 3: Setup DigitalOcean Droplet
1. Log into DigitalOcean. Verify your $200 student credit is active.
2. Click **Create -> Droplets**.
3. Choose **Ubuntu 24.04**.
4. Choose **Basic** Plan -> **Regular CPU** -> **$48/mo (4 vCPUs, 8GB RAM, 160GB SSD)**.
5. Add your SSH keys. Click Create.
6. SSH into the Droplet: `ssh root@<droplet-ip>`
7. Install Docker and Git:
   ```bash
   apt update
   apt install docker.io docker-compose git -y
   ```

#### Phase 4: Deploy the Backend via Docker Compose
On the DigitalOcean Droplet, we will run both FastAPI and ChromaDB.
Create a `docker-compose.yml` file on the Droplet:

```yaml
version: '3.8'

services:
  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8001:8000"
    volumes:
      - ./chroma_data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE

  fastapi-backend:
    build: 
      context: ./Sinhala-Teaching-AI-AVATAR/backend
    ports:
      - "8000:8000"
    environment:
      - GROQ_API_KEY=<your-key>
      - MONGODB_URI=<azure-cosmos-db-string>
      - SECRET_KEY=<your-secret>
      - CHROMA_HOST=chromadb
      - CHROMA_PORT=8000
    depends_on:
      - chromadb
```

**Clone and Run:**
```bash
git clone -b main https://github.com/Kasun4527/Sinhala-Teaching-AI-AVATAR.git
docker-compose up -d --build
```
Your backend API will now be live at `http://<droplet-ip>:8000`.

---

## 📊 4. How to spend your $50 actual budget (If needed)

Since the entire cloud infrastructure is covered by the $400 combined free credits, you have $50 in cash remaining. Where should you spend it?

1. **Custom Domain Name ($10 - $15/year)**: Buy a `.lk` or `.com` domain name from Namecheap or GoDaddy. Connect it to your Azure Static Web App so students access `https://learnsinhala.lk` instead of a random Azure URL.
2. **Groq API Credits ($20)**: The Groq free tier has strict Rate Limits (Tokens per minute). During the beta test, if 10 students generate a lesson at the exact same time, you might hit the Groq free tier rate limit. Putting $20 into Groq removes these rate limits entirely.
3. **Save the rest**: Keep the remaining $15 as an emergency buffer.

---

## 🎯 5. Addressing the Model (24/7 Availability on a Budget)

Since students can log in at any time, the system **must be up 24/7**. Relying on a local PC via Ngrok is no longer an option. However, renting a dedicated 24/7 Cloud GPU (like an NVIDIA T4 or A10G) costs $300-$500/month, which instantly breaks your $50 budget and drains your credits.

Here are three ingenious engineering strategies to host your Fine-Tuned Sinhala model 24/7 without exceeding your budget:

### Strategy A: The "GGUF Quantization" CPU Strategy (Cost: $0 Cash)
If you convert your fine-tuned model into a 4-bit or 8-bit quantized **GGUF** format, you can run it on a standard CPU instead of an expensive GPU using `llama.cpp`. 
*   **How it works**: You use your $200 DigitalOcean credit to spin up a **CPU-Optimized Droplet** (e.g., 4 vCPUs, 8GB RAM for $48/mo) dedicated entirely to running the `llama.cpp` API server.
*   **Pros**: 100% covered by your DO free credits. Runs 24/7.
*   **Cons**: CPU inference is slower than a GPU (expect ~5 to 10 tokens per second). The students will see the answer typing out a bit slower, but it will be highly reliable.

### Strategy B: The "Serverless GPU" Strategy (Cost: ~$5 - $15 Cash)
Instead of renting a GPU 24/7, you deploy your model to a Serverless GPU provider like **RunPod Serverless** or **Modal**.
*   **How it works**: The GPU sleeps when no one is using it. When a student asks a question, the GPU wakes up (Cold Start takes ~3 seconds), generates the answer instantly, and goes back to sleep. You only pay for the exact seconds the GPU is computing (usually ~$0.0002 to $0.0004 per second).
*   **Pros**: Extremely cheap. You get blazing fast GPU speeds, and it easily fits within your $50 cash budget.
*   **Cons**: The first student to ask a question after a period of inactivity experiences a ~3-5 second "cold start" delay while the model loads into VRAM.

### Strategy C: The "Groq Fallback" Strategy (Cost: $0 Cash)
You are already using Groq's `llama-3.3-70b-versatile` API for generating the main lesson content. Llama-3.3-70b is a massive, world-class model that has surprisingly good multilingual capabilities.
*   **How it works**: You update `backend/main.py` so the `/ask-question` endpoint calls the Groq API instead of the Ngrok URL. You provide a very strict Sinhala system prompt (e.g., `"You are an expert Sinhala teacher. Answer the student's question strictly in Sinhala using the provided context."`).
*   **Pros**: Zero hosting required. Groq is insanely fast (~800 tokens/second). 
*   **Cons**: The Sinhala quality might be slightly less idiomatic than your specifically fine-tuned model, but for a 1-month beta, the 24/7 reliability and speed often outweigh slight linguistic nuances.

**My Recommendation**: Try **Strategy C (Groq)** first. Test if Llama-3.3-70b answers the RAG questions well enough in Sinhala. If the quality is too poor, spend $10 of your cash budget on **Strategy B (RunPod Serverless)** to host your actual fine-tuned model with zero 24/7 overhead costs.

## Summary Checklist for the Team:
- [ ] Refactor `main.py` endpoints to be `async` using `asyncio.to_thread`.
- [ ] Decide on Model Hosting: Change `/ask-question` to use Groq API, OR deploy to RunPod/DigitalOcean CPU.
- [ ] Refactor `vector_store.py` to use `chromadb.HttpClient`.
- [ ] Spin up Azure Cosmos DB (Serverless) and Static Web Apps.
- [ ] Spin up an 8GB RAM DigitalOcean Droplet using the $200 credit.
- [ ] Deploy the backend via Docker Compose on the Droplet.
- [ ] Give the domain URL to the student beta group!
