// intelliface_api/controllers/userProfileController.js
const User = require('../models/User'); // Assuming User.js is the filename
const fs = require('fs'); // For file system operations if deleting old profile pics
const path = require('path'); // For path operations

// @desc    Get current logged-in user's profile
// @route   GET /api/profile/me
// @access  Private
exports.getMyProfile = async (req, res, next) => {
  try {
    // req.user.userId is populated by verifyToken middleware
    const user = await User.findById(req.user.userId).populate('department', 'name'); // Populate department name

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // We don't want to send the password hash, even if User model has select: false,
    // it's good practice to explicitly remove it or create a DTO.
    const userProfile = user.toObject(); // Convert to plain object
    delete userProfile.password;
    delete userProfile.faceEmbeddings; // Usually not sent to client profile

    res.status(200).json({ success: true, data: userProfile });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    next(error);
  }
};

// @desc    Update current logged-in user's profile
// @route   PUT /api/profile/me
// @access  Private
exports.updateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { fullName, phone, email, username, address } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Fields to update
    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    // Handle username and email updates carefully due to uniqueness
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: userId } });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email already in use by another account.' });
      }
      user.email = email;
    }
    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ username, _id: { $ne: userId } });
      if (usernameExists) {
        return res.status(400).json({ success: false, message: 'Username already taken.' });
      }
      user.username = username;
    }

    // Handle profile picture upload
    if (req.file) {
      // If there was an old profile picture and we are storing locally, delete it
      if (user.profilePicture && user.profilePicture.startsWith('uploads/')) {
        const oldPicPath = path.join(__dirname, '..', user.profilePicture); // Adjust path as needed
        if (fs.existsSync(oldPicPath)) {
          try {
             fs.unlinkSync(oldPicPath);
             console.log('Old profile picture deleted:', oldPicPath);
          } catch (unlinkErr) {
             console.error('Error deleting old profile picture:', unlinkErr);
          }
        }
      }
      // Save the path of the new profile picture
      // req.file.path is set by multer (e.g., 'uploads/image-timestamp.jpg')
      user.profilePicture = req.file.path.replace(/\\/g, "/"); // Normalize path for Windows/Unix
    }

    const updatedUser = await user.save();

    const userProfile = updatedUser.toObject();
    delete userProfile.password;
    delete userProfile.faceEmbeddings;

    res.status(200).json({ success: true, data: userProfile, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ success: false, message: error.message });
    }
    // If file upload failed and req.file exists, multer might have already sent a response
    // or the error might be from fs operations.
    next(error);
  }
};