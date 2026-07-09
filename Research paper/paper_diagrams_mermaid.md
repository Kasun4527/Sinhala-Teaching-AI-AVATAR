# Mermaid Diagrams for Conference Paper

This document contains the Mermaid source code for the five key diagrams required for the conference paper **"AI-Based Sinhala Assistant for Personalized A/L and O/L Learning"**.

These diagrams are designed to be imported directly into **draw.io** or generated using **Mermaid Live Editor** to download high-resolution PNG/SVG assets for the publication.

---

## How to Import into draw.io

To import these diagrams into draw.io:
1. Open [draw.io](https://app.diagrams.net/).
2. Select **File** -> **New** (or open your existing diagram).
3. In the top menu, go to **Extras** -> **Edit Diagram...**.
4. In the dialog box, clear any existing text, choose **Mermaid** from the drop-down menu at the bottom.
5. Copy one of the Mermaid code blocks below and paste it into the text area.
6. Click **Insert** or **Apply**. Draw.io will automatically parse the code and render it as editable shapes.
7. You can now adjust colors, fonts, and layouts as needed, then export as PNG (via **File** -> **Export as** -> **PNG...**).

---

## Fig. 1: System Architecture Diagram

This diagram visualizes the 5-layer modular architecture connected via FastAPI REST endpoints, showing the user roles, dashboards, agents, RAG pipeline, student models, and persistent storage.

```mermaid
flowchart TB
    %% Layer 1: User Interface
    subgraph UI_Layer ["Layer 1: User Interface Module"]
        direction LR
        Web["Next.js Web Client"]
        Mobile["React Native (Expo) Mobile Client"]
        Dashboards["Dashboards:<br/>• Student Dashboard<br/>• Teacher Dashboard<br/>• Parent Dashboard"]
        Web --> Dashboards
        Mobile --> Dashboards
    end

    %% REST API Gateway
    FastAPI["FastAPI REST Endpoints & API Gateway"]

    %% Layer 2: Multi-Agent AI Layer
    subgraph Agent_Layer ["Layer 2: Multi-Agent AI Layer (LangGraph)"]
        direction TB
        State["Shared State Object"]
        Orchestrator["Orchestrator Node<br/>(StateGraph Supervisor)"]
        Evaluator["Evaluator Agent<br/>(Tiering & Parameter Updates)"]
        GenAgent["Content Generator Agent<br/>(Lesson & Quiz Generation)"]
        Tracker["Progress Tracker Agent<br/>(Telemetry Logging)"]
        
        Orchestrator <--> State
        Evaluator <--> State
        GenAgent <--> State
        Tracker <--> State
        
        Orchestrator --> Evaluator
        Orchestrator --> GenAgent
        Orchestrator --> Tracker
    end

    %% Layer 3: RAG Knowledge Engine
    subgraph RAG_Engine ["Layer 3: RAG-Based Knowledge Engine"]
        direction TB
        Textbooks["Grade 11 Textbook PDF & Exam Data"]
        OCR["OCR & Manual Verification"]
        Chunks["512-Token Chunks (64-token overlap)"]
        Embeddings["paraphrase-multilingual-MiniLM-L12-v2"]
        FAISS["FAISS Flat L2 Vector Database"]
        
        Textbooks --> OCR --> Chunks --> Embeddings --> FAISS
    end

    %% Layer 4: Personalisation Engine
    subgraph BKT_Engine ["Layer 4: Hybrid-BKT Personalisation Engine"]
        direction TB
        PCBKT["Personalised Clustered BKT<br/>(PC-BKT)"]
        LSTM["Stacked LSTM Model<br/>(BKT-LSTM)"]
        Ensemble["Weighted Ensemble Block<br/>P_hybrid = 0.65 × P_PC-BKT + 0.35 × P_LSTM"]
        
        PCBKT --> Ensemble
        LSTM --> Ensemble
    end

    %% Layer 5: Data & Analytics
    subgraph Data_Layer ["Layer 5: Data & Analytics Layer"]
        direction LR
        MongoDB[("MongoDB Database<br/>(Logs, Profiles, RBAC)")]
        DashData["Teacher & Parent Analytics Engine"]
        MongoDB --> DashData
    end

    %% Inter-layer connections
    UI_Layer <-->|REST API / JSON| FastAPI
    FastAPI <--> Agent_Layer
    GenAgent <-->|Context Queries| FAISS
    Evaluator <-->|Telemetry & Mastery Inputs| BKT_Engine
    Tracker -->|Write Interaction Logs| MongoDB
    DashData -->|Read Analytics| Dashboards

    %% Style classes
    classDef layerStyle fill:#f8f9fa,stroke:#343a40,stroke-width:2px,stroke-dasharray: 5 5;
    classDef compStyle fill:#e7f5ff,stroke:#228be6,stroke-width:1.5px;
    classDef dbStyle fill:#f3f0ff,stroke:#7950f2,stroke-width:1.5px;
    classDef gateStyle fill:#fff0f6,stroke:#e64980,stroke-width:2px;
    
    class UI_Layer,Agent_Layer,RAG_Engine,BKT_Engine,Data_Layer layerStyle;
    class Web,Mobile,Dashboards,Orchestrator,Evaluator,GenAgent,Tracker,Textbooks,OCR,Chunks,Embeddings,FAISS,PCBKT,LSTM,Ensemble,DashData compStyle;
    class MongoDB dbStyle;
    class FastAPI gateStyle;
```

---

## Fig. 2: Hybrid-BKT Personalisation Engine Architecture

This diagram details the parallel execution paths of the PC-BKT and BKT-LSTM branches and their weighted integration, ensuring both structural domain dependency and deep sequential context are captured.

```mermaid
flowchart TD
    %% Input Sequence
    Input["Student Interaction Sequence at Timestep (t)"]
    
    %% Branch A: PC-BKT
    subgraph PC_BKT_Branch ["Branch A: Personalised Clustered BKT (PC-BKT)"]
        direction TB
        HistoryA["Response Correctness History"]
        CapMatrix["Capability Matrix B ∈ ℝ^(N×Kc)<br/>(Proportion of Correct Answers per KC)"]
        Clustering["K-Means++ Clustering (K = 3)<br/>(High, Medium, Low Ability Groups)"]
        Priors["Personalised Mastery Priors P(L₀)<br/>(Calculated via Correct First Attempt [CFA] Rates)"]
        MLE["MLE Parameters Estimation<br/>(Guess P(G), Slip P(S), Transition P(T))"]
        StandardBKT["Bayesian Update Equations"]
        
        HistoryA --> CapMatrix --> Clustering
        Clustering --> Priors
        Clustering --> MLE
        Priors & MLE --> StandardBKT
        StandardBKT --> PPC["Estimated Mastery Prior:<br/>P_PC-BKT(t)"]
    end

    %% Cold Start Block
    ColdStart["Diagnostic Pre-Quiz (Cold-Start)<br/>(Assigns Student to Nearest Cluster Average Prior)"]
    ColdStart -.-> Clustering

    %% Branch B: BKT-LSTM
    subgraph LSTM_Branch ["Branch B: BKT-LSTM Temporal Predictor"]
        direction TB
        HistoryB["Interaction History Sequence"]
        Features["Feature Extraction f(t):<br/>• Current BKT Mastery P(L)_BKT<br/>• Normalised KC Difficulty d_kc<br/>• Correctness Indicator c_t ∈ {0,1}<br/>• Cumulative Attempt Count a_t"]
        StackedLSTM["Stacked 2-Layer LSTM<br/>• 128 Hidden Units per Layer<br/>• Dropout = 0.3<br/>• Input window = 10 interactions"]
        BCE["Binary Cross-Entropy Loss Optimization"]
        
        HistoryB --> Features --> StackedLSTM --> BCE --> PLSTM["Estimated Mastery Prior:<br/>P_LSTM(t)"]
    end

    %% Merge Block
    subgraph Ensemble_Merge ["Weighted Ensemble Module"]
        direction TB
        Formula["Ensemble Integration Formula:<br/>P_hybrid(t) = α · P_PC-BKT(t) + (1 - α) · P_LSTM(t)<br/>(Optimised via Grid Search: α = 0.65)"]
        Phybrid["Final Mastery Probability P_hybrid(t)"]
        
        Formula --> Phybrid
    end

    %% Outputs
    AdaptiveContent["Adaptive Content Delivery & Tier Classification<br/>• Beginner (P_hybrid < 0.60)<br/>• Intermediate (0.60 ≤ P_hybrid < 0.85)<br/>• Advanced (P_hybrid ≥ 0.85)"]

    %% Flow lines
    Input --> HistoryA
    Input --> HistoryB
    PPC --> Formula
    PLSTM --> Formula
    Phybrid --> AdaptiveContent

    %% Styling
    classDef inputStyle fill:#fff9db,stroke:#f59f00,stroke-width:2px;
    classDef branchAStyle fill:#ebfbee,stroke:#40c057,stroke-width:1.5px;
    classDef branchBStyle fill:#e3fafc,stroke:#15aabf,stroke-width:1.5px;
    classDef mergeStyle fill:#fff0f6,stroke:#e64980,stroke-width:2px;
    classDef outputStyle fill:#f3f0ff,stroke:#7950f2,stroke-width:2px;
    
    class Input inputStyle;
    class HistoryA,CapMatrix,Clustering,Priors,MLE,StandardBKT,PPC,ColdStart branchAStyle;
    class HistoryB,Features,StackedLSTM,BCE,PLSTM branchBStyle;
    class Formula,Phybrid mergeStyle;
    class AdaptiveContent outputStyle;
```

---

## Fig. 3: Adaptive Assessment Cycle Flowchart

This flowchart maps the four-phase cyclic progression of student assessment, scaffolding classification, and advancement criteria, complete with pedagogical thresholds.

```mermaid
flowchart TD
    Start([Student Starts Target KC]) --> Phase1

    %% Phase 1: Pre-Assessment
    subgraph Phase1_Block ["Phase 1: Pre-Assessment"]
        Phase1["Diagnostic Pre-Quiz on Target KC"]
        Blooms["3 cognitive levels assessed:<br/>1. Remember (Knowledge)<br/>2. Understand (Comprehension)<br/>3. Apply (Implementation)"]
        Phase1 --> Blooms
    end

    %% Phase 2: Adaptive Tiering
    subgraph Phase2_Block ["Phase 2: Adaptive Content Generation"]
        Evaluate["Evaluator Agent evaluates current P_hybrid(t)"]
        Decision{P_hybrid Thresholds}
        
        Beginner["Beginner Tier (P_hybrid < 0.60)<br/>• Foundational definitions<br/>• Visual worked examples<br/>• Heavily guided practice"]
        Intermediate["Intermediate Tier (0.60 ≤ P_hybrid < 0.85)<br/>• Standard textbook lessons<br/>• Scaffolding exercises<br/>• Interactive quizzes"]
        Advanced["Advanced Tier (P_hybrid ≥ 0.85)<br/>• Enrichment content<br/>• Higher-order analysis<br/>• National Exam past-papers"]
        
        Evaluate --> Decision
        Decision -->|< 0.60| Beginner
        Decision -->|0.60 to 0.85| Intermediate
        Decision -->|≥ 0.85| Advanced
    end

    %% Phase 3: Post-Assessment & Logic
    subgraph Phase3_Block ["Phase 3: Post-Assessment & Logic"]
        PostQuiz["Post-Quiz of Equivalent Difficulty"]
        UpdateEval["Re-calculate Updated Mastery P_hybrid(t+1)"]
        PostDecision{Advancement Threshold}
        
        Pass["Advance to Next KC"]
        Repeat["Repeat KC with Alternative Content"]
        Remedial["Remedial Path (Simplified Explanations)"]
        
        PostQuiz --> UpdateEval --> PostDecision
        PostDecision -->|P_hybrid ≥ 0.85| Pass
        PostDecision -->|0.60 ≤ P_hybrid < 0.85| Repeat
        PostDecision -->|P_hybrid < 0.60| Remedial
    end

    %% Phase 4: Continuous Adaptation
    subgraph Phase4_Block ["Phase 4: Continuous Adaptation"]
        LogTelemetry["Update Capability Matrix B in MongoDB"]
        RetrainClust{"Weekly OR 50<br/>New Interactions?"}
        RetrainKMeans["Retrain K-Means++ Clustering"]
        NoRetrain["Maintain Cluster Assignation"]
        
        LogTelemetry --> RetrainClust
        RetrainClust -->|Yes| RetrainKMeans
        RetrainClust -->|No| NoRetrain
    end

    %% Loops & Flow Connections
    Blooms --> Evaluate
    Beginner & Intermediate & Advanced --> PostQuiz
    
    Pass --> LogTelemetry
    Repeat --> LogTelemetry
    Remedial --> LogTelemetry
    
    RetrainKMeans & NoRetrain --> CheckNext{All KCs Completed?}
    CheckNext -->|Yes| Complete([Course Completed])
    CheckNext -->|No| NextKC[Load Next KC Diagnostics] --> Phase1

    %% Styling
    classDef startStyle fill:#e6fcf5,stroke:#099268,stroke-width:2px;
    classDef p1Style fill:#fff4e6,stroke:#fd7e14,stroke-width:1.5px;
    classDef p2Style fill:#edf2ff,stroke:#4c6ef5,stroke-width:1.5px;
    classDef p3Style fill:#f8f0fc,stroke:#be4bdb,stroke-width:1.5px;
    classDef p4Style fill:#f1f3f5,stroke:#868e96,stroke-width:1.5px;
    
    class Start,Complete startStyle;
    class Phase1,Blooms,NextKC p1Style;
    class Evaluate,Decision,Beginner,Intermediate,Advanced p2Style;
    class PostQuiz,UpdateEval,PostDecision,Pass,Repeat,Remedial p3Style;
    class LogTelemetry,RetrainClust,RetrainKMeans,NoRetrain,CheckNext p4Style;
```

---

## Fig. 4: Retrieval-Augmented Generation (RAG) Pipeline

This diagram shows the 3-stage RAG data ingestion, embedding, FAISS indexing, context retrieval, prompt template construction, and SinLlama text generation process.

```mermaid
flowchart TD
    %% Stage 1: Ingestion
    subgraph Ingestion ["Stage 1: Document Ingestion"]
        Source["Grade 11 Buddhism Textbooks & Teacher Guides"]
        OCR["OCR Processing & Document Extraction"]
        Verify["Manual Quality Verification & Correction"]
        Chunker["Context-Preserving Text Chunking<br/>(512 tokens with 64-token overlap)"]
        
        Source --> OCR --> Verify --> Chunker
    end

    %% Stage 2: Indexing
    subgraph Indexing ["Stage 2: Embedding & Indexing"]
        Embedder["paraphrase-multilingual-MiniLM-L12-v2<br/>(Sentence Transformer)"]
        Vectors["384-Dimensional Dense Vectors"]
        FAISS["FAISS Flat L2 Vector Database<br/>(Efficient Similarity Index)"]
        
        Chunker --> Embedder --> Vectors --> FAISS
    end

    %% Stage 3: Retrieval & Generation
    subgraph Generation ["Stage 3: Retrieval & Generation"]
        Query["Student Query / Learning Activity Request"]
        QueryEmbed["Embed Query using paraphrase-multilingual-MiniLM-L12-v2"]
        FAISSSearch["FAISS Flat L2 Similarity Search"]
        TopChunks["Retrieve Top-5 Context Chunks"]
        
        StudentMeta["Student Metadata:<br/>• Current KC<br/>• Mastery Level P_hybrid<br/>• Instructional Tier (Beginner/Int/Adv)"]
        
        PromptTemplate["Mastery-Aware Prompt Template Builder<br/>• Retrieved Context (Top-5 Chunks)<br/>• Instructional Tier Guidelines<br/>• Syllabus Constraint Directives"]
        
        SinLlama["Fine-Tuned SinLlama (7B) LLM<br/>(QLoRA Buddhism Fine-Tuned Model)"]
        Response["Syllabus-Grounded Sinhala Educational Response"]
        
        Query --> QueryEmbed --> FAISSSearch --> TopChunks --> PromptTemplate
        StudentMeta --> PromptTemplate
        PromptTemplate --> SinLlama --> Response
        FAISS --> FAISSSearch
    end

    %% Styling
    classDef stage1 fill:#ebfbee,stroke:#40c057,stroke-width:1.5px;
    classDef stage2 fill:#e8f4fd,stroke:#1d72b8,stroke-width:1.5px;
    classDef stage3 fill:#fdf2f2,stroke:#d43f3a,stroke-width:1.5px;
    classDef finalStyle fill:#fff9db,stroke:#f59f00,stroke-width:2px;
    
    class Source,OCR,Verify,Chunker stage1;
    class Embedder,Vectors,FAISS stage2;
    class Query,QueryEmbed,FAISSSearch,TopChunks,StudentMeta,PromptTemplate,SinLlama stage3;
    class Response finalStyle;
```

---

## Fig. 5: Multi-Agent Workflow (LangGraph State Transitions)

This state transition graph visualizes the LangGraph agent coordination engine, illustrating the shared state parameters, agent boundaries, and data synchronization patterns.

```mermaid
flowchart TD
    %% Shared State
    subgraph SharedState ["LangGraph Shared State Object"]
        StateVars["State Variables:<br/>• student_id (str)<br/>• current_kc (str)<br/>• active_tier (Enum: Beg/Int/Adv)<br/>• p_hybrid_history (List[float])<br/>• latest_response_correctness (bool)<br/>• content_buffer (List[str])<br/>• active_quiz_score (float)"]
    end

    %% Orchestrator Node
    Orchestrator["Orchestrator Agent<br/>(Supervisor & Routing Logic)"]

    %% Student Input Trigger
    StudentAction([Student Input Event]) --> Orchestrator
    
    %% Routing
    Orchestrator --> Routes{Check Current State}

    %% Agents
    subgraph Evaluator_Agent ["Evaluator Agent Node"]
        direction TB
        RecvScore["Receive Assessment Score"]
        ComputeBKT["Run PC-BKT + BKT-LSTM Ensemble"]
        UpdateMastery["Update P_hybrid(t) in State"]
        ClassifyTier["Assign Adaptive Tier<br/>• Beginner (<0.60)<br/>• Intermediate (0.60 to 0.85)<br/>• Advanced (≥0.85)"]
        
        RecvScore --> ComputeBKT --> UpdateMastery --> ClassifyTier
    end

    subgraph Content_Generator ["Content Generator Agent Node"]
        direction TB
        ReadTier["Read current_kc & active_tier"]
        QueryRAG["Query RAG (FAISS DB) for syllabus text"]
        GenContent["Generate Personalized Lessons / Quizzes"]
        FillBuffer["Update content_buffer in State"]
        
        ReadTier --> QueryRAG --> GenContent --> FillBuffer
    end

    subgraph Progress_Tracker ["Progress Tracker Agent Node"]
        direction TB
        ExtractTelemetry["Extract Telemetry & Interaction History"]
        DBWrite["Persist to MongoDB Logs"]
        Broadcast["Update Teacher & Parent Dashboards"]
        
        ExtractTelemetry --> DBWrite --> Broadcast
    end

    %% Route Paths
    Routes -->|Quiz Finished| Evaluator_Agent
    Routes -->|Lesson Needed| Content_Generator
    Routes -->|Log & Monitor| Progress_Tracker

    %% State Read/Write Sync
    Evaluator_Agent <-->|Update State Variables| SharedState
    Content_Generator <-->|Read State / Write Content| SharedState
    Progress_Tracker -->|Read Telemetry| SharedState

    %% Loops back to Orchestrator
    Evaluator_Agent -->|Sync Completed| Orchestrator
    Content_Generator -->|Deliver Content to UI| ClientReturn([Return API Response to Frontend])
    Progress_Tracker -->|Sync Completed| Orchestrator

    %% Styling
    classDef stateStyle fill:#f3f0ff,stroke:#7950f2,stroke-width:2px;
    classDef supervisorStyle fill:#fff0f6,stroke:#e64980,stroke-width:2px;
    classDef evalStyle fill:#edf2ff,stroke:#4c6ef5,stroke-width:1.5px;
    classDef genStyle fill:#e6fcf5,stroke:#099268,stroke-width:1.5px;
    classDef trackStyle fill:#fff9db,stroke:#f59f00,stroke-width:1.5px;
    
    class SharedState,StateVars stateStyle;
    class Orchestrator,Routes supervisorStyle;
    class Evaluator_Agent,RecvScore,ComputeBKT,UpdateMastery,ClassifyTier evalStyle;
    class Content_Generator,ReadTier,QueryRAG,GenContent,FillBuffer genStyle;
    class Progress_Tracker,ExtractTelemetry,DBWrite,Broadcast trackStyle;
```
