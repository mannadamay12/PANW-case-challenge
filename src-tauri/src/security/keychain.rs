use rand::RngCore;
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

const SERVICE_NAME: &str = "com.mindscribe.app";
const ACCOUNT_NAME: &str = "database-key";

// NOTE: has_encryption_key() was removed because calling get_generic_password()
// triggers the Keychain authentication dialog. Use file existence checks instead
// (e.g., encrypted_db_path.exists()) to determine if protection is enabled.

/// Generate and store a new 256-bit encryption key in Keychain.
/// When retrieved later, macOS will prompt for authentication (Touch ID, password, etc.)
/// based on user's system preferences.
pub fn store_encryption_key() -> Result<Vec<u8>, String> {
    let mut key = vec![0u8; 32]; // 256-bit key
    rand::thread_rng().fill_bytes(&mut key);

    set_generic_password(SERVICE_NAME, ACCOUNT_NAME, &key)
        .map_err(|e| format!("Failed to store key in Keychain: {}", e))?;

    Ok(key)
}

/// Retrieve encryption key from Keychain.
/// This triggers the system authentication prompt (Touch ID, password, etc.).
pub fn get_encryption_key() -> Result<Vec<u8>, String> {
    get_generic_password(SERVICE_NAME, ACCOUNT_NAME)
        .map_err(|e| format!("Failed to retrieve key from Keychain: {}", e))
}

/// Delete the encryption key from Keychain (used when disabling protection).
pub fn delete_encryption_key() -> Result<(), String> {
    delete_generic_password(SERVICE_NAME, ACCOUNT_NAME)
        .map_err(|e| format!("Failed to delete key from Keychain: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests interact with the real Keychain and may prompt for auth.
    // Run manually when needed.

    #[test]
    #[ignore]
    fn test_keychain_roundtrip() {
        // Clean up first
        let _ = delete_encryption_key();

        // Store key
        let key = store_encryption_key().expect("Failed to store key");
        assert_eq!(key.len(), 32);

        // Retrieve key (will trigger auth prompt)
        let retrieved = get_encryption_key().expect("Failed to get key");
        assert_eq!(key, retrieved);

        // Clean up
        delete_encryption_key().expect("Failed to delete key");

        // Verify deletion by trying to get key (should fail)
        assert!(get_encryption_key().is_err());
    }
}
