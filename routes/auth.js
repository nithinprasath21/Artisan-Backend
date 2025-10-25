const express = require('express');
const User = require('../models/user');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwt');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
    const { email, phone_number, password, user_type, username, role_ids } = req.body;
    if (!email || !password || !user_type) {
        return res.status(400).json({ message: 'Email, password, and user type are required.' });
    }
    if (!['customer', 'artisan', 'admin_staff'].includes(user_type)) {
        return res.status(400).json({ message: 'Invalid user type.' });
    }
    if (user_type === 'admin_staff' && (!username || !role_ids || !Array.isArray(role_ids) || role_ids.length === 0)) {
        return res.status(400).json({ message: 'For admin_staff, username and at least one role_id are required.' });
    }

    try {
        const existingUser = await User.findByEmailOrPhone(email);
        if (existingUser) {
            return res.status(409).json({ message: 'User with this email or phone number already exists.' });
        }

        const newUser = await User.createUser(email, phone_number, password, user_type, username);

        if (user_type === 'admin_staff' && role_ids && role_ids.length > 0) {
            await User.assignRolesToUser(newUser.id, role_ids); // Call new method
        }

        const userWithRoles = await User.findUserById(newUser.id);
        const roles = userWithRoles ? userWithRoles.roles : [];

        const accessToken = generateAccessToken(newUser.id, newUser.user_type, roles);
        const refreshToken = generateRefreshToken(newUser.id);

        res.status(201).json({
            message: `${user_type} registered successfully.`,
            userId: newUser.id,
            email: newUser.email,
            userType: newUser.user_type,
            status: newUser.status,
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'A user with this email or phone number already exists.' });
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

router.post('/login', async (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ message: 'Identifier (email/phone) and password are required.' });
    }

    try {
        const user = await User.findByEmailOrPhone(identifier);

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await User.comparePassword(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        if (user.status !== 'active' && user.user_type !== 'artisan') {
            return res.status(403).json({ message: `Your account is ${user.status}. Please contact support.` });
        }
        if (user.user_type === 'artisan' && user.status === 'pending_kyc') {
            return res.status(403).json({ message: 'Your artisan account is pending KYC verification. Please wait for approval.' });
        }

        await User.updateLastLogin(user.id);

        let rolesToSendInToken = user.roles || [];
        if (user.user_type === 'artisan' && !rolesToSendInToken.includes('artisan')) {
            rolesToSendInToken.push('artisan');
        } else if (user.user_type === 'customer' && !rolesToSendInToken.includes('customer')) {
            rolesToSendInToken.push('customer');
        } else if (user.user_type === 'artisan_hub' && !rolesToSendInToken.includes('artisan_hub')) {
            rolesToSendInToken.push('artisan_hub');
        }

        const accessToken = generateAccessToken(user.id, user.user_type, rolesToSendInToken);
        const refreshToken = generateRefreshToken(user.id);

        res.status(200).json({
            message: 'Login successful.',
            userId: user.id,
            email: user.email,
            userType: user.user_type,
            roles: rolesToSendInToken,
            status: user.status,
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

router.post('/refresh-token', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required.' });
    }

    const decoded = verifyToken(refreshToken);

    if (!decoded) {
        return res.status(403).json({ message: 'Invalid refresh token.' });
    }

    const newAccessToken = generateAccessToken(decoded.id, decoded.type, decoded.roles);

    res.status(200).json({
        accessToken: newAccessToken
    });
});

router.get('/protected-route', authenticateToken, (req, res) => {
    res.status(200).json({
        message: 'You accessed a protected route!',
        user: req.user
    });
});

module.exports = router;