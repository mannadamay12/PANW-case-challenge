# **MindScribe Technical Documentation**

## **01\. System Architecture**

### **1.1 Application Overview**

MindScribe is a **Local-First** AI journaling application designed to run entirely on the user's device (Edge AI). It eliminates the privacy risks associated with cloud-based mental health tools by executing the entire Machine Learning (ML) pipeline—inference, embedding generation, and vector retrieval—locally. The system acts as an empathetic companion, utilizing Small Language Models (SLMs) for dialogue and Retrieval-Augmented Generation (RAG) for long-term memory.

### **1.2 Technology Stack**

| Layer | Component | Technology | Description |
| :---- | :---- | :---- | :---- |
| **Frontend** | UI/UX | **React, TypeScript** | Built within the Tauri WebView (WebView2 on Windows, WebKit on macOS). |
| **Backend** | Orchestration | **Rust** | Handles file I/O, database management, and process lifecycle (sidecars) with high memory efficiency. |
| **ML Engine** | Inference | **Ollama / llama.cpp** | Bundled as a "Sidecar" binary to run SLMs (Gemma 2, Phi-3.5) via a local HTTP server. |
| **ML Engine** | Embeddings | **Candle** | Hugging Face's Rust-native ML framework for running embedding models and sentiment analysis in-process. |
| **Database** | Storage | **SQLite \+ sqlite-vec** | Single-file relational database with a vector search extension for RAG, residing locally. |
| **Infra** | Runtime | **Tauri v2** | Lightweight application shell that bridges the web frontend with the Rust backend. |

### **1.3 High-Level Architecture Diagram**

The following diagram illustrates the separation of concerns between the UI, the Rust Core, and the AI Sidecars.

## **02\. Database Schema**

The database utilizes **SQLite** extended with **sqlite-vec**. All data is stored in a single .db file protected by SQLCipher encryption.

### **2.1 Core Tables**

#### **Table: journals**

Stores the raw text of user entries.

SQL

CREATE TABLE journals (  
    id TEXT PRIMARY KEY,           \-- UUID  
    content TEXT NOT NULL,         \-- The encrypted journal entry text  
    created\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP DEFAULT CURRENT\_TIMESTAMP,  
    is\_archived BOOLEAN DEFAULT 0  
);

#### **Table: journal\_emotions**

Stores the output of the DistilBERT sentiment analysis classification.

SQL

CREATE TABLE journal\_emotions (  
    id INTEGER PRIMARY KEY AUTOINCREMENT,  
    journal\_id TEXT,  
    emotion\_label TEXT,            \-- e.g., 'Anxiety', 'Joy' (from GoEmotions taxonomy)  
    confidence\_score REAL,         \-- Probability (0.0 \- 1.0)  
    FOREIGN KEY(journal\_id) REFERENCES journals(id) ON DELETE CASCADE  
);

#### **Virtual Table: vec\_entries**

Used by sqlite-vec for semantic search.

SQL

CREATE VIRTUAL TABLE vec\_entries USING vec0(  
    journal\_id TEXT,  
    embedding float\[384\]           \-- 384-dim vector from all-MiniLM-L6-v2  
);

### **2.2 Relationships Summary**

* **1:N (One-to-Many):** journals.id ↔ journal\_emotions.journal\_id. A single journal entry may contain multiple dominant emotions (e.g., *Fear* and *Sadness*).  
* **1:1 (One-to-One):** journals.id ↔ vec\_entries.journal\_id. Every text chunk in the journal table corresponds to a vector embedding in the virtual table for RAG retrieval.

## ---

**03\. API Specifications**

Since MindScribe is a local app, "APIs" refer to the **Internal IPC (Inter-Process Communication)** exposed by the Rust backend to the React frontend, and the **Local Inference API** provided by the sidecar.

### **3.1 Authentication**

* **Mechanism:** No network authentication. Access is controlled via **Local Encryption Key** derivation (User Password \-\> Key) to unlock the SQLCipher database at runtime.

### **3.2 Base URL**

* **Inference API:** http://127.0.0.1:{dynamic\_port}/v1 (Port is dynamically assigned by Rust at startup to avoid conflicts).  
* **IPC:** window.\_\_TAURI\_\_.invoke('{command\_name}')

### **3.3 Core Endpoints (Tauri Commands)**

**Command: create\_entry**

* **Input:** { content: string }  
* **Process:**  
  1. Save text to journals.  
  2. Run in-process Candle inference for sentiment \-\> Save to journal\_emotions.  
  3. Run in-process Candle embedding \-\> Save to vec\_entries.  
* **Output:** { status: "success", id: "uuid" }

**Command: chat\_stream**

* **Input:** { message: string, history: Message\[\] }  
* **Process:**  
  1. Perform Hybrid Search (FTS5 \+ Vector) on journals.  
  2. Construct System Prompt with retrieved context.  
  3. Forward request to Local Inference API (/v1/chat/completions).  
* **Output:** Stream\<String\> (Token stream).

### **3.4 Error Responses**

* **Model Not Loaded:** { "code": "MODEL\_OFFLINE", "message": "The AI sidecar is initializing. Please wait." }  
* **Safety Violation:** { "code": "SAFETY\_INTERVENTION", "message": "Self-harm detected. Providing resources." }.

### **3.5 Rate Limiting**

* **Concept:** Not applicable via network.  
* **Throttling:** The Rust backend implements a **Mutex Lock** on the inference endpoint to prevent parallel requests from crashing the SLM due to VRAM exhaustion.

## ---

**04\. Integration Requirements**

* **Sidecar (Internal):** The llama-server binary must be bundled inside the application installer. The tauri.conf.json must map this binary to the externalBin configuration.  
* **Hugging Face (External):** Used **only** for downloading model weights (.gguf) during the initial setup wizard.  
  * *Endpoint:* https://huggingface.co/api/models  
  * *Policy:* User must explicitly approve the download.

## ---

**05\. Data Synchronization**

MindScribe follows a **"Local-Only"** policy. However, internal state synchronization is critical.

### **5.1 Offline Support (Architecture Default)**

Since the app is local-first, "Offline Mode" is the default state.

* **No Cloud Sync:** User data is never transmitted to a cloud server.  
* **Backup Sync:** Users can manually export an encrypted backup file (mindscribe\_backup.enc).

### **5.2 Background Sync (Internal)**

* **Vector Re-indexing:** If the embedding model is updated, a background task in Rust re-processes all journals entries to update vec\_entries.  
* **Model Updates:** The app checks for model updates (e.g., Gemma 2 v1.1) on launch.  
  * *Frequency:* Weekly check (requires user opt-in).  
  * *Action:* Notification badge on "Settings" if a better optimized GGUF is available.

## ---

**06\. Security and Compliance**

### **6.1 Authentication and Authorization**

* **App Lock:** Optional PIN/Biometric lock (via OS native APIs) required to open the app window.  
* **Network Isolation:** tauri.conf.json Allowlist restricts HTTP traffic strictly to update servers. All other domains are blocked.

### **6.2 Data Encryption**

* **At Rest:** The SQLite database is encrypted using **SQLCipher**. The key is derived from the user's master password using Argon2id.  
* **In Transit:** Not applicable (no data leaves localhost).

### **6.3 GDPR Compliance**

* **Data Sovereignty:** Fully compliant by design. The user is the Data Controller and Data Processor.  
* **Right to be Forgotten:** A "Nuke Data" feature permanently deletes the .db file and associated model weights.

### **6.4 PCI Compliance**

* **Status:** Not Applicable. MindScribe does not process payments.

## ---

**07\. Performance Requirements**

### **7.1 Response Time Targets**

* **Chat Latency (TTFT \- Time To First Token):** \< 800ms on M1/M2/M3 chips; \< 1.5s on generic Intel/AMD CPUs.  
* **Generation Speed:** Minimum 20 tokens/second to maintain conversational flow.  
* **Sentiment Analysis:** \< 50ms per sentence (running on CPU via ort or candle).

### **7.2 Scalability Targets (Local)**

* **Context Window:** Up to 8k tokens for Gemma 2 (Chat) and 128k tokens for Phi-3.5 (Analysis).  
* **Vector Store:** Optimized for up to 100,000 journal entries (approx. 10 years of daily journaling) using exact KNN search before performance degrades.

### **7.3 Database Optimization**

* **WAL Mode:** SQLite Write-Ahead Logging enabled for concurrent read/write.  
* **Virtual Table:** sqlite-vec runs in memory-mapped mode where possible for speed.

## ---

**08\. Monitoring and Logging**

### **8.1 Application Monitoring**

* **Tools:** Rust log crate \+ Custom Panic Hook.  
* **Key Metrics (Internal Dashboard):**  
  * *Inference Speed (tokens/sec).*  
  * *RAM Usage (Sidecar).*  
  * *Storage consumed by DB.*

### **8.2 Logging Standards**

* **Log Levels:**  
  * INFO: App lifecycle events (Start, Stop, Update).  
  * ERROR: Sidecar crashes, DB corruption.  
* **Sensitive Data Masking:** **STRICT.** User input (journal text) and Model output MUST NEVER be written to application logs. Logs should only record metadata (e.g., "Entry created", "Inference failed").  
* **Format:** JSON structured logging for easy debugging.

## ---

**09\. Testing Requirements**

### **9.1 Unit Testing**

* **Target Coverage:** 80% on Rust Backend.  
* **Critical Components:**  
  * DatabaseManager: Ensure encryption/decryption works reliably.  
  * SidecarController: Ensure process spawning/killing handles zombie processes correctly.  
  * SentimentParser: Validate DistilBERT output mapping.

### **9.2 Integration Testing**

* **Scenarios:**  
  * Start app \-\> Check Sidecar health \-\> Load Model \-\> Send "Hello" \-\> Receive Response.  
  * Create Entry \-\> Verify Vector created in vec\_entries \-\> Verify Emotion in journal\_emotions.

### **9.3 E2E Testing**

* **Tool:** Playwright (for Tauri).  
* **User Journeys:**  
  * Onboarding Wizard (Model Download).  
  * Daily Journaling flow.  
  * "Emergency" trigger flow (typing trigger words).

### **9.4 Performance Testing**

* **Stress Test:** Rapidly sending 50 messages to the inference engine to ensure the queue system prevents crash.

## ---

**10\. Deployment & CI/CD**

### **10.1 Deployment Strategy**

* **Environment:** GitHub Actions (Matrix build: macOS, Windows, Linux).  
* **Artifacts:** .dmg (macOS), .msi (Windows), .deb (Linux).  
* **Sidecar Handling:** CI script downloads the llama-server binary and places it in the src-tauri/bin directory before compilation.

### **10.2 DB Migrations**

* **Tool:** sqlx-cli or rusqlite embedded migrations.  
* **Process:** Applied automatically on app startup.  
* **Rollback:** Automatic database backup created (db.bak) before applying any migration.

### **10.3 Feature Flags**

* **System:** Local configuration file (flags.json), not remote.  
* **Key Flags:**  
  * enable\_experimental\_models: Allows users to swap Gemma 2 for experimental GGUFs.  
  * verbose\_logging: Developer mode.

## ---

**11\. Edge Cases and Error Handling**

| Scenario | Problem | Solution |
| :---- | :---- | :---- |
| **Model Crash** | The llama-server process dies (OOM or bug). | Rust Child monitor detects exit code. Backend automatically restarts the process and informs frontend to "Retrying...". |
| **Safety Trigger** | User expresses self-harm intent. | Regex/Sentiment filter intercepts request *before* LLM. Hard-coded modal displays help resources. LLM is NOT queried. |
| **First Run Offline** | User installs app but has no internet for model download. | App enters "Lite Mode" (Journaling only, no AI). Persists a banner: "Connect to internet to enable AI features." |
| **Database Corruption** | SQLite file unreadable. | App attempts to restore from the last automatic .bak. If fails, prompts user to "Reset Database." |

## ---

**12\. Future Considerations**

### **12.1 Planned Features (Not in MVP)**

* **Voice Journaling:** Integration with Whisper.cpp (also running locally) for speech-to-text.  
* **Mobile Companion:** A simplified mobile app that syncs *locally* via peer-to-peer Wi-Fi (no cloud) to the desktop app.

### **12.2 Scalability Roadmap**

* **NPU Support:** Official support for Neural Processing Units (NPUs) in newer Intel/AMD chips to reduce battery drain.  
* **LoRA Adapters:** Allow users to "fine-tune" the style of their companion by training a small LoRA adapter locally on their past journals.

## ---

**APPENDIX**

### **A. Glossary**

* **RAG (Retrieval-Augmented Generation):** The technique of fetching user data to give the AI context.  
* **Sidecar:** A secondary process (the AI engine) managed by the main application.  
* **GGUF:** The file format used for quantized (compressed) AI models.  
* **Quantization:** Reducing the precision of model weights (e.g., 4-bit) to save RAM.

### **B. External Dependencies**

* llama-server (v0.1.x)  
* sqlite-vec (v0.1.0)  
* distilbert-base-uncased-go-emotions-student (ONNX/Candle)

### **C. API Versioning Strategy**

* Internal IPC commands are versioned by the application release (Semantic Versioning). Breaking changes in the Rust backend require a mandatory frontend update (handled by the single-binary distribution model).