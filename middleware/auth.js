const { verifyToken } = require('../utils/jwt');
const User = require('../models/user');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Authentication token required.' });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    req.user = {
        id: decoded.id,
        type: decoded.type,
        roles: decoded.roles
    };
    const userFromDb = await User.findUserById(req.user.id);
    if (!userFromDb || userFromDb.status !== 'active') {
        return res.status(403).json({ message: 'User account is inactive or not found.' });
    }
    next();
};

const authorizeRoles = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.roles) {
            return res.status(403).json({ message: 'Access denied. No roles found.' });
        }
        const hasPermission = req.user.roles.some(role => allowedRoles.includes(role));
        if (hasPermission) {
            next();
        } else {
            res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
        }
    };
};

module.exports = {
    authenticateToken,
    authorizeRoles
};