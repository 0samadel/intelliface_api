// ─────────────────────────────────────────────────────────────────────────────
// controllers/userProfileController.js
// ─────────────────────────────────────────────────────────────────────────────

const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// PUT /api/faces/profile
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

    // Delete old image if exists
    if (user.profilePicture && user.profilePicture.startsWith('uploads/')) {
      const oldPicPath = path.join(__dirname, '..', user.profilePicture);
      if (fs.existsSync(oldPicPath)) {
        try {
          fs.unlinkSync(oldPicPath);
          console.log('🗑️ Deleted old profile image:', oldPicPath);
        } catch (err) {
          console.error('⚠️ Error deleting old image:', err);
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
