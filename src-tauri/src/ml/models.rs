use std::path::{Path, PathBuf};

use hf_hub::api::sync::Api;

use crate::error::AppError;

/// Embedding model: all-MiniLM-L6-v2 (384-dim)
pub const EMBEDDING_MODEL: ModelInfo = ModelInfo {
    repo_id: "sentence-transformers/all-MiniLM-L6-v2",
    model_file: "model.safetensors",
    tokenizer_file: "tokenizer.json",
    config_file: "config.json",
    local_dir: "all-MiniLM-L6-v2",
    extra_files: &[],
};

/// Sentiment model: DistilBERT GoEmotions (27 emotions + neutral)
/// Uses vocab-based tokenizer (vocab.txt) instead of tokenizer.json
pub const SENTIMENT_MODEL: ModelInfo = ModelInfo {
    repo_id: "joeddav/distilbert-base-uncased-go-emotions-student",
    model_file: "model.safetensors",
    tokenizer_file: "vocab.txt",
    config_file: "config.json",
    local_dir: "distilbert-go-emotions",
    extra_files: &["tokenizer_config.json", "special_tokens_map.json"],
};

/// Information about a model to download.
#[derive(Debug, Clone, Copy)]
pub struct ModelInfo {
    pub repo_id: &'static str,
    pub model_file: &'static str,
    pub tokenizer_file: &'static str,
    pub config_file: &'static str,
    pub local_dir: &'static str,
    /// Additional files needed (e.g., tokenizer_config.json for vocab-based tokenizers)
    pub extra_files: &'static [&'static str],
}

impl ModelInfo {
    /// Get the local path for this model.
    pub fn local_path(&self, models_dir: &Path) -> PathBuf {
        models_dir.join(self.local_dir)
    }

    /// Get the model weights file path.
    pub fn model_path(&self, models_dir: &Path) -> PathBuf {
        self.local_path(models_dir).join(self.model_file)
    }

    /// Get the tokenizer file path.
    pub fn tokenizer_path(&self, models_dir: &Path) -> PathBuf {
        self.local_path(models_dir).join(self.tokenizer_file)
    }

    /// Get the config file path.
    pub fn config_path(&self, models_dir: &Path) -> PathBuf {
        self.local_path(models_dir).join(self.config_file)
    }
}

/// Check if a model is already downloaded.
pub fn is_model_downloaded(models_dir: &Path, model: ModelInfo) -> bool {
    let model_path = model.model_path(models_dir);
    let tokenizer_path = model.tokenizer_path(models_dir);
    let config_path = model.config_path(models_dir);

    let base_files_exist = model_path.exists() && tokenizer_path.exists() && config_path.exists();

    // Also check extra files
    let extra_files_exist = model.extra_files.iter().all(|file| {
        model.local_path(models_dir).join(file).exists()
    });

    base_files_exist && extra_files_exist
}

/// Download a model from HuggingFace Hub.
pub async fn download_model(models_dir: &Path, model: ModelInfo) -> Result<(), AppError> {
    let local_path = model.local_path(models_dir);
    std::fs::create_dir_all(&local_path)?;

    log::info!(
        "Downloading model {} to {}",
        model.repo_id,
        local_path.display()
    );

    // Use HuggingFace Hub API to download files
    // Run in blocking task since hf-hub uses sync I/O
    let repo_id = model.repo_id.to_string();
    let model_file = model.model_file.to_string();
    let tokenizer_file = model.tokenizer_file.to_string();
    let config_file = model.config_file.to_string();
    let extra_files: Vec<String> = model.extra_files.iter().map(|s| s.to_string()).collect();
    let local_path_clone = local_path.clone();

    tokio::task::spawn_blocking(move || {
        let api = Api::new().map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
        let repo = api.model(repo_id);

        // Download model weights
        log::info!("Downloading model weights...");
        let model_src = repo
            .get(&model_file)
            .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
        std::fs::copy(&model_src, local_path_clone.join(&model_file))?;

        // Download tokenizer
        log::info!("Downloading tokenizer...");
        let tokenizer_src = repo
            .get(&tokenizer_file)
            .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
        std::fs::copy(&tokenizer_src, local_path_clone.join(&tokenizer_file))?;

        // Download config
        log::info!("Downloading config...");
        let config_src = repo
            .get(&config_file)
            .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
        std::fs::copy(&config_src, local_path_clone.join(&config_file))?;

        // Download extra files (e.g., tokenizer_config.json for vocab-based tokenizers)
        for file in &extra_files {
            log::info!("Downloading {}...", file);
            let src = repo
                .get(file)
                .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))?;
            std::fs::copy(&src, local_path_clone.join(file))?;
        }

        log::info!("Model download complete");
        Ok::<_, AppError>(())
    })
    .await
    .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))??;

    Ok(())
}

/// Get the device for ML inference.
pub fn get_device() -> candle_core::Device {
    log::info!("Using CPU for inference");
    candle_core::Device::Cpu
}
