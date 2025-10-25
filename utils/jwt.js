const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateAccessToken = (userId, userType, roles = []) => {
    return jwt.sign(
        { id: userId, type: userType, roles: roles },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRATION }
    );
};

const generateRefreshToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRATION }
    );
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null;
    }
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyToken
};