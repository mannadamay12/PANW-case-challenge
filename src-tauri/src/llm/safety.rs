use regex::RegexSet;
use serde::Serialize;

/// Crisis keywords that trigger a hard block.
const CRISIS_KEYWORDS: &[&str] = &[
    r"\bsuicide\b",
    r"\bkill myself\b",
    r"\bend my life\b",
    r"\bwant to die\b",
    r"\bself[- ]?harm\b",
    r"\bhurt myself\b",
    r"\bno reason to live\b",
    r"\bending it all\b",
    r"\btake my own life\b",
    r"\bcut myself\b",
    r"\bkill themselves\b",
    r"\bsuicidal\b",
];

/// Soft warning keywords that suggest high distress.
const DISTRESS_KEYWORDS: &[&str] = &[
    r"\bhopeless\b",
    r"\bworthless\b",
    r"\bcan't go on\b",
    r"\bwant to disappear\b",
    r"\bno point\b",
    r"\bgive up\b",
];

/// Safety filter for detecting crisis situations in user messages.
#[derive(Clone)]
pub struct SafetyFilter {
    crisis_patterns: RegexSet,
    distress_patterns: RegexSet,
}

impl SafetyFilter {
    pub fn new() -> Self {
        let crisis_patterns = RegexSet::new(CRISIS_KEYWORDS)
            .expect("Failed to compile crisis patterns");
        let distress_patterns = RegexSet::new(DISTRESS_KEYWORDS)
            .expect("Failed to compile distress patterns");

        Self {
            crisis_patterns,
            distress_patterns,
        }
    }

    /// Check a message for safety concerns.
    /// Returns a SafetyResult indicating whether the message is safe to process.
    pub fn check(&self, text: &str) -> SafetyResult {
        let lower = text.to_lowercase();

        // Check for crisis keywords (hard block)
        if self.crisis_patterns.is_match(&lower) {
            return SafetyResult {
                safe: false,
                level: SafetyLevel::Crisis,
                intervention: Some(CRISIS_INTERVENTION.to_string()),
            };
        }

        // Check for distress keywords (soft warning)
        if self.distress_patterns.is_match(&lower) {
            return SafetyResult {
                safe: true,
                level: SafetyLevel::Distress,
                intervention: Some(DISTRESS_MESSAGE.to_string()),
            };
        }

        SafetyResult {
            safe: true,
            level: SafetyLevel::Safe,
            intervention: None,
        }
    }

    /// Augment AI response with safety resources when distress is detected.
    pub fn augment_response(&self, response: &str, safety: &SafetyResult) -> String {
        match safety.level {
            SafetyLevel::Distress => {
                format!("{}\n\n{}", response, SUPPORT_RESOURCES)
            }
            _ => response.to_string(),
        }
    }
}

impl Default for SafetyFilter {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of a safety check.
#[derive(Debug, Clone, Serialize)]
pub struct SafetyResult {
    pub safe: bool,
    pub level: SafetyLevel,
    pub intervention: Option<String>,
}

/// Safety level classification.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SafetyLevel {
    /// No safety concerns detected.
    Safe,
    /// High distress detected, but not crisis-level. Show soft warning.
    Distress,
    /// Crisis-level content detected. Hard block and show intervention.
    Crisis,
}

/// Crisis intervention message shown to the user.
const CRISIS_INTERVENTION: &str = r#"I'm concerned about what you've shared. Your wellbeing matters.

If you're having thoughts of hurting yourself, please reach out:

• National Suicide Prevention Lifeline: 988 (call or text)
• Crisis Text Line: Text HOME to 741741
• International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/

You don't have to face this alone. A trained counselor is available 24/7."#;

/// Message shown for distress-level content.
const DISTRESS_MESSAGE: &str = "I hear that you're going through a difficult time. Your feelings are valid.";

/// Support resources appended to responses when distress is detected.
const SUPPORT_RESOURCES: &str = r#"---
If you'd like to talk to someone, support is available:
• 988 Suicide & Crisis Lifeline (call or text 988)
• Crisis Text Line (text HOME to 741741)"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crisis_detection() {
        let filter = SafetyFilter::new();

        // Crisis keywords should trigger hard block
        let result = filter.check("I want to kill myself");
        assert!(!result.safe);
        assert_eq!(result.level, SafetyLevel::Crisis);

        let result = filter.check("thinking about suicide");
        assert!(!result.safe);
        assert_eq!(result.level, SafetyLevel::Crisis);

        let result = filter.check("I've been self-harming");
        assert!(!result.safe);
        assert_eq!(result.level, SafetyLevel::Crisis);
    }

    #[test]
    fn test_distress_detection() {
        let filter = SafetyFilter::new();

        // Distress keywords should trigger soft warning
        let result = filter.check("I feel hopeless about everything");
        assert!(result.safe);
        assert_eq!(result.level, SafetyLevel::Distress);
        assert!(result.intervention.is_some());
    }

    #[test]
    fn test_safe_messages() {
        let filter = SafetyFilter::new();

        // Normal messages should pass
        let result = filter.check("I had a great day today");
        assert!(result.safe);
        assert_eq!(result.level, SafetyLevel::Safe);
        assert!(result.intervention.is_none());

        let result = filter.check("I'm feeling a bit stressed about work");
        assert!(result.safe);
        assert_eq!(result.level, SafetyLevel::Safe);
    }

    #[test]
    fn test_case_insensitivity() {
        let filter = SafetyFilter::new();

        let result = filter.check("I WANT TO KILL MYSELF");
        assert!(!result.safe);
        assert_eq!(result.level, SafetyLevel::Crisis);
    }
}
