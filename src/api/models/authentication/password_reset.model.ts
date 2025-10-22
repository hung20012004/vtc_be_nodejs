// src/api/models/authentication/password_reset.model.ts
import pool from '../../../config/db'; // Adjust path if needed
import crypto from 'crypto'; // Import crypto if you decide to hash tokens

// Define a type for the token record for better type safety
interface PasswordResetTokenRecord {
    email: string;
    token: string; // This could be the hashed token if you implement hashing
    created_at: Date;
    expires: Date;
}

/**
 * Creates a new password reset token or updates an existing one for the given email.
 * Includes an expiration timestamp.
 *
 * @param email The user's email address.
 * @param token The generated reset token (consider hashing this before saving).
 * @param expires The expiration date/time for the token.
 */
export const createOrUpdateResetToken = async (email: string, token: string, expires: Date): Promise<void> => {
    // **Optional but Recommended:** Hash the token before storing it.
    // const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    await pool.query(
        `INSERT INTO password_resets (email, token, expires, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (email)
         DO UPDATE SET token = EXCLUDED.token, expires = EXCLUDED.expires, created_at = NOW()`,
        // Use hashedToken instead of token if hashing is implemented
        [email, token, expires]
    );
};

/**
 * Finds a password reset token record by the token itself.
 *
 * @param token The reset token to search for (use the original token here, even if hashing is implemented in create/update).
 * @returns The token record including email and expiration, or null if not found.
 */
export const findTokenRecord = async (token: string): Promise<PasswordResetTokenRecord | null> => {
    // **If hashing tokens:**
    // const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    // const result = await pool.query('SELECT * FROM password_resets WHERE token = $1', [hashedToken]);

    // **If storing original token:**
    const result = await pool.query<PasswordResetTokenRecord>('SELECT * FROM password_resets WHERE token = $1', [token]);

    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Deletes the password reset token associated with a specific email address.
 * Typically used after a successful password reset.
 *
 * @param email The email address whose token should be deleted.
 */
export const deleteTokenByEmail = async (email: string): Promise<void> => {
    await pool.query('DELETE FROM password_resets WHERE email = $1', [email]);
};

/**
 * Deletes a password reset token record using the token itself.
 * Useful for cleaning up invalid or expired tokens.
 *
 * @param token The token to delete.
 */
export const deleteTokenByToken = async (token: string): Promise<void> => {
    // **If hashing tokens:**
    // const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    // await pool.query('DELETE FROM password_resets WHERE token = $1', [hashedToken]);

    // **If storing original token:**
    await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);
};