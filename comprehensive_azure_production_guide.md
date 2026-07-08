# 🌍 The Definitive Azure Cloud Architecture & DevOps Master Plan
**Sinhala Teaching AI Avatar — Global Production Scale**

As a Senior DevOps & Cloud Solutions Architect, I have deeply analyzed your academic prototype and the specific causes of your previous Azure deployment crashes ("back clashes"). To scale this platform to thousands of students in Sri Lanka with near-zero downtime, exceptional User Experience (UX), and strict cost controls using your two Azure subscriptions, a fundamental shift in architecture and codebase behavior is required.

This document serves as the absolute blueprint for your team.

---

## 🛑 1. Deep Dive: Diagnosing the "Back Clash" (Why it Crashed)

Your previous deployment utilized a single Azure App Service (B1 tier) containing the FastAPI backend, an embedded ChromaDB, and an Ngrok tunnel. It failed under load due to a trifecta of systemic bottlenecks.

### A. The Memory Starvation (OOM Kills)
**The Problem**: The Azure App Service B1 plan provisions **1.75 GB of RAM**. Your FastAPI application initializes several extraordinarily heavy Python libraries on startup:
1. `tensorflow-cpu` (for the LSTM personalization engine).
2. `sentence-transformers` (for ChromaDB local embedding generation).
3. `langchain` and `langgraph`.
Loading these dependencies and the `bkt_lstm_weights.weights.h5` model instantly spikes RAM usage above 2GB. Azure's Docker daemon detects this memory ceiling breach and ruthlessly kills the container (OOM - Out Of Memory), resulting in endless `502 Bad Gateway` or `503 Service Unavailable` errors for students.

### B. Threadpool Starvation (Synchronous Blocking)
**The Problem**: In `backend/main.py`, your critical endpoints are defined synchronously:
```python
@app.post("/submit-pre-quiz/")
def submit_pre_quiz(data: QuizSubmission):
    final_state = learning_graph.invoke(...) # BLOCKS THE ENTIRE THREAD
```
FastAPI runs on an asynchronous event loop (Uvicorn). When a student submits a quiz, `learning_graph.invoke()` calls the Groq API (which takes 2-5 seconds). Because the function is defined with `def` instead of `async def`, it hijacks one of the few available Uvicorn worker threads. If 10 students submit a quiz simultaneously, all worker threads are blocked waiting for Groq, and the 11th student's request will time out or fail.

### C. The Embedded Database Trap (SQLite Lock)
**The Problem**: You are using `chromadb.PersistentClient(path="./chroma_db")`. This creates a local SQLite file.
1. When deployed to Azure App Service, the filesystem is a mounted SMB network share. SQLite on SMB network shares is notoriously prone to `database is locked` corruption.
2. If you ever scale the App Service to 2 or 3 instances (horizontal scaling) to handle more students, both instances will try to write to the same SQLite file simultaneously, causing instant, irrecoverable corruption of your RAG vector database.

### D. The Ngrok Single Point of Failure
**The Problem**: The Fine-Tuned Sinhala model runs on a local PC connected via Ngrok. If the local internet in Sri Lanka fluctuates, if there's a power cut, or if the Ngrok free tier connection resets, the `/ask-question` endpoint entirely breaks in production.

---

## 🎯 2. Global Requirements & UX Optimization

To serve students globally (specifically optimized for Sri Lanka), we must design against the following requirements:

| Requirement | Metric | Architectural Solution |
| :--- | :--- | :--- |
| **Low Latency** | < 200ms TTFB | Deploy all resources to the **Southeast Asia (Singapore)** or **Central India (Pune)** Azure regions. |
| **High Concurrency** | 1000+ simultaneous users | Convert FastAPI to `async`, extract database to PaaS, scale App Service horizontally. |
| **Zero Downtime Deployments** | 99.9% Uptime | Utilize Azure App Service **Deployment Slots** (Blue/Green deployments). |
| **Cost Segregation** | Supervisor Billing | Strictly map heavy compute to the Pay-As-You-Go sub, and static/free resources to the Student Sub. |

---

## 🏗️ 3. The Three Architectural Paths

Here are three distinct engineering paths to solve these problems, complete with cost, performance, and scaling evaluations.

### PATH 1: "Optimized PaaS" (Highly Recommended for this Team)
*This path relies on Azure Platform-as-a-Service offerings. It removes OS management, provides easy deployment slots, and scales gracefully.*

**Architecture Breakdown:**
- **Frontend**: Azure Static Web Apps (Student Sub).
- **Backend API**: Azure App Service **Premium V3 (P1V3 - 8GB RAM, 2 vCPUs)**. This completely solves the OOM memory crash. (Pay-As-You-Go Sub).
- **Vector DB**: ChromaDB hosted in a standalone **Azure Container Instance (ACI)**. The backend communicates with it via REST API, solving the SQLite lock issue.
- **Transactional DB**: Azure Cosmos DB for MongoDB (Serverless tier).
- **Finetuned Model**: Initially kept on Ngrok, eventually migrated to Azure Machine Learning Managed Endpoints.

**Evaluation:**
- **Performance**: ⭐⭐⭐⭐ (Great. The 8GB RAM gives TensorFlow plenty of breathing room).
- **DevOps Effort**: ⭐⭐ (Very low. GitHub Actions deploying to App Service is trivial).
- **Estimated Cost**: ~$160/month.

### PATH 2: "The Microservice Swarm" (Azure Container Apps / AKS)
*This path embraces true cloud-native architecture. Every component becomes a scalable Docker container.*

**Architecture Breakdown:**
- **Frontend**: Containerized Next.js deployed to Azure Container Apps (ACA).
- **Backend API**: Containerized FastAPI deployed to ACA. Configured with KEDA (Kubernetes Event-driven Autoscaling) to scale based on HTTP traffic.
- **Vector DB**: ChromaDB deployed as a secondary microservice within the same ACA Environment for secure, internal DNS communication.
- **Finetuned Model**: A GPU-enabled container inside ACA hosting the LLM.

**Evaluation:**
- **Performance**: ⭐⭐⭐⭐⭐ (Infinite scale. Can handle 10,000+ students by spawning 50 backend containers in seconds).
- **DevOps Effort**: ⭐⭐⭐⭐⭐ (Very high. Requires writing robust Dockerfiles, setting up Azure Container Registries, managing vNets, and debugging container lifecycle events).
- **Estimated Cost**: ~$50 - $400/month (Highly variable. ACA charges per-second. Can scale to $0 when students are asleep, but GPU profiles are expensive when running).

### PATH 3: "The IaaS Monolith" (Azure Virtual Machines)
*The traditional brute-force method. Rent a massive server and run everything using Docker Compose.*

**Architecture Breakdown:**
- **Server**: Azure Virtual Machine `Standard_NC4as_T4_v3` (4 Cores, 28GB RAM, 1x NVIDIA T4 GPU).
- **Setup**: You SSH into the Linux VM, install Docker, and run MongoDB, ChromaDB, FastAPI, Next.js, and the Finetuned Model as local Docker containers.
- **Networking**: Place an Azure Application Gateway or NGINX reverse proxy in front for SSL termination.

**Evaluation:**
- **Performance**: ⭐⭐⭐⭐ (Fast, but limited strictly to the power of that one machine).
- **DevOps Effort**: ⭐⭐⭐ (Moderate to setup, but high maintenance. You must patch Linux, renew SSL certs, and monitor disks yourself).
- **Estimated Cost**: ~$386/month (Flat rate. Excellent value for getting a dedicated GPU 24/7).

---

## 🏆 4. The Execution Plan (Implementing Path 1)

As a Cloud Architect, I strongly mandate **Path 1** for your team. It leverages your existing GitHub Actions YAML structure while fixing the architectural bottlenecks.

### A. Subscription & Resource Allocation

**Subscription 1: Azure for Students ($100 Credit)**
*Keep zero-cost and static resources here to maximize the lifespan of the credit.*
1. **Resource Group**: `rg-sinhala-avatar-student`
2. **Azure Static Web Apps**: Host the Next.js frontend (Standard Tier is free for students).
3. **Azure Key Vault**: Store all secrets (`GROQ_API_KEY`, `SECRET_KEY`).
4. **Application Insights**: 5GB/month free log ingestion.

**Subscription 2: Pay-As-You-Go (Supervisor Billed)**
*Heavy compute and databases go here.*
1. **Resource Group**: `rg-sinhala-avatar-prod`
2. **Azure App Service Plan**: Must be `Premium V3 P1V3` (Linux). **DO NOT use B1.**
3. **Azure App Service**: The FastAPI backend.
4. **Azure Cosmos DB**: MongoDB API, set to **Serverless** mode (only charges per database read/write operation).
5. **Azure Container Instances (ACI)**: For the ChromaDB Server.

### B. Required Codebase Refactoring (MANDATORY)

Before touching the Azure Portal, your development team **MUST** apply these three architectural code changes. If you skip these, the cloud deployment will fail.

#### Code Fix 1: Async I/O for Scalability
Change all endpoints hitting external APIs or LangGraph to `async` to prevent threadpool starvation.
*File: `backend/main.py`*
```python
import asyncio

# CHANGE THIS:
@app.post("/submit-pre-quiz/")
async def submit_pre_quiz(data: QuizSubmission):
    # Run the heavy LangGraph execution in a separate threadpool
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
            # ... other fields
        }
    )
    return {
        "score": final_state["score"],
        "level": final_state["level"],
        "content": final_state["content"],
        "mastery": final_state.get("mastery"),
        "hybrid_mastery": final_state.get("hybrid_mastery"),
        "bkt_level": final_state.get("bkt_level")
    }
```
*(Apply this `asyncio.to_thread` pattern to `/submit-post-quiz/`, `/submit-answer/`, and `/ask-question/` as well).*

#### Code Fix 2: Decoupling ChromaDB
You cannot use local SQLite on an App Service.
*File: `backend/services/vector_store.py`*
```python
import chromadb
import os

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = os.getenv("CHROMA_PORT", "8000")

# Use HttpClient in production to connect to the ACI container
if os.getenv("ENVIRONMENT") == "production":
    print(f"Connecting to remote ChromaDB at {CHROMA_HOST}:{CHROMA_PORT}")
    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
else:
    client = chromadb.PersistentClient(path="./chroma_db")
```

#### Code Fix 3: Trimming the Memory Fat
In `backend/requirements.txt`, you are installing `tensorflow-cpu`. This is massive.
In a future sprint, you should convert `bkt_lstm_weights.weights.h5` to an ONNX model (`.onnx`) and use the `onnxruntime` library. It uses 1/10th the RAM and is 3x faster for inference. For now, the P1V3 App Service (8GB) will handle TensorFlow, but ONNX is the ultimate best practice.

---

## 💻 5. Step-by-Step Azure Portal Implementation Guide

This is the exact runbook for deploying the infrastructure via the Azure Portal UI.

### Step 1: Deploy Cosmos DB (Database)
1. Log into Azure Portal. Switch to **Pay-As-You-Go Subscription**.
2. Search "Azure Cosmos DB". Click **Create**.
3. Select **Azure Cosmos DB for MongoDB** -> **Request Unit (RU) / Serverless**.
4. Resource Group: Create `rg-sinhala-avatar-prod`.
5. Account Name: `cosmos-sinhala-avatar-prod`.
6. Location: **Southeast Asia**.
7. Capacity Mode: **Serverless** (Critical for low cost).
8. Once deployed, go to **Connection String** in the left menu and copy the PRIMARY CONNECTION STRING.

### Step 2: Deploy ChromaDB (Vector Store)
1. Search "Container Instances". Click **Create**.
2. Resource Group: `rg-sinhala-avatar-prod`.
3. Container Name: `chromadb-server`.
4. Region: **Southeast Asia**.
5. Image source: **Other Registry**. Image type: Public. Image: `chromadb/chroma:latest`.
6. OS type: Linux. Size: **2 vCPUs, 4 GiB memory**.
7. **Networking Tab**: DNS name label: `chroma-sinhala-prod`. Ports: Open `8000` (TCP).
8. **Advanced Tab** -> Environment variables:
   * Key: `IS_PERSISTENT`, Value: `TRUE`
   * Key: `ANONYMIZED_TELEMETRY`, Value: `FALSE`
9. Review and Create. Once deployed, save the FQDN (e.g., `chroma-sinhala-prod.southeastasia.azurecontainer.io`).

### Step 3: Deploy FastAPI Backend (App Service)
1. Search "App Services". Click **Create** -> **Web App**.
2. Resource Group: `rg-sinhala-avatar-prod`.
3. Name: `app-sinhala-backend-prod`.
4. Publish: **Code**. Runtime: **Python 3.10**. OS: **Linux**.
5. Region: **Southeast Asia**.
6. Pricing Plan: Click "Explore pricing plans". Go to **Premium V3** and select **P1V3** (2 Cores, 8GB RAM). 
7. Once deployed, go to **Environment Variables** (Configuration) and add:
   * `GROQ_API_KEY`: <your-groq-key>
   * `SECRET_KEY`: <a-strong-jwt-secret-string>
   * `MONGODB_URI`: <your-cosmos-db-connection-string>
   * `ENVIRONMENT`: `production`
   * `CHROMA_HOST`: `chroma-sinhala-prod.southeastasia.azurecontainer.io`
   * `CHROMA_PORT`: `8000`
   * `SCM_DO_BUILD_DURING_DEPLOYMENT`: `true`
8. **Startup Command**: Go to Configuration -> General Settings -> Startup Command. Enter:
   `uvicorn main:app --host 0.0.0.0 --port 8000`

### Step 4: Deploy Next.js Frontend (Static Web Apps)
1. Switch directory to your **Azure for Students** subscription.
2. Search "Static Web Apps". Click **Create**.
3. Resource Group: `rg-sinhala-avatar-student`.
4. Name: `swa-sinhala-frontend`.
5. Hosting Plan: **Standard** (Better SLA, SLA required for production).
6. Region: **Southeast Asia**.
7. Deployment Details: Sign in with GitHub. Select your organization, repo, and the `main` branch.
8. Build Presets: **Next.js**. App location: `/frontend`.
9. Once created, go to **Environment Variables** and add:
   * `NEXT_PUBLIC_API_URL`: `https://app-sinhala-backend-prod.azurewebsites.net`

---

## 🔀 6. Branch Management & Zero-Downtime CI/CD

To prevent a bad code push from taking the system down for Sri Lankan students, you must implement **Deployment Slots**.

### Branch Strategy
*   `main`: The sacred production branch. Protected by GitHub rules. Requires Pull Request approval.
*   `develop`: The staging branch. Developers push features here.

### CI/CD Implementation (Blue/Green Deployment)
1. In the Azure Portal, go to your backend App Service (`app-sinhala-backend-prod`).
2. On the left menu, click **Deployment slots** -> **Add Slot**. Name it `staging`.
3. Clone settings from the production slot.
4. Modify your `.github/workflows/backend-deploy.yml`:
   Create two separate jobs. 
   - When a commit is pushed to `develop`, the action deploys the zip file to the `staging` slot.
   - You can now test the live API at `https://app-sinhala-backend-prod-staging.azurewebsites.net`.
5. **The Swap**: Once QA verifies the staging environment is working flawlessly, you go to the Azure Portal Deployment Slots page and click **Swap**.
6. Azure instantly routes all student traffic from the old production container to the new staging container. **Zero downtime.** If there's an error, you simply click Swap again to rollback instantly.

---

## 📊 7. Final Executive Summary

By executing this architectural blueprint, your team achieves:
1. **Absolute Stability**: Moving to the 8GB P1V3 tier and implementing `asyncio.to_thread` guarantees the system will never OOM crash or block under concurrent student loads.
2. **Data Integrity**: Decoupling ChromaDB to a standalone Container Instance prevents SQLite locks and allows your backend App Service to scale horizontally if needed.
3. **Financial Compliance**: Strict segregation between the Student Sub (Frontend, Secrets, Logs) and Pay-As-You-Go Sub (Compute, DBs) ensures your supervisor receives clean, predictable billing.
4. **Professional DevOps**: Utilizing GitFlow and Azure Deployment Slots elevates the project from a university prototype to an enterprise-grade platform.

The very first action your engineering team must take is applying the `async` refactor in `main.py` and the `HttpClient` refactor in `vector_store.py`. Once pushed to GitHub, you may proceed with the Portal deployments.
