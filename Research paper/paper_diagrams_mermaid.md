# 📊 System Architecture Diagram (V8 Edition)

This is the updated Mermaid diagram code reflecting the 6-layer architecture, 7 LangGraph agents, dual LLM approach, Hybrid-BKT engine, ChromaDB RAG, and interactive Avatar.

```mermaid
graph TD
    %% Styling
    classDef ui fill:#4F46E5,stroke:#312E81,stroke-width:2px,color:#fff;
    classDef api fill:#059669,stroke:#064E3B,stroke-width:2px,color:#fff;
    classDef agent fill:#D97706,stroke:#78350F,stroke-width:2px,color:#fff;
    classDef bkt fill:#7C3AED,stroke:#4C1D95,stroke-width:2px,color:#fff;
    classDef rag fill:#2563EB,stroke:#1E3A8A,stroke-width:2px,color:#fff;
    classDef db fill:#DC2626,stroke:#7F1D1D,stroke-width:2px,color:#fff;
    
    subgraph L1 ["1. User Interface Layer (Web & Mobile)"]
        UI1["Student Interface\n(Next.js)"]
        UI2["Teacher Dashboard\n(Next.js)"]
        UI3["Parent App\n(React Native)"]
        Avatar["Interactive AI Avatar\n(WebRTC + Gemini TTS)"]
        Chatbot["RAG Chatbot"]
        
        UI1 --- Avatar
        UI1 --- Chatbot
    end

    subgraph L2 ["2. REST API Gateway"]
        API["FastAPI Gateway\n(Auth, Role-Based Routing)"]
    end

    subgraph L3 ["3. Multi-Agent AI Layer (LangGraph)"]
        Orchestrator{"Orchestrator Node\n(Llama-3.3-70B)"}
        A1["Evaluator Agent"]
        A2["Personalisation Agent"]
        A3["Content Generator"]
        A4["Quiz Agent"]
        A5["Explain Agent"]
        A6["Progress Tracker"]
        A7["Decision Node"]
        
        Orchestrator <--> A1
        Orchestrator <--> A2
        Orchestrator <--> A3
        Orchestrator <--> A4
        Orchestrator <--> A5
        Orchestrator <--> A6
        Orchestrator <--> A7
    end

    subgraph L4 ["4. RAG-Based Knowledge Engine"]
        RAG["Retriever\n(multilingual-e5-base)"]
        LLM["Generation\n(SinLlama-7B)"]
    end

    subgraph L5 ["5. Hybrid-BKT Personalisation Engine"]
        BKT["PC-BKT Model"]
        LSTM["BKT-LSTM Model"]
        Fusion["Hybrid Fusion (α = 0.665)\n+ Feedback Correction"]
        
        BKT --> Fusion
        LSTM --> Fusion
    end

    subgraph L6 ["6. Persistent Data Layer"]
        DB[(MongoDB\nUser/Progress/QA)]
        VDB[(ChromaDB\nVector Store)]
    end
    
    %% Cross-layer Connections
    UI1 <--> API
    UI2 <--> API
    UI3 <--> API
    API <--> Orchestrator
    
    %% Agent to Engine Connections
    A2 <--> Fusion
    A3 <--> RAG
    A4 <--> RAG
    A5 <--> LLM
    
    Avatar <-. "Audio Stream" .-> A5
    RAG <--> VDB
    LLM <--> VDB
    
    %% DB Connections
    A6 <--> DB
    Fusion <--> DB
    API <--> DB
    
    %% Apply classes
    class UI1,UI2,UI3,Avatar,Chatbot ui;
    class API api;
    class Orchestrator,A1,A2,A3,A4,A5,A6,A7 agent;
    class BKT,LSTM,Fusion bkt;
    class RAG,LLM rag;
    class DB,VDB db;
```
