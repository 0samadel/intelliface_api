// intelliface_api/routes/profileRoutes.js
const express = require('express');
const { getMyProfile, updateMyProfile } = require('../controllers/userProfileController');
const { verifyToken } = require('../middleware/authMiddleware');
const handleMulterUpload = require('../middleware/uploadMiddleware'); // Import the handler

const router = express.Router();

router.use(verifyToken);

router.route('/me')
  .get(getMyProfile)
  .put(handleMulterUpload('profileImage'), updateMyProfile); // Use it like this

module.exports = router;