# MindScribe Technical Documentation

## 01. System Architecture

### 1.1 Application Overview

MindScribe is a **Local-First** AI journaling application designed to run entirely on the user's device (Edge AI). It eliminates the privacy risks associated with cloud-based mental health tools by executing the entire Machine Learning (ML) pipeline—inference, embedding generation, and vector retrieval—locally. The system acts as an empathetic companion, utilizing Small Language Models (SLMs) for dialogue and Retrieval-Augmented Generation (RAG) for long-term memory.

### 1.2 Technology Stack

| Layer | Component | Technology | Description |
|-------|-----------|------------|-------------|
| **Frontend** | UI/UX | React 19, TypeScript | Built within the Tauri WebView (WebView2 on Windows, WebKit on macOS) |
| **Frontend** | State | TanStack Query, Zustand | Server state + client state separation |
| **Backend** | Orchestration | Rust | Handles file I/O, database management, and ML coordination |
| **ML Engine** | Inference | Ollama | Local LLM server running Gemma 3 4B |
| **ML Engine** | Embeddings | Candle | Rust-native ML for all-MiniLM-L6-v2 embeddings |
| **ML Engine** | Sentiment | Candle | DistilBERT GoEmotions classifier (28 emotions) |
| **Database** | Storage | SQLite + sqlite-vec | Single-file database with vector search extension |
| **Infra** | Runtime | Tauri v2 | Lightweight application shell bridging web frontend with Rust backend |

### 1.3 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Tauri Shell                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   React Frontend    │    │        Rust Backend             │ │
│  │  ┌───────────────┐  │    │  ┌─────────────────────────┐    │ │
│  │  │ TanStack Query│◄─┼────┼──│   Tauri Commands        │    │ │
│  │  └───────────────┘  │    │  └─────────────────────────┘    │ │
│  │  ┌───────────────┐  │    │  ┌─────────────────────────┐    │ │
│  │  │   Zustand     │  │    │  │   SQLite + sqlite-vec   │    │ │
│  │  └───────────────┘  │    │  └─────────────────────────┘    │ │
│  │  ┌───────────────┐  │    │  ┌─────────────────────────┐    │ │
│  │  │   Components  │  │    │  │   Candle ML Models      │    │ │
│  │  └───────────────┘  │    │  └─────────────────────────┘    │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │  Ollama Server  │
                            │  (localhost)    │
                            └─────────────────┘
```

---

## 02. Database Schema

The database utilizes **SQLite** extended with **sqlite-vec** for vector similarity search. All data is stored in a single `.db` file in the user's app data directory.

### 2.1 Core Tables

#### Table: journals

Primary storage for journal entries.

```sql
CREATE TABLE journals (
    id TEXT PRIMARY KEY,              -- UUID v4
    content TEXT NOT NULL,            -- Journal entry text (markdown)
    title TEXT,                       -- Auto-generated or user title
    entry_type TEXT DEFAULT 'reflection',  -- 'reflection', 'gratitude', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT 0
);

CREATE INDEX idx_journals_archived ON journals(is_archived);
CREATE INDEX idx_journals_created ON journals(created_at DESC);
```

#### Table: journal_emotions

Stores sentiment analysis results (GoEmotions taxonomy).

```sql
CREATE TABLE journal_emotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_id TEXT NOT NULL,
    emotion_label TEXT NOT NULL,      -- e.g., 'joy', 'anxiety', 'gratitude'
    confidence_score REAL NOT NULL,   -- Probability (0.0 - 1.0)
    FOREIGN KEY(journal_id) REFERENCES journals(id) ON DELETE CASCADE
);

CREATE INDEX idx_journal_emotions_journal_id ON journal_emotions(journal_id);
```

#### Table: chat_messages

Per-entry conversation history with AI companion.

```sql
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,              -- UUID v4
    journal_id TEXT NOT NULL,         -- Links to journals.id
    role TEXT NOT NULL,               -- 'user' or 'assistant'
    content TEXT NOT NULL,            -- Message text
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,                    -- Optional JSON metadata
    FOREIGN KEY(journal_id) REFERENCES journals(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_messages_journal ON chat_messages(journal_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
```

#### Table: journal_templates

Pre-built journaling prompts and templates.

```sql
CREATE TABLE journal_templates (
    id TEXT PRIMARY KEY,              -- UUID v4
    title TEXT NOT NULL,              -- Template name
    prompt TEXT NOT NULL,             -- Guiding question
    template_text TEXT NOT NULL,      -- Starting text for entry
    icon TEXT,                        -- Icon identifier
    category TEXT NOT NULL DEFAULT 'reflection',  -- 'growth', 'mindfulness', etc.
    is_default BOOLEAN DEFAULT 0,     -- System-provided template
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_is_default ON journal_templates(is_default);
CREATE INDEX idx_templates_category ON journal_templates(category);
```

#### Table: entry_images

Inline image attachments for journal entries.

```sql
CREATE TABLE entry_images (
    id TEXT PRIMARY KEY,              -- UUID v4
    entry_id TEXT NOT NULL,           -- Links to journals.id
    filename TEXT NOT NULL,           -- Original filename
    relative_path TEXT NOT NULL,      -- Path relative to app data dir
    mime_type TEXT,                   -- e.g., 'image/png'
    file_size INTEGER,                -- Bytes
    width INTEGER,                    -- Pixels
    height INTEGER,                   -- Pixels
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(entry_id) REFERENCES journals(id) ON DELETE CASCADE
);

CREATE INDEX idx_entry_images_entry_id ON entry_images(entry_id);
```

### 2.2 Virtual Tables

#### journals_fts (Full-Text Search)

FTS5 index synchronized via triggers.

```sql
CREATE VIRTUAL TABLE journals_fts USING fts5(
    content,
    content='journals',
    content_rowid='rowid'
);

-- Triggers: journals_ai (after insert), journals_au (after update), journals_ad (after delete)
```

#### journal_embeddings (Vector Search)

384-dimensional embeddings from all-MiniLM-L6-v2.

```sql
CREATE VIRTUAL TABLE journal_embeddings USING vec0(
    journal_id TEXT PRIMARY KEY,
    embedding FLOAT[384]
);
```

#### chunk_embeddings (Chunk-Level Vectors)

For better RAG on long entries.

```sql
CREATE VIRTUAL TABLE chunk_embeddings USING vec0(
    chunk_id TEXT PRIMARY KEY,
    embedding FLOAT[384]
);
```

### 2.3 Supporting Tables

```sql
-- Embedding version tracking
CREATE TABLE embedding_metadata (
    journal_id TEXT PRIMARY KEY,
    model_version TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE
);

-- Text chunks for long entries
CREATE TABLE embedding_chunks (
    id TEXT PRIMARY KEY,
    journal_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE
);
```

### 2.4 Relationships Summary

| Relationship | Description |
|--------------|-------------|
| journals → journal_emotions | 1:N - Entry has multiple emotions |
| journals → journal_embeddings | 1:1 - Entry has one embedding |
| journals → chat_messages | 1:N - Entry has conversation history |
| journals → entry_images | 1:N - Entry has multiple images |
| journals → embedding_chunks | 1:N - Long entries split into chunks |

---

## 03. API Specifications

MindScribe uses **Tauri IPC** (Inter-Process Communication) for frontend-backend communication. All commands are invoked via `window.__TAURI__.invoke('{command_name}', params)`.

### 3.1 Journal Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `create_entry` | `{ content, title?, entry_type? }` | `{ id }` | Create new journal entry |
| `get_entry` | `{ id }` | `Journal` | Retrieve single entry |
| `list_entries` | `{ limit?, offset?, archived? }` | `Journal[]` | Paginated entry list |
| `update_entry` | `{ id, content?, title?, entry_type? }` | `Journal` | Update entry fields |
| `delete_entry` | `{ id }` | `{ success }` | Permanently delete entry |
| `archive_entry` | `{ id }` | `Journal` | Soft-delete (archive) |
| `unarchive_entry` | `{ id }` | `Journal` | Restore from archive |
| `search_entries` | `{ query, include_archived? }` | `Journal[]` | FTS5 keyword search |

### 3.2 Dashboard Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `get_journal_stats` | - | `JournalStats` | Total entries, streak, week/month counts |
| `get_streak_info` | - | `StreakInfo` | Current/longest streak, week entry dates |
| `get_emotion_trends` | `{ start_date, end_date }` | `DayEmotions[]` | Daily emotion summaries |
| `get_on_this_day` | - | `Journal[]` | Entries from same date in prior years |

### 3.3 Template Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `create_template` | `{ title, prompt, template_text, icon?, category }` | `Template` | Create custom template |
| `get_template` | `{ id }` | `Template` | Get single template |
| `list_templates` | - | `Template[]` | All templates |
| `list_templates_by_category` | `{ category }` | `Template[]` | Filter by category |
| `update_template` | `{ id, title?, prompt?, template_text?, icon?, category? }` | `Template` | Update template |
| `delete_template` | `{ id }` | `{ success }` | Delete template |

### 3.4 Image Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `upload_entry_image` | `{ entry_id, filename, data (base64) }` | `EntryImage` | Upload image for entry |
| `get_entry_images` | `{ entry_id }` | `EntryImage[]` | List images for entry |
| `delete_entry_image` | `{ id }` | `{ success }` | Delete image file and record |
| `get_image_data` | `{ relative_path }` | `string (base64)` | Retrieve image data |

### 3.5 Chat Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `list_entry_messages` | `{ journal_id }` | `ChatMessage[]` | Get conversation for entry |
| `create_chat_message` | `{ journal_id, role, content }` | `ChatMessage` | Add message to conversation |
| `delete_entry_messages` | `{ journal_id }` | `usize` | Clear conversation |
| `chat_stream` | `{ message, history?, journal_id? }` | (events) | Stream chat response |
| `check_message_safety` | `{ text }` | `SafetyResult` | Check for crisis/distress |

**Chat Stream Events:**
- `chat-chunk` - Token received: `{ content: string }`
- `chat-done` - Generation complete: `{ full_response: string }`
- `chat-error` - Error occurred: `{ error: string }`

### 3.6 ML Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `get_model_status` | - | `ModelStatus` | Check if ML models loaded |
| `initialize_models` | - | `()` | Load embedding + sentiment models |
| `get_entry_emotions` | `{ id }` | `EmotionPrediction[]` | Get emotions for entry |
| `hybrid_search` | `{ query, limit?, include_archived? }` | `HybridSearchResult[]` | Semantic + keyword search |
| `generate_entry_embedding` | `{ id }` | `()` | Generate embedding for entry |

### 3.7 LLM Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `check_ollama_status` | - | `OllamaStatus` | Check Ollama running + model available |
| `generate_title` | `{ content }` | `string` | Generate title for entry |
| `generate_missing_titles` | - | `usize` | Batch generate titles |
| `generate_summary` | `{ start_date, end_date }` | `string` | Generate period summary |

### 3.8 Error Responses

| Code | Message | Cause |
|------|---------|-------|
| `MODEL_OFFLINE` | "The AI sidecar is initializing" | ML models not loaded |
| `SAFETY_INTERVENTION` | "Safety check triggered" | Crisis/distress detected |
| `NOT_FOUND` | "Entry not found" | Invalid entry ID |
| `DATABASE_ERROR` | "Database operation failed" | SQLite error |

---

## 04. Data Types

### Journal

```typescript
interface Journal {
  id: string;
  content: string;
  title: string | null;
  entry_type: string;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
  is_archived: boolean;
}
```

### JournalStats

```typescript
interface JournalStats {
  total_entries: number;
  current_streak: number;
  entries_this_week: number;
  entries_this_month: number;
}
```

### StreakInfo

```typescript
interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  last_entry_date: string | null;
  week_entry_dates: string[];
}
```

### EmotionPrediction

```typescript
interface EmotionPrediction {
  label: string;      // e.g., "joy", "anxiety"
  confidence: number; // 0.0 - 1.0
}
```

### ChatMessage

```typescript
interface ChatMessage {
  id: string;
  journal_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  metadata: string | null;
}
```

### SafetyResult

```typescript
interface SafetyResult {
  level: "safe" | "distress" | "crisis";
  message: string | null;
}
```

### OllamaStatus

```typescript
interface OllamaStatus {
  is_running: boolean;
  model_available: boolean;
}
```

---

## 05. Integration Requirements

### 5.1 Ollama (External)

MindScribe requires Ollama for LLM features (chat, title generation, summaries).

- **Default URL:** `http://127.0.0.1:11434`
- **Required Model:** `gemma3:4b`
- **Installation:** User manages via `ollama pull gemma3:4b`
- **Status Detection:** App checks `/api/tags` endpoint on launch

### 5.2 HuggingFace (Model Downloads)

ML models are downloaded from HuggingFace on first use:

| Model | Purpose | Size |
|-------|---------|------|
| `sentence-transformers/all-MiniLM-L6-v2` | Embeddings | ~90MB |
| `joeddav/distilbert-base-uncased-go-emotions-student` | Sentiment | ~268MB |

Models are cached in the app data directory.

---

## 06. Data Synchronization

### 6.1 Offline Support (Default)

MindScribe is local-first. "Offline Mode" is the default state.

- **No Cloud Sync:** User data never transmitted to servers
- **Backup:** Users can manually export database file

### 6.2 Internal Sync

- **FTS Index:** Automatically maintained via SQLite triggers
- **Embeddings:** Generated after entry save (async)
- **Emotions:** Analyzed after entry save (async)

---

## 07. Security and Compliance

### 7.1 Data Protection

| Aspect | Implementation |
|--------|----------------|
| **At Rest** | SQLCipher encryption available (opt-in) |
| **In Transit** | N/A - no data leaves localhost |
| **Network Isolation** | Tauri allowlist restricts HTTP requests |

### 7.2 Privacy Guarantees

- User content never written to logs
- No telemetry or analytics
- Model inference entirely local
- Network access limited to model downloads

### 7.3 GDPR Compliance

- **Data Sovereignty:** User is both Data Controller and Processor
- **Right to Erasure:** "Delete All Data" feature removes database

---

## 08. Performance Requirements

### 8.1 Response Time Targets

| Operation | Target |
|-----------|--------|
| Entry Save | < 100ms |
| FTS Search | < 50ms |
| Hybrid Search | < 200ms |
| Sentiment Analysis | < 50ms per sentence |
| Chat TTFT (Time to First Token) | < 1.5s |
| Chat Generation | > 20 tokens/second |

### 8.2 Resource Limits

| Resource | Limit |
|----------|-------|
| SQLite Database | < 1GB typical |
| Vector Store | ~100,000 entries before degradation |
| Model Memory | ~400MB for ML models |
| Ollama Memory | ~3GB for Gemma 3 4B |

---

## 09. Testing Requirements

### 9.1 Unit Tests (Rust)

**Coverage Target:** 80% on critical paths

| Module | Tests |
|--------|-------|
| `db::journals` | CRUD, search, archive, date queries |
| `db::vectors` | Store, retrieve, similarity search |
| `db::search` | RRF calculation, hybrid search |
| `llm::safety` | Crisis/distress detection |
| `db::chat` | Message CRUD, cascade delete |

### 9.2 Type Checking (TypeScript)

- Strict mode enabled
- Run via `pnpm lint`

### 9.3 Build Verification

```bash
cargo fmt --check      # Rust formatting
cargo clippy           # Rust lints (0 warnings)
cargo test             # Unit tests
pnpm build             # TypeScript compilation
pnpm tauri build       # Full app bundle
```

---

## 10. Deployment

### 10.1 Build Targets

| Platform | Output |
|----------|--------|
| macOS | `.app` bundle, `.dmg` installer |
| Windows | `.msi` installer |
| Linux | `.deb`, `.AppImage` |

### 10.2 Database Location

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/com.mindscribe.app/mindscribe.db` |
| Windows | `%APPDATA%/com.mindscribe.app/mindscribe.db` |
| Linux | `~/.local/share/com.mindscribe.app/mindscribe.db` |

### 10.3 Model Storage

ML models stored in:
- macOS: `~/Library/Application Support/com.mindscribe.app/models/`
- Windows: `%APPDATA%/com.mindscribe.app/models/`

---

## 11. Appendix

### A. GoEmotions Labels (28)

admiration, amusement, anger, annoyance, approval, caring, confusion, curiosity, desire, disappointment, disapproval, disgust, embarrassment, excitement, fear, gratitude, grief, joy, love, nervousness, optimism, pride, realization, relief, remorse, sadness, surprise, neutral

### B. Entry Types

- `reflection` (default)
- `gratitude`
- `growth`
- `mindfulness`
- `morning`

### C. Template Categories

- `reflection`
- `gratitude`
- `growth`
- `mindfulness`
- `morning`
