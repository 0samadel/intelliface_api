// ────────────────────────────────────────────────────────────────────────────────
// File    : routes/attendanceRoutes.js 
// Purpose : Routes for handling attendance actions (check-in, check-out, view, delete)
// ────────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const upload = require('../middleware/faceUploadMiddleware'); // Import multer

// ─── Employee Actions (Token required) ───────────────────────────────────────

// @route   POST /api/attendance/
// @desc    Handles employee check-in. The file is handled by middleware.
router.post(
  '/', 
  verifyToken, 
  upload.single('face'), // Middleware processes the 'face' file upload
  attendanceController.checkIn
);

// @route   PUT /api/attendance/checkout
// @desc    Handles employee check-out.
router.put(
  '/checkout', 
  verifyToken, 
  upload.single('face'), // Also handles file for checkout verification
  attendanceController.checkOut
);

// @route   GET /api/attendance/me/today
// @desc    Gets today's attendance record for the logged-in user.
router.get(
  '/me/today', 
  verifyToken, 
  attendanceController.getTodaysAttendanceForUser
);

// ─── Admin Actions (Token + Admin Role required) ─────────────────────────────
router.get('/', verifyToken, verifyAdmin, attendanceController.getAllAttendance);
router.delete('/:id', verifyToken, verifyAdmin, attendanceController.deleteAttendance);

module.exports = router;
