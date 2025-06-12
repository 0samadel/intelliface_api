// ────────────────────────────────────────────────────────────────────────────────
// File    : routes/attendanceRoutes.js
// Purpose : Routes for handling attendance actions (check-in, check-out, view, delete)
// Access  : Employee and Admin (role-based)
// ────────────────────────────────────────────────────────────────────────────────

/* ============================================================================
 * 1. Imports
 * ========================================================================== */
const express = require('express');
const router = express.Router();

const attendanceController = require('../controllers/attendanceController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

/* ============================================================================
 * 2. Safety Checks (Optional but recommended in dev)
 * ========================================================================== */
const controllerFunctionsToVerify = [
  'checkIn',
  'checkOut',
  'getAllAttendance',
  'deleteAttendance',
  'getTodaysAttendanceForUser'
];

let allControllerFunctionsOk = true;

controllerFunctionsToVerify.forEach(fn => {
  if (typeof attendanceController[fn] !== 'function') {
    console.error(`❌ ERROR: attendanceController.${fn} is missing or not a function.`);
    allControllerFunctionsOk = false;
  }
});

if (!allControllerFunctionsOk) {
  console.error("🚨 One or more attendanceController functions are missing. Exiting...");
  process.exit(1);
}

if (typeof verifyToken !== 'function') {
  console.error("❌ ERROR: verifyToken middleware is not a function.");
  process.exit(1);
} else {
  console.log("✅ verifyToken middleware loaded.");
}

if (typeof verifyAdmin !== 'function') {
  console.error("❌ ERROR: verifyAdmin middleware is not a function.");
  process.exit(1);
} else {
  console.log("✅ verifyAdmin middleware loaded.");
}

/* ============================================================================
 * 3. Routes
 * ========================================================================== */

// ─── Employee Actions (Token required) ───────────────────────────────────────
router.post('/checkin', verifyToken, attendanceController.checkIn);
router.post('/checkout', verifyToken, attendanceController.checkOut);
router.get('/me/today', verifyToken, attendanceController.getTodaysAttendanceForUser);

// ─── Admin Actions (Token + Admin Role required) ─────────────────────────────
router.get('/', verifyToken, verifyAdmin, attendanceController.getAllAttendance);
router.delete('/:id', verifyToken, verifyAdmin, attendanceController.deleteAttendance);

/* ============================================================================
 * 4. Export Router
 * ========================================================================== */
module.exports = router;
/* ───────────────────────────────────────────────────────────────────────────── */
