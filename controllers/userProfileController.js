// ─────────────────────────────────────────────────────────────────────────────
// File    : controllers/userProfileController.js
// Purpose : Handles profile fetching, full update, and photo-only update
// ─────────────────────────────────────────────────────────────────────────────

const User = require('../models/User');
const fs = require('fs');
const path = require('path');

/**
 * @desc   Get current logged-in user's profile
 * @route  GET /api/profile/me
 * @access Private
 */
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

/**
 * @desc   Update full profile (name, email, username, etc.) + optional photo
 * @route  PUT /api/profile/me
 * @access Private
 */
exports.updateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { fullName, phone, email, username, address } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update text fields if provided
    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    // Unique email check
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: userId } });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email already in use by another account.' });
      }
      user.email = email;
    }

    // Unique username check
    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ username, _id: { $ne: userId } });
      if (usernameExists) {
        return res.status(400).json({ success: false, message: 'Username already taken.' });
      }
      user.username = username;
    }

    // Handle profile image upload if provided
    if (req.file) {
      if (user.profilePicture && user.profilePicture.startsWith('uploads/')) {
        const oldPath = path.join(__dirname, '..', user.profilePicture);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      user.profilePicture = req.file.path.replace(/\\/g, "/");
    }

    const updatedUser = await user.save();
    const userProfile = updatedUser.toObject();
    delete userProfile.password;
    delete userProfile.faceEmbeddings;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: userProfile,
    });

  } catch (error) {
    console.error('❌ Error updating profile:', error);
    next(error);
  }
};

/**
 * @desc   Update profile photo only
 * @route  PUT /api/profile/photo
 * @access Private
 */
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

    // Delete old image
    if (user.profilePicture && user.profilePicture.startsWith('uploads/')) {
      const oldPath = path.join(__dirname, '..', user.profilePicture);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
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
