const express = require('express');
const router = express.Router();

const attendanceController = require('../controllers/attendanceController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware'); // Ensure paths are correct

// --- Controller Function Verification (Optional Safety Check) ---
const controllerFunctionsToVerify = ['checkIn', 'checkOut', 'getAllAttendance', 'deleteAttendance', 'getTodaysAttendanceForUser'];
let allControllerFunctionsOk = true;

controllerFunctionsToVerify.forEach(fnName => {
  if (attendanceController && typeof attendanceController[fnName] === 'function') {
    // Optional: console.log(`attendanceController.${fnName} loaded successfully.`);
  } else {
    console.error(`FATAL ERROR: attendanceController.${fnName} is not defined or not a function.`);
    allControllerFunctionsOk = false;
  }
});

if (!allControllerFunctionsOk) {
  console.error("One or more attendance controller functions failed to load. Shutting down server.");
  process.exit(1);
}

// --- Middleware Verification Logs ---
if (typeof verifyToken !== 'function') {
  console.error("FATAL ERROR: verifyToken middleware is not a function.");
  process.exit(1);
} else {
  console.log("attendanceRoutes.js: verifyToken middleware loaded successfully.");
}

if (typeof verifyAdmin !== 'function') {
  console.error("FATAL ERROR: verifyAdmin middleware is not a function.");
  process.exit(1);
} else {
  console.log("attendanceRoutes.js: verifyAdmin middleware loaded successfully.");
}

// --- Employee Routes (Require valid token) ---
router.post('/checkin', verifyToken, attendanceController.checkIn);
router.post('/checkout', verifyToken, attendanceController.checkOut);
router.get('/me/today', verifyToken, attendanceController.getTodaysAttendanceForUser);

// --- Admin Routes (Require valid token + admin role) ---
router.get('/', verifyToken, verifyAdmin, attendanceController.getAllAttendance);
router.delete('/:id', verifyToken, verifyAdmin, attendanceController.deleteAttendance);

// --- Export the router ---
module.exports = router;
