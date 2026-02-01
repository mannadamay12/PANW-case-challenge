use std::collections::HashMap;

use rusqlite::Connection;

use crate::db::journals::Journal;
use crate::db::vectors;
use crate::error::AppError;

/// RRF constant for rank fusion (standard value)
const RRF_K: f64 = 60.0;

/// RRF result: (id, combined_score, fts_rank, vec_rank)
type RrfResult = (String, f64, Option<usize>, Option<usize>);

/// Result from hybrid search with combined score.
#[derive(Debug, Clone, serde::Serialize)]
pub struct HybridSearchResult {
    pub journal: Journal,
    pub score: f64,
    pub fts_rank: Option<usize>,
    pub vec_rank: Option<usize>,
}

/// Perform hybrid search combining FTS5 and vector similarity.
/// Uses Reciprocal Rank Fusion (RRF) to combine rankings.
pub fn hybrid_search(
    conn: &Connection,
    query: &str,
    query_embedding: Option<&[f32]>,
    limit: usize,
    include_archived: bool,
) -> Result<Vec<HybridSearchResult>, AppError> {
    // Get FTS5 results
    let fts_results = fts_search(conn, query, limit * 2, include_archived)?;

    // Get vector search results if embedding provided
    let vec_results = if let Some(embedding) = query_embedding {
        vector_search(conn, embedding, limit * 2, include_archived)?
    } else {
        Vec::new()
    };

    // Combine with RRF
    let combined = reciprocal_rank_fusion(&fts_results, &vec_results, limit)?;

    // Fetch full journal entries for results
    let mut results = Vec::with_capacity(combined.len());
    for (id, score, fts_rank, vec_rank) in combined {
        let journal = crate::db::journals::get(conn, &id)?;
        results.push(HybridSearchResult {
            journal,
            score,
            fts_rank,
            vec_rank,
        });
    }

    Ok(results)
}

/// Perform FTS5 full-text search.
fn fts_search(
    conn: &Connection,
    query: &str,
    limit: usize,
    include_archived: bool,
) -> Result<Vec<(String, f64)>, AppError> {
    let escaped_query = query
        .replace('"', "\"\"")
        .split_whitespace()
        .map(|word| format!("\"{}\"*", word))
        .collect::<Vec<_>>()
        .join(" ");

    let archived_filter = if include_archived {
        ""
    } else {
        "AND j.is_archived = 0"
    };

    let sql = format!(
        r#"
        SELECT j.id, bm25(journals_fts) as rank
        FROM journals_fts fts
        JOIN journals j ON j.rowid = fts.rowid
        WHERE journals_fts MATCH ?
        {}
        ORDER BY rank
        LIMIT ?
        "#,
        archived_filter
    );

    let mut stmt = conn.prepare(&sql)?;
    let results = stmt
        .query_map(rusqlite::params![escaped_query, limit as i64], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(results)
}

/// Perform vector similarity search using both entry embeddings and chunks.
/// Chunks provide better precision for long entries.
fn vector_search(
    conn: &Connection,
    query_embedding: &[f32],
    limit: usize,
    include_archived: bool,
) -> Result<Vec<(String, f64)>, AppError> {
    // Get results from entry-level embeddings
    let entry_results = vectors::search_similar(conn, query_embedding, limit * 2)?;

    // Get results from chunk embeddings (may return multiple chunks per entry)
    let chunk_results = vectors::search_similar_chunks(conn, query_embedding, limit * 3)?;

    // Combine: use best score per journal_id from either source
    let mut best_scores: HashMap<String, f64> = HashMap::new();

    for (id, distance) in &entry_results {
        best_scores
            .entry(id.clone())
            .and_modify(|d| {
                if *distance < *d {
                    *d = *distance
                }
            })
            .or_insert(*distance);
    }

    for chunk in &chunk_results {
        best_scores
            .entry(chunk.journal_id.clone())
            .and_modify(|d| {
                if chunk.distance < *d {
                    *d = chunk.distance
                }
            })
            .or_insert(chunk.distance);
    }

    // Sort by distance and take top results
    let mut combined: Vec<(String, f64)> = best_scores.into_iter().collect();
    combined.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    if !include_archived {
        // Filter out archived entries
        let mut stmt = conn.prepare("SELECT is_archived FROM journals WHERE id = ?")?;
        let mut filtered = Vec::with_capacity(combined.len());
        for (id, distance) in combined {
            match stmt.query_row([&id], |row| row.get::<_, bool>(0)) {
                Ok(is_archived) => {
                    if !is_archived {
                        filtered.push((id, distance));
                    }
                }
                Err(rusqlite::Error::QueryReturnedNoRows) => {
                    log::warn!(
                        "Orphaned embedding found: journal '{}' no longer exists",
                        id
                    );
                }
                Err(e) => return Err(e.into()),
            }
            if filtered.len() >= limit {
                break;
            }
        }
        Ok(filtered)
    } else {
        Ok(combined.into_iter().take(limit).collect())
    }
}

/// Combine two ranked lists using Reciprocal Rank Fusion.
/// Returns (id, combined_score, fts_rank, vec_rank) tuples.
fn reciprocal_rank_fusion(
    fts_results: &[(String, f64)],
    vec_results: &[(String, f64)],
    limit: usize,
) -> Result<Vec<RrfResult>, AppError> {
    let mut scores: HashMap<String, (f64, Option<usize>, Option<usize>)> = HashMap::new();

    // Add FTS5 contributions
    for (rank, (id, _)) in fts_results.iter().enumerate() {
        let rrf_score = 1.0 / (RRF_K + (rank + 1) as f64);
        let entry = scores.entry(id.clone()).or_insert((0.0, None, None));
        entry.0 += rrf_score;
        entry.1 = Some(rank + 1);
    }

    // Add vector similarity contributions
    for (rank, (id, _)) in vec_results.iter().enumerate() {
        let rrf_score = 1.0 / (RRF_K + (rank + 1) as f64);
        let entry = scores.entry(id.clone()).or_insert((0.0, None, None));
        entry.0 += rrf_score;
        entry.2 = Some(rank + 1);
    }

    // Sort by combined score
    let mut results: Vec<_> = scores
        .into_iter()
        .map(|(id, (score, fts_rank, vec_rank))| (id, score, fts_rank, vec_rank))
        .collect();

    results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(limit);

    Ok(results)
}

/// Perform FTS-only search (for when embeddings aren't available).
pub fn fts_only_search(
    conn: &Connection,
    query: &str,
    limit: usize,
    include_archived: bool,
) -> Result<Vec<HybridSearchResult>, AppError> {
    let fts_results = fts_search(conn, query, limit, include_archived)?;

    let mut results = Vec::with_capacity(fts_results.len());
    for (rank, (id, _)) in fts_results.iter().enumerate() {
        let journal = crate::db::journals::get(conn, id)?;
        results.push(HybridSearchResult {
            journal,
            score: 1.0 / (RRF_K + (rank + 1) as f64),
            fts_rank: Some(rank + 1),
            vec_rank: None,
        });
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rrf_calculation() {
        let fts = vec![
            ("a".to_string(), 1.0),
            ("b".to_string(), 0.9),
            ("c".to_string(), 0.8),
        ];
        let vec = vec![
            ("b".to_string(), 0.1),
            ("a".to_string(), 0.2),
            ("d".to_string(), 0.3),
        ];

        let combined = reciprocal_rank_fusion(&fts, &vec, 10).unwrap();

        // 'a' and 'b' should be in top results (appear in both lists)
        let top_ids: Vec<&str> = combined
            .iter()
            .take(2)
            .map(|(id, _, _, _)| id.as_str())
            .collect();
        assert!(top_ids.contains(&"a"));
        assert!(top_ids.contains(&"b"));

        // 'a' and 'b' should have higher scores than 'c' and 'd'
        let a_score = combined.iter().find(|(id, _, _, _)| id == "a").unwrap().1;
        let c_score = combined.iter().find(|(id, _, _, _)| id == "c").unwrap().1;
        assert!(a_score > c_score);
    }

    #[test]
    fn test_rrf_score_formula() {
        // RRF score for rank 1 should be 1/(60+1) = 0.0164...
        let expected = 1.0 / (RRF_K + 1.0);
        let fts = vec![("a".to_string(), 1.0)];
        let vec: Vec<(String, f64)> = vec![];

        let combined = reciprocal_rank_fusion(&fts, &vec, 10).unwrap();
        assert!((combined[0].1 - expected).abs() < 1e-6);
    }

    #[test]
    fn test_empty_results() {
        let fts: Vec<(String, f64)> = vec![];
        let vec: Vec<(String, f64)> = vec![];

        let combined = reciprocal_rank_fusion(&fts, &vec, 10).unwrap();
        assert!(combined.is_empty());
    }
}
