//! Quick verification script for ML model download and inference.
//! Run with: cargo run --example verify_ml

use std::path::PathBuf;

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    // Use a test directory
    let models_dir = PathBuf::from("./test_models");
    std::fs::create_dir_all(&models_dir).expect("Failed to create models dir");

    println!("=== ML Verification Script ===\n");
    println!("Models directory: {}\n", models_dir.display());

    // Run async code
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        verify_models(&models_dir).await;
    });
}

async fn verify_models(models_dir: &PathBuf) {
    use mindscribe_lib::ml::models::{
        download_model, is_model_downloaded, EMBEDDING_MODEL, SENTIMENT_MODEL,
    };

    // Check/download embedding model
    println!("--- Embedding Model ---");
    if is_model_downloaded(models_dir, EMBEDDING_MODEL) {
        println!("✓ Already downloaded");
    } else {
        println!("Downloading...");
        match download_model(models_dir, EMBEDDING_MODEL).await {
            Ok(_) => println!("✓ Download complete"),
            Err(e) => {
                println!("✗ Download failed: {}", e);
                return;
            }
        }
    }

    // Check/download sentiment model
    println!("\n--- Sentiment Model ---");
    if is_model_downloaded(models_dir, SENTIMENT_MODEL) {
        println!("✓ Already downloaded");
    } else {
        println!("Downloading...");
        match download_model(models_dir, SENTIMENT_MODEL).await {
            Ok(_) => println!("✓ Download complete"),
            Err(e) => {
                println!("✗ Download failed: {}", e);
                return;
            }
        }
    }

    // Test loading and inference
    println!("\n--- Testing Sentiment Inference ---");
    match mindscribe_lib::ml::sentiment::SentimentModel::load(models_dir) {
        Ok(model) => {
            println!("✓ Model loaded successfully");

            let test_texts = [
                "I am so happy today!",
                "This makes me really angry.",
                "I feel anxious about the future.",
                "Just another ordinary day.",
            ];

            for text in test_texts {
                match model.predict(text, 0.1, 3) {
                    Ok(predictions) => {
                        let emotions: Vec<String> = predictions
                            .iter()
                            .map(|p| format!("{}({:.4})", p.label, p.score))
                            .collect();
                        println!("  \"{}\" -> {}", text, emotions.join(", "));
                        // Check for uniform outputs
                        if predictions.len() > 1 {
                            let first = predictions[0].score;
                            let all_same =
                                predictions.iter().all(|p| (p.score - first).abs() < 0.0001);
                            if all_same {
                                println!(
                                    "    ⚠ WARNING: All predictions are identical ({:.4})",
                                    first
                                );
                            }
                        }
                    }
                    Err(e) => println!("  ✗ Prediction failed: {}", e),
                }
            }
        }
        Err(e) => println!("✗ Failed to load model: {}", e),
    }

    println!("\n--- Testing Embedding Inference ---");
    match mindscribe_lib::ml::embeddings::EmbeddingModel::load(models_dir) {
        Ok(model) => {
            println!("✓ Model loaded successfully");
            match model.embed("Hello world") {
                Ok(embedding) => println!("  Embedding dimension: {}", embedding.len()),
                Err(e) => println!("  ✗ Embedding failed: {}", e),
            }
        }
        Err(e) => println!("✗ Failed to load model: {}", e),
    }

    println!("\n=== Verification Complete ===");
}
