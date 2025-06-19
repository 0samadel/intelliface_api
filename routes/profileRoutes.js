// ─────────────────────────────────────────────────────────────────────────────
// File    : routes/profileRoutes.js
// Purpose : Handles authenticated user profile retrieval, editing & photo upload
// Access  : Private (Requires valid JWT via verifyToken middleware)
// ─────────────────────────────────────────────────────────────────────────────

/* ============================================================================
 * 1. Imports
 * ========================================================================== */
const express = require('express');
const {
  getMyProfile,
  updateMyProfile,
  updateProfilePhoto,
} = require('../controllers/userProfileController');
const { verifyToken } = require('../middleware/authMiddleware');
const handleMulterUpload = require('../middleware/uploadMiddleware');

const router = express.Router();

/* ============================================================================
 * 2. Middleware
 * ========================================================================== */
router.use(verifyToken); // All routes require authenticated user

/* ============================================================================
 * 3. Routes
 * ========================================================================== */

// @route   GET /api/profile/me
// @desc    Get current user's profile info
// @access  Private
router.get('/me', getMyProfile);

// @route   PUT /api/profile/me
// @desc    Update profile info (name, email, etc.)
// @access  Private
router.put('/me', handleMulterUpload('profileImage'), updateMyProfile);

// @route   PUT /api/profile/photo
// @desc    Update profile picture only
// @access  Private
router.put('/photo', handleMulterUpload('profileImage'), updateProfilePhoto);

/* ============================================================================
 * 4. Export
 * ========================================================================== */
module.exports = router;
/* ───────────────────────────────────────────────────────────────────────────── */
