// --- START OF FILE routes/dashboardRoutes.js ---
const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
// const { verifyAdmin } = require('../middleware/authMiddleware'); // Temporarily removed

// Temporarily allow open access
// router.use(verifyAdmin);

router.get('/stats', getDashboardStats);

module.exports = router;
// --- END OF FILE routes/dashboardRoutes.js ---
