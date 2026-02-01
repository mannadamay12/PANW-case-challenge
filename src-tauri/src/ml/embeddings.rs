use std::path::Path;

use candle_core::{DType, Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config};
use tokenizers::Tokenizer;

use crate::error::AppError;
use crate::ml::models::{get_device, EMBEDDING_MODEL};

/// Embedding model wrapper using all-MiniLM-L6-v2.
pub struct EmbeddingModel {
    model: BertModel,
    tokenizer: Tokenizer,
    device: Device,
}

impl EmbeddingModel {
    /// Load the embedding model from disk.
    pub fn load(models_dir: &Path) -> Result<Self, AppError> {
        let model_path = EMBEDDING_MODEL.model_path(models_dir);
        let tokenizer_path = EMBEDDING_MODEL.tokenizer_path(models_dir);
        let config_path = EMBEDDING_MODEL.config_path(models_dir);

        log::info!("Loading embedding model from: {}", model_path.display());

        // Load config
        let config_str = std::fs::read_to_string(&config_path)?;
        let config: Config = serde_json::from_str(&config_str)
            .map_err(|e| AppError::Ml(format!("Failed to parse config: {}", e)))?;

        // Load tokenizer
        let tokenizer = Tokenizer::from_file(&tokenizer_path)
            .map_err(|e| AppError::Ml(format!("Failed to load tokenizer: {}", e)))?;

        // Load model weights
        let device = get_device();
        let vb = unsafe {
            VarBuilder::from_mmaped_safetensors(&[model_path], DType::F32, &device)
                .map_err(|e| AppError::Ml(format!("Failed to load weights: {}", e)))?
        };

        let model = BertModel::load(vb, &config)
            .map_err(|e| AppError::Ml(format!("Failed to load model: {}", e)))?;

        Ok(Self {
            model,
            tokenizer,
            device,
        })
    }

    /// Generate an embedding for the given text.
    pub fn embed(&self, text: &str) -> Result<Vec<f32>, AppError> {
        // Tokenize the input
        let encoding = self
            .tokenizer
            .encode(text, true)
            .map_err(|e| AppError::Ml(format!("Tokenization failed: {}", e)))?;

        let input_ids = encoding.get_ids();
        let attention_mask = encoding.get_attention_mask();
        let token_type_ids = encoding.get_type_ids();

        // Convert to tensors
        let input_ids = Tensor::new(input_ids, &self.device)
            .map_err(|e| AppError::Ml(e.to_string()))?
            .unsqueeze(0)
            .map_err(|e| AppError::Ml(e.to_string()))?;

        let attention_mask = Tensor::new(attention_mask, &self.device)
            .map_err(|e| AppError::Ml(e.to_string()))?
            .unsqueeze(0)
            .map_err(|e| AppError::Ml(e.to_string()))?;

        let token_type_ids = Tensor::new(token_type_ids, &self.device)
            .map_err(|e| AppError::Ml(e.to_string()))?
            .unsqueeze(0)
            .map_err(|e| AppError::Ml(e.to_string()))?;

        // Run inference
        let output = self
            .model
            .forward(&input_ids, &token_type_ids, Some(&attention_mask))
            .map_err(|e| AppError::Ml(format!("Inference failed: {}", e)))?;

        // Mean pooling over sequence dimension (considering attention mask)
        let embedding = mean_pooling(&output, &attention_mask)?;

        // L2 normalize
        let embedding = l2_normalize(&embedding)?;

        // Convert to Vec<f32>
        let embedding: Vec<f32> = embedding
            .squeeze(0)
            .map_err(|e| AppError::Ml(e.to_string()))?
            .to_vec1()
            .map_err(|e| AppError::Ml(e.to_string()))?;

        Ok(embedding)
    }
}

/// Mean pooling: average token embeddings, weighted by attention mask.
fn mean_pooling(embeddings: &Tensor, attention_mask: &Tensor) -> Result<Tensor, AppError> {
    // embeddings: [batch, seq_len, hidden_size]
    // attention_mask: [batch, seq_len]

    // Expand attention mask to match embedding dimensions
    let mask = attention_mask
        .unsqueeze(2)
        .map_err(|e| AppError::Ml(e.to_string()))?
        .to_dtype(DType::F32)
        .map_err(|e| AppError::Ml(e.to_string()))?;

    // Apply mask and sum
    let masked = embeddings
        .broadcast_mul(&mask)
        .map_err(|e| AppError::Ml(e.to_string()))?;

    let summed = masked
        .sum(1)
        .map_err(|e| AppError::Ml(e.to_string()))?;

    // Sum of mask for averaging
    let mask_sum = mask
        .sum(1)
        .map_err(|e| AppError::Ml(e.to_string()))?
        .clamp(1e-9, f64::MAX)
        .map_err(|e| AppError::Ml(e.to_string()))?;

    // Mean
    summed
        .broadcast_div(&mask_sum)
        .map_err(|e| AppError::Ml(e.to_string()))
}

/// L2 normalize an embedding tensor.
fn l2_normalize(embedding: &Tensor) -> Result<Tensor, AppError> {
    let norm = embedding
        .sqr()
        .map_err(|e| AppError::Ml(e.to_string()))?
        .sum_keepdim(1)
        .map_err(|e| AppError::Ml(e.to_string()))?
        .sqrt()
        .map_err(|e| AppError::Ml(e.to_string()))?
        .clamp(1e-9, f64::MAX)
        .map_err(|e| AppError::Ml(e.to_string()))?;

    embedding
        .broadcast_div(&norm)
        .map_err(|e| AppError::Ml(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::vectors::EMBEDDING_DIM;

    #[test]
    #[ignore = "Requires model download"]
    fn test_embedding_dimension() {
        let models_dir = std::path::PathBuf::from("../models");
        let model = EmbeddingModel::load(&models_dir).unwrap();
        let embedding = model.embed("Hello, world!").unwrap();
        assert_eq!(embedding.len(), EMBEDDING_DIM);
    }

    #[test]
    #[ignore = "Requires model download"]
    fn test_similar_texts_have_similar_embeddings() {
        let models_dir = std::path::PathBuf::from("../models");
        let model = EmbeddingModel::load(&models_dir).unwrap();

        let e1 = model.embed("I am happy today").unwrap();
        let e2 = model.embed("I feel joyful today").unwrap();
        let e3 = model.embed("The weather is rainy").unwrap();

        let sim_12 = cosine_similarity(&e1, &e2);
        let sim_13 = cosine_similarity(&e1, &e3);

        // Similar sentences should have higher similarity
        assert!(sim_12 > sim_13);
    }

    fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
        let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
        dot / (norm_a * norm_b)
    }
}
