const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect()
    .then(client => {
        console.log('Connected to PostgreSQL database!');
        client.release();
    })
    .catch(err => {
        console.error('Error connecting to PostgreSQL database:', err.message);
        process.exit(1);
    });

module.exports = pool;