use std::path::Path;

use candle_core::{DType, Device, Module, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::distilbert::{Config, DistilBertModel};
use tokenizers::{
    models::wordpiece::WordPiece, normalizers::BertNormalizer,
    pre_tokenizers::bert::BertPreTokenizer, processors::bert::BertProcessing, Tokenizer,
};

use crate::error::AppError;
use crate::ml::models::{get_device, SENTIMENT_MODEL};

/// Hidden dimension for DistilBERT base models
const DISTILBERT_HIDDEN_DIM: usize = 768;

/// GoEmotions taxonomy: 27 emotion labels + neutral
pub const EMOTION_LABELS: [&str; 28] = [
    "admiration",
    "amusement",
    "anger",
    "annoyance",
    "approval",
    "caring",
    "confusion",
    "curiosity",
    "desire",
    "disappointment",
    "disapproval",
    "disgust",
    "embarrassment",
    "excitement",
    "fear",
    "gratitude",
    "grief",
    "joy",
    "love",
    "nervousness",
    "optimism",
    "pride",
    "realization",
    "relief",
    "remorse",
    "sadness",
    "surprise",
    "neutral",
];

/// An emotion prediction with label and confidence score.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EmotionPrediction {
    pub label: String,
    pub score: f32,
}

/// Sentiment analysis model using DistilBERT fine-tuned on GoEmotions.
pub struct SentimentModel {
    model: DistilBertModel,
    pre_classifier: candle_nn::Linear,
    classifier: candle_nn::Linear,
    tokenizer: Tokenizer,
    device: Device,
}

impl SentimentModel {
    /// Load the sentiment model from disk.
    pub fn load(models_dir: &Path) -> Result<Self, AppError> {
        let model_path = SENTIMENT_MODEL.model_path(models_dir);
        let tokenizer_path = SENTIMENT_MODEL.tokenizer_path(models_dir);
        let config_path = SENTIMENT_MODEL.config_path(models_dir);

        log::info!("Loading sentiment model from: {}", model_path.display());

        // Load config
        let config_str = std::fs::read_to_string(&config_path)?;
        let config: Config = serde_json::from_str(&config_str)
            .map_err(|e| AppError::Ml(format!("Failed to parse config: {}", e)))?;

        // Build tokenizer from vocab.txt using WordPiece
        // The GoEmotions model uses vocab-based format, not tokenizer.json
        let vocab_path_str = tokenizer_path.to_string_lossy().to_string();
        let wordpiece = WordPiece::from_file(&vocab_path_str)
            .unk_token("[UNK]".to_string())
            .build()
            .map_err(|e| AppError::Ml(format!("Failed to build WordPiece: {}", e)))?;

        let mut tokenizer = Tokenizer::new(wordpiece);
        tokenizer.with_normalizer(Some(BertNormalizer::default()));
        tokenizer.with_pre_tokenizer(Some(BertPreTokenizer));
        tokenizer.with_post_processor(Some(BertProcessing::new(
            ("[SEP]".to_string(), 102),
            ("[CLS]".to_string(), 101),
        )));

        // Load model weights
        let device = get_device();
        let vb = unsafe {
            VarBuilder::from_mmaped_safetensors(&[model_path], DType::F32, &device)
                .map_err(|e| AppError::Ml(format!("Failed to load weights: {}", e)))?
        };

        let model = DistilBertModel::load(vb.pp("distilbert"), &config)
            .map_err(|e| AppError::Ml(format!("Failed to load model: {}", e)))?;

        // Load pre_classifier (768 -> 768) and classifier (768 -> 28) heads
        let pre_classifier = candle_nn::linear(
            DISTILBERT_HIDDEN_DIM,
            DISTILBERT_HIDDEN_DIM,
            vb.pp("pre_classifier"),
        )
        .map_err(|e| AppError::Ml(format!("Failed to load pre_classifier: {}", e)))?;

        let classifier = candle_nn::linear(
            DISTILBERT_HIDDEN_DIM,
            EMOTION_LABELS.len(),
            vb.pp("classifier"),
        )
        .map_err(|e| AppError::Ml(format!("Failed to load classifier: {}", e)))?;

        Ok(Self {
            model,
            pre_classifier,
            classifier,
            tokenizer,
            device,
        })
    }

    /// Predict emotions for the given text.
    /// Returns top emotions above threshold, sorted by confidence.
    pub fn predict(
        &self,
        text: &str,
        threshold: f32,
        max_labels: usize,
    ) -> Result<Vec<EmotionPrediction>, AppError> {
        // Tokenize the input
        let encoding = self
            .tokenizer
            .encode(text, true)
            .map_err(|e| AppError::Ml(format!("Tokenization failed: {}", e)))?;

        let input_ids = encoding.get_ids();
        let attention_mask = encoding.get_attention_mask();

        // Convert to tensors
        // Convert to I64 - candle requires 64-bit integers for embedding lookups
        let input_ids = Tensor::new(input_ids, &self.device)
            .map_err(|e| AppError::Ml(e.to_string()))?
            .unsqueeze(0)
            .map_err(|e| AppError::Ml(e.to_string()))?
            .to_dtype(DType::I64)
            .map_err(|e| AppError::Ml(e.to_string()))?;

        // IMPORTANT: Candle's DistilBert uses INVERTED mask logic (1 = mask out, 0 = attend)
        // See: https://github.com/huggingface/candle/issues/2721
        let attention_mask = Tensor::new(attention_mask, &self.device)
            .map_err(|e| AppError::Ml(e.to_string()))?
            .unsqueeze(0)
            .map_err(|e| AppError::Ml(e.to_string()))?
            .eq(0u32)
            .map_err(|e| AppError::Ml(e.to_string()))?;

        // Run inference
        let output = self
            .model
            .forward(&input_ids, &attention_mask)
            .map_err(|e| AppError::Ml(format!("Inference failed: {}", e)))?;

        // Get CLS token representation (first token), keeping batch dimension
        // output shape: [batch, seq_len, hidden] -> [batch, hidden]
        let cls_output = output
            .narrow(1, 0, 1)
            .map_err(|e| AppError::Ml(e.to_string()))?
            .squeeze(1)
            .map_err(|e| AppError::Ml(e.to_string()))?;

        // Apply pre_classifier -> ReLU -> classifier
        let hidden = self
            .pre_classifier
            .forward(&cls_output)
            .map_err(|e| AppError::Ml(format!("Pre-classifier failed: {}", e)))?;

        let hidden = hidden
            .relu()
            .map_err(|e| AppError::Ml(format!("ReLU failed: {}", e)))?;

        let logits = self
            .classifier
            .forward(&hidden)
            .map_err(|e| AppError::Ml(format!("Classifier failed: {}", e)))?;

        // Apply sigmoid for multi-label classification
        let probs = sigmoid(&logits)?;

        // Convert to predictions (squeeze batch dim first)
        let probs_vec: Vec<f32> = probs
            .squeeze(0)
            .map_err(|e| AppError::Ml(e.to_string()))?
            .to_vec1()
            .map_err(|e| AppError::Ml(e.to_string()))?;

        let mut predictions: Vec<EmotionPrediction> = probs_vec
            .iter()
            .enumerate()
            .filter(|(_, &score)| score >= threshold)
            .map(|(idx, &score)| EmotionPrediction {
                label: EMOTION_LABELS[idx].to_string(),
                score,
            })
            .collect();

        // Sort by score descending (NaN values sort to the end)
        predictions.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Limit to max_labels
        predictions.truncate(max_labels);

        // If no emotions above threshold, return "neutral"
        // "neutral" is at index 27 in EMOTION_LABELS (last element)
        const NEUTRAL_IDX: usize = 27;
        if predictions.is_empty() {
            predictions.push(EmotionPrediction {
                label: EMOTION_LABELS[NEUTRAL_IDX].to_string(),
                score: probs_vec[NEUTRAL_IDX],
            });
        }

        Ok(predictions)
    }
}

/// Sigmoid activation function.
fn sigmoid(x: &Tensor) -> Result<Tensor, AppError> {
    let neg_x = x.neg().map_err(|e| AppError::Ml(e.to_string()))?;

    let exp_neg_x = neg_x.exp().map_err(|e| AppError::Ml(e.to_string()))?;

    let one = Tensor::ones_like(&exp_neg_x).map_err(|e| AppError::Ml(e.to_string()))?;

    let denominator = one
        .add(&exp_neg_x)
        .map_err(|e| AppError::Ml(e.to_string()))?;

    Tensor::ones_like(&denominator)
        .map_err(|e| AppError::Ml(e.to_string()))?
        .div(&denominator)
        .map_err(|e| AppError::Ml(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_emotion_labels_count() {
        assert_eq!(EMOTION_LABELS.len(), 28);
    }

    #[test]
    fn test_contains_expected_emotions() {
        assert!(EMOTION_LABELS.contains(&"joy"));
        assert!(EMOTION_LABELS.contains(&"sadness"));
        assert!(EMOTION_LABELS.contains(&"anger"));
        assert!(EMOTION_LABELS.contains(&"neutral"));
    }

    #[test]
    #[ignore = "Requires model download"]
    fn test_predict_emotions() {
        let models_dir = std::path::PathBuf::from("../models");
        let model = SentimentModel::load(&models_dir).unwrap();

        let predictions = model.predict("I am so happy today!", 0.1, 3).unwrap();
        assert!(!predictions.is_empty());

        let labels: Vec<&str> = predictions.iter().map(|p| p.label.as_str()).collect();
        assert!(
            labels.contains(&"joy")
                || labels.contains(&"excitement")
                || labels.contains(&"optimism")
        );
    }
}
