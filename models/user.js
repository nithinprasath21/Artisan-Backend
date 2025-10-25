const pool = require('../config/db');
const bcrypt = require('bcrypt');

class User {
    static async createUser(email, phone_number, password, user_type, username = null) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const userResult = await client.query(
                `INSERT INTO users (email, phone_number, password_hash, user_type, username, status)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, user_type, status`,
                [email, phone_number, hashedPassword, user_type, username, user_type === 'artisan' ? 'pending_kyc' : 'active']
            );
            const newUser = userResult.rows[0];

            if (user_type === 'artisan') {
                await client.query(
                    `INSERT INTO artisans (id) VALUES ($1)`,
                    [newUser.id]
                );
            } else if (user_type === 'customer') {
                await client.query(
                    `INSERT INTO customers (id) VALUES ($1)`,
                    [newUser.id]
                );
            } else if (user_type === 'admin_staff') {
                // For admin_staff, roles will be assigned separately by a SuperAdmin
                // For initial setup, you might manually assign a SuperAdmin role in DB
            }

            await client.query('COMMIT');
            return newUser;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async findByEmailOrPhone(identifier) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `SELECT u.id, u.email, u.phone_number, u.password_hash, u.user_type, u.status,
                        ARRAY_AGG(r.name) AS roles
                 FROM users u
                 LEFT JOIN user_roles ur ON u.id = ur.user_id
                 LEFT JOIN roles r ON ur.role_id = r.id
                 WHERE u.email = $1 OR u.phone_number = $1
                 GROUP BY u.id, u.email, u.phone_number, u.password_hash, u.user_type, u.status`,
                [identifier]
            );
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    static async comparePassword(plainPassword, hashedPassword) {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    static async findUserById(userId) {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `SELECT u.id, u.email, u.phone_number, u.user_type, u.status,
                        ARRAY_AGG(r.name) AS roles
                 FROM users u
                 LEFT JOIN user_roles ur ON u.id = ur.user_id
                 LEFT JOIN roles r ON ur.role_id = r.id
                 WHERE u.id = $1
                 GROUP BY u.id, u.email, u.phone_number, u.user_type, u.status`,
                [userId]
            );
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    static async updateLastLogin(userId) {
        const client = await pool.connect();
        try {
            await client.query(
                `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [userId]
            );
        } finally {
            client.release();
        }
    }

    static async assignRolesToUser(userId, roleIds) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const roleId of roleIds) {
                await client.query(
                    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT (user_id, role_id) DO NOTHING`,
                    [userId, roleId]
                );
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = User;