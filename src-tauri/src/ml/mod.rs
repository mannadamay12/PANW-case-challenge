pub mod embeddings;
pub mod models;
pub mod sentiment;

pub use models::{ModelInfo, EMBEDDING_MODEL, SENTIMENT_MODEL};

use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::error::AppError;
use embeddings::EmbeddingModel;
use sentiment::SentimentModel;

/// ML state wrapper with lazy model loading.
/// Models are loaded on first use and cached for subsequent calls.
#[derive(Clone)]
pub struct MlState {
    models_dir: PathBuf,
    embedding_model: Arc<RwLock<Option<Arc<EmbeddingModel>>>>,
    sentiment_model: Arc<RwLock<Option<Arc<SentimentModel>>>>,
}

impl MlState {
    /// Create a new MlState with the given models directory.
    pub fn new(models_dir: PathBuf) -> Self {
        Self {
            models_dir,
            embedding_model: Arc::new(RwLock::new(None)),
            sentiment_model: Arc::new(RwLock::new(None)),
        }
    }

    /// Check if models are downloaded and ready.
    pub async fn models_ready(&self) -> ModelStatus {
        let embedding_ready =
            models::is_model_downloaded(&self.models_dir, models::EMBEDDING_MODEL);
        let sentiment_ready =
            models::is_model_downloaded(&self.models_dir, models::SENTIMENT_MODEL);

        ModelStatus {
            embedding_downloaded: embedding_ready,
            sentiment_downloaded: sentiment_ready,
            models_dir: self.models_dir.clone(),
        }
    }

    /// Initialize models (download if needed, load into memory).
    /// This is typically called during app startup or on user request.
    pub async fn initialize(&self, on_progress: impl Fn(DownloadProgress)) -> Result<(), AppError> {
        log::info!("Initializing ML models at: {}", self.models_dir.display());

        // Download embedding model if needed
        if !models::is_model_downloaded(&self.models_dir, models::EMBEDDING_MODEL) {
            log::info!("Downloading embedding model...");
            on_progress(DownloadProgress {
                model: "embedding".to_string(),
                stage: "downloading".to_string(),
                progress: 0.0,
            });
            models::download_model(&self.models_dir, models::EMBEDDING_MODEL).await?;
        }

        // Download sentiment model if needed
        if !models::is_model_downloaded(&self.models_dir, models::SENTIMENT_MODEL) {
            log::info!("Downloading sentiment model...");
            on_progress(DownloadProgress {
                model: "sentiment".to_string(),
                stage: "downloading".to_string(),
                progress: 0.0,
            });
            models::download_model(&self.models_dir, models::SENTIMENT_MODEL).await?;
        }

        // Pre-load models
        on_progress(DownloadProgress {
            model: "embedding".to_string(),
            stage: "loading".to_string(),
            progress: 0.5,
        });
        self.get_embedding_model().await?;

        on_progress(DownloadProgress {
            model: "sentiment".to_string(),
            stage: "loading".to_string(),
            progress: 0.5,
        });
        self.get_sentiment_model().await?;

        on_progress(DownloadProgress {
            model: "all".to_string(),
            stage: "complete".to_string(),
            progress: 1.0,
        });

        log::info!("ML models initialized successfully");
        Ok(())
    }

    /// Get or load the embedding model.
    pub async fn get_embedding_model(&self) -> Result<Arc<EmbeddingModel>, AppError> {
        // Fast path: check if already loaded
        {
            let guard = self.embedding_model.read().await;
            if let Some(model) = guard.as_ref() {
                return Ok(Arc::clone(model));
            }
        }

        // Slow path: acquire write lock and load
        let mut guard = self.embedding_model.write().await;

        // Double-check after acquiring write lock
        if let Some(model) = guard.as_ref() {
            return Ok(Arc::clone(model));
        }

        log::info!("Loading embedding model...");
        let model = Arc::new(EmbeddingModel::load(&self.models_dir)?);
        *guard = Some(Arc::clone(&model));
        log::info!("Embedding model loaded");

        Ok(model)
    }

    /// Get or load the sentiment model.
    pub async fn get_sentiment_model(&self) -> Result<Arc<SentimentModel>, AppError> {
        // Fast path: check if already loaded
        {
            let guard = self.sentiment_model.read().await;
            if let Some(model) = guard.as_ref() {
                return Ok(Arc::clone(model));
            }
        }

        // Slow path: acquire write lock and load
        let mut guard = self.sentiment_model.write().await;

        // Double-check after acquiring write lock
        if let Some(model) = guard.as_ref() {
            return Ok(Arc::clone(model));
        }

        log::info!("Loading sentiment model...");
        let model = Arc::new(SentimentModel::load(&self.models_dir)?);
        *guard = Some(Arc::clone(&model));
        log::info!("Sentiment model loaded");

        Ok(model)
    }
}

/// Status of ML model availability.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ModelStatus {
    pub embedding_downloaded: bool,
    pub sentiment_downloaded: bool,
    pub models_dir: PathBuf,
}

/// Progress information during model download/loading.
#[derive(Debug, Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub model: String,
    pub stage: String,
    pub progress: f32,
}
