const pool = require('../config/db');
const crypto = require('crypto');
require('dotenv').config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

function encrypt(text) {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
        throw new Error('Encryption key not properly configured or is not 64 hexadecimal characters.');
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
        throw new Error('Encryption key not properly configured or is not 64 hexadecimal characters.');
    }
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

class Artisan {
    static async getProfile(userId) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `SELECT
                    u.id AS user_id,
                    u.email,
                    u.phone_number,
                    u.username,
                    a.bio,
                    a.profile_picture_url,
                    a.address_line1,
                    a.address_line2,
                    a.city,
                    a.state,
                    a.pincode,
                    a.craft_type_id, -- These will link to other tables later
                    a.region_id,     -- These will link to other tables later
                    a.social_media_links,
                    a.bank_account_name,
                    a.bank_account_number_encrypted,
                    a.bank_ifsc_code,
                    a.kyc_status,
                    a.kyc_document_url,
                    a.avg_rating,
                    a.reviews_count
                FROM users u
                JOIN artisans a ON u.id = a.id
                WHERE u.id = $1`,
                [userId]
            );

            const artisan = result.rows[0];
            if (artisan) {
                artisan.bank_account_number_masked = artisan.bank_account_number_encrypted ?
                    'XXXX-XXXX-XXXX-' + decrypt(artisan.bank_account_number_encrypted).slice(-4) : null;
                delete artisan.bank_account_number_encrypted;

                artisan.bank_details_status = artisan.bank_account_name && artisan.bank_ifsc_code ? 'registered' : 'not_registered';
            }
            return artisan;

        } finally {
            client.release();
        }
    }

    static async updateProfile(userId, profileData) {
        const {
            bio, profile_picture_url, address_line1, address_line2, city, state, pincode,
            craft_type_id, region_id, social_media_links, username // username can be updated in users table
        } = profileData;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            if (username !== undefined) {
                await client.query(
                    `UPDATE users SET username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                    [username, userId]
                );
            }

            // Update artisans table
            const updateFields = [];
            const updateValues = [];
            let paramIndex = 1;

            if (bio !== undefined) { updateFields.push(`bio = $${paramIndex++}`); updateValues.push(bio); }
            if (profile_picture_url !== undefined) { updateFields.push(`profile_picture_url = $${paramIndex++}`); updateValues.push(profile_picture_url); }
            if (address_line1 !== undefined) { updateFields.push(`address_line1 = $${paramIndex++}`); updateValues.push(address_line1); }
            if (address_line2 !== undefined) { updateFields.push(`address_line2 = $${paramIndex++}`); updateValues.push(address_line2); }
            if (city !== undefined) { updateFields.push(`city = $${paramIndex++}`); updateValues.push(city); }
            if (state !== undefined) { updateFields.push(`state = $${paramIndex++}`); updateValues.push(state); }
            if (pincode !== undefined) { updateFields.push(`pincode = $${paramIndex++}`); updateValues.push(pincode); }
            if (craft_type_id !== undefined) { updateFields.push(`craft_type_id = $${paramIndex++}`); updateValues.push(craft_type_id); }
            if (region_id !== undefined) { updateFields.push(`region_id = $${paramIndex++}`); updateValues.push(region_id); }
            if (social_media_links !== undefined) { updateFields.push(`social_media_links = $${paramIndex++}`); updateValues.push(social_media_links); }

            if (updateFields.length > 0) {
                const query = `UPDATE artisans SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING id`;
                await client.query(query, [...updateValues, userId]);
            }

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async updateProfilePicture(userId, url) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `UPDATE artisans SET profile_picture_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING profile_picture_url`,
                [url, userId]
            );
            return result.rows[0].profile_picture_url;
        } finally {
            client.release();
        }
    }

    static async getBankDetails(userId) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `SELECT bank_account_name, bank_account_number_encrypted, bank_ifsc_code
                 FROM artisans
                 WHERE id = $1`,
                [userId]
            );
            const details = result.rows[0];
            if (details && details.bank_account_number_encrypted) {
                const fullAccountNumber = decrypt(details.bank_account_number_encrypted);
                details.bank_account_number_masked = 'XXXX-XXXX-XXXX-' + fullAccountNumber.slice(-4);
                delete details.bank_account_number_encrypted;
            }
            return details;
        } finally {
            client.release();
        }
    }

    static async updateBankDetails(userId, bankDetails) {
        const { bank_name, account_number, ifsc_code, account_holder_name, pan_card_number } = bankDetails;

        if (!bank_name || !account_number || !ifsc_code || !account_holder_name || !pan_card_number) {
            throw new Error('All bank details fields are required.');
        }

        const encryptedAccountNumber = encrypt(account_number);

        const client = await pool.connect();
        try {
            await client.query(
                `UPDATE artisans
                 SET bank_account_name = $1, bank_account_number_encrypted = $2, bank_ifsc_code = $3,
                     bank_account_holder_name = $4, pan_card_number = $5, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $6`,
                [bank_name, encryptedAccountNumber, ifsc_code, account_holder_name, pan_card_number, userId]
            );
            return true;
        } finally {
            client.release();
        }
    }

    static async getKycStatus(userId) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `SELECT kyc_status, rejection_reason FROM artisans WHERE id = $1`,
                [userId]
            );
            return result.rows[0];
        } finally {
            client.release();
        }
    }
}

module.exports = Artisan;