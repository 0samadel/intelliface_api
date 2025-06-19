// ────────────────────────────────────────────────────────────────────────────────
// controllers/userProfileController.js
// Purpose  : Manage the logged-in user's own profile (GET, UPDATE, Photo Only)
// ────────────────────────────────────────────────────────────────────────────────

const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// GET /api/profile/me
exports.getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).populate('department', 'name');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const userProfile = user.toObject();
    delete userProfile.password;
    delete userProfile.faceEmbeddings;
    res.status(200).json({ success: true, data: userProfile });
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    next(error);
  }
};

// PUT /api/profile/me/photo
exports.updateProfilePhoto = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    // Delete old profile picture if it exists
    if (user.profilePicture && user.profilePicture.startsWith('uploads/')) {
      const oldPicPath = path.join(__dirname, '..', user.profilePicture);
      if (fs.existsSync(oldPicPath)) {
        try {
          fs.unlinkSync(oldPicPath);
          console.log('🗑️ Old profile picture deleted:', oldPicPath);
        } catch (unlinkErr) {
          console.error('⚠️ Error deleting old profile picture:', unlinkErr);
        }
      }
    }

    user.profilePicture = req.file.path.replace(/\\/g, "/");

    const updatedUser = await user.save();
    const userProfile = updatedUser.toObject();
    delete userProfile.password;
    delete userProfile.faceEmbeddings;

    res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully',
      data: userProfile,
    });

  } catch (error) {
    console.error('❌ Error updating profile photo:', error);
    next(error);
  }
};
