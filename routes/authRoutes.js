// --- routes/authRoutes.js ---
const express = require('express');
const router = express.Router();

// Import the entire controller object
const authController = require('../controllers/authController');

// Verification logs (run once at startup)
if (typeof authController.register !== 'function') {
  console.error("FATAL ERROR in authRoutes.js: authController.register is not a function! Check exports in authController.js. Value:", authController.register);
} else {
  console.log("authRoutes.js: authController.register loaded successfully.");
}

if (typeof authController.login !== 'function') {
  console.error("FATAL ERROR in authRoutes.js: authController.login is not a function! Check exports in authController.js. Value:", authController.login);
} else {
  console.log("authRoutes.js: authController.login loaded successfully.");
}

// Use the functions from the imported object
// The /register route might need admin protection if only admins can create any user type.
// If employees can self-register, then no protection or a different type of protection is needed.
// For now, assuming /register is for admin creating users or initial setup.
router.post('/register', authController.register);  // Could be for admin creating users or self-registration
router.post('/login', authController.login);        // Employees and admins login via this single endpoint

module.exports = router;