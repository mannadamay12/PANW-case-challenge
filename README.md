# MindScribe

> A local-first AI journaling companion for mental wellness

MindScribe is a privacy-preserving journaling application that runs AI capabilities entirely on your device. Your thoughts never leave your computer.

## Features

- **Private Journaling** - Auto-saving editor with markdown support and image attachments
- **AI Companion** - Contextual conversations powered by local LLM with RAG-based memory
- **Emotion Tracking** - 28-emotion sentiment analysis using GoEmotions taxonomy
- **Semantic Search** - Find entries by meaning, not just keywords
- **Dashboard Analytics** - Streak tracking, emotion trends, and historical insights
- **Template System** - Pre-built prompts to guide your journaling practice
- **Safety System** - Crisis detection with immediate resource display

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 19, TypeScript, Tailwind CSS, TanStack Query, Zustand |
| Backend | Rust, Tauri v2, SQLite, sqlite-vec |
| ML | Candle (embeddings, sentiment), Ollama (LLM) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.75+
- [pnpm](https://pnpm.io/) 8+
- [Ollama](https://ollama.ai/) (for AI chat features)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mindscribe.git
cd mindscribe

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev
```

### Setting up Ollama (for AI features)

```bash
# Install Ollama (macOS)
brew install ollama

# Start the Ollama server
ollama serve

# Pull the recommended model (~2.5GB)
ollama pull gemma3:4b
```

The app will detect Ollama automatically. If not running, a setup banner will guide you.

## Project Structure

```
mindscribe/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # React Query + custom hooks
│   ├── stores/             # Zustand state management
│   └── types/              # TypeScript definitions
│
├── src-tauri/              # Rust backend
│   └── src/
│       ├── db/             # SQLite + sqlite-vec operations
│       ├── ml/             # Candle ML models
│       └── llm/            # Ollama integration
│
└── docs/                   # Additional documentation
```

## Documentation

- [Design Documentation](DOCUMENTATION.md) - Architecture decisions and technical deep-dive
- [Technical Specs](docs/technical_doc.md) - API specifications and database schema
- [Architecture Blueprint](mindScribe.md) - Original research and design rationale

## Development

```bash
# Run the app in development mode
pnpm tauri dev

# Run Rust tests
cd src-tauri && cargo test

# TypeScript type checking
pnpm lint

# Build for production
pnpm tauri build
```

## Key Design Decisions

1. **Tauri over Electron** - 10MB installer vs 100MB+, lower memory footprint
2. **Local-first architecture** - Zero data egress, GDPR compliant by design
3. **SQLite + sqlite-vec** - Single-file database with vector search, no external services
4. **Ollama integration** - User-managed LLM, avoids 2GB+ installer bloat
5. **Safety-first AI** - Deterministic crisis detection bypasses LLM entirely

## Privacy Guarantees

- All data stored locally in SQLite database
- ML inference runs on-device (no API calls)
- Network access limited to model downloads and app updates
- User content never logged or transmitted

## License

MIT

## Author

Built for the Palo Alto Networks case challenge.
