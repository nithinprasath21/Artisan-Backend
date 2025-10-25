const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');

const Artisan = require('../models/artisan');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

const downloadsPath = path.join(os.homedir(), 'Downloads');
const uploadDirectory = path.join(downloadsPath, 'artisan_profile_pictures');

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirectory);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `${file.fieldname}-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

router.get('/profile', authenticateToken, authorizeRoles(['artisan']), async (req, res) => {
    try {
        const artisanId = req.user.id;
        const profile = await Artisan.getProfile(artisanId);

        if (!profile) {
            return res.status(404).json({ message: 'Artisan profile not found.' });
        }

        res.status(200).json(profile);
    } catch (error) {
        console.error('Error fetching artisan profile:', error);
        res.status(500).json({ message: 'Server error fetching profile.' });
    }
});

router.put('/profile', authenticateToken, authorizeRoles(['artisan']), async (req, res) => {
    try {
        const artisanId = req.user.id;
        const profileData = req.body;

        if (Object.keys(profileData).length === 0) {
            return res.status(400).json({ message: 'No data provided for profile update.' });
        }

        await Artisan.updateProfile(artisanId, profileData);
        res.status(200).json({ message: 'Artisan profile updated successfully.' });

    } catch (error) {
        console.error('Error updating artisan profile:', error);
        res.status(500).json({ message: 'Server error updating profile.' });
    }
});

router.post('/profile/picture', authenticateToken, authorizeRoles(['artisan']), upload.single('profilePicture'), async (req, res) => {
    try {
        const artisanId = req.user.id;
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }
        const pictureUrl = req.file.path;

        const updatedUrl = await Artisan.updateProfilePicture(artisanId, pictureUrl);

        res.status(200).json({
            message: 'Profile picture uploaded successfully.',
            profile_picture_url: updatedUrl
        });

    } catch (error) {
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ message: error.message });
        }
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ message: 'Server error uploading profile picture.' });
    }
});

router.get('/profile/bank-details', authenticateToken, authorizeRoles(['artisan']), async (req, res) => {
    try {
        const artisanId = req.user.id;
        const bankDetails = await Artisan.getBankDetails(artisanId);

        if (!bankDetails) {
            return res.status(404).json({ message: 'Bank details not found for this artisan.' });
        }

        res.status(200).json(bankDetails);
    } catch (error) {
        console.error('Error fetching bank details:', error);
        res.status(500).json({ message: 'Server error fetching bank details.' });
    }
});

router.put('/profile/bank-details', authenticateToken, authorizeRoles(['artisan']), async (req, res) => {
    try {
        const artisanId = req.user.id;
        const bankDetails = req.body;

        await Artisan.updateBankDetails(artisanId, bankDetails);
        res.status(200).json({ message: 'Bank details updated successfully. KYC verification may be required.' });

    } catch (error) {
        console.error('Error updating bank details:', error);
        if (error.message.includes('required')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error updating bank details.' });
    }
});

router.get('/profile/kyc-status', authenticateToken, authorizeRoles(['artisan']), async (req, res) => {
    try {
        const artisanId = req.user.id;
        const kycStatus = await Artisan.getKycStatus(artisanId);

        if (!kycStatus) {
            return res.status(404).json({ message: 'Artisan not found or KYC status unavailable.' });
        }

        res.status(200).json({
            status: kycStatus.kyc_status,
            rejection_reason: kycStatus.rejection_reason || null
        });
    } catch (error) {
        console.error('Error fetching KYC status:', error);
        res.status(500).json({ message: 'Server error fetching KYC status.' });
    }
});

module.exports = router;