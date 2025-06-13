// ────────────────────────────────────────────────────────────────────────────────
// File    : routes/faceRoutes.js
// Purpose : Handle face enrollment and verification via a Python microservice.
// ────────────────────────────────────────────────────────────────────────────────

/* ============================================================================
 * 1. Imports and Setup
 * ========================================================================== */
const express  = require('express');
const axios    = require('axios');
const FormData = require('form-data');
const fs       = require('fs');
const router   = express.Router();

const User   = require('../models/User');
const upload = require('../middleware/faceUploadMiddleware');

/* ============================================================================
 * 2. Configuration
 * ========================================================================== */
const PYTHON_SERVICE_URL = 'https://face-rec-service-1.onrender.com';
const AXIOS_TIMEOUT = 90000; // 90 seconds for cold starts

/* ============================================================================
 * 3. Route Handlers (Controllers)
 *
 * Each function handles the core logic for a specific route. This keeps
 * the route definitions clean and separates concerns.
 * ========================================================================== */

/**
 * @controller  handleEnrollFace
 * @desc        Processes face enrollment request, calls Python service, and saves embedding.
 */
const handleEnrollFace = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Prepare form data and call Python service
    const form = new FormData();
    form.append('face', fs.createReadStream(req.file.path));

    const pyResponse = await axios.post(`${PYTHON_SERVICE_URL}/generate-embedding`, form, {
      headers: form.getHeaders(),
      timeout: AXIOS_TIMEOUT
    });

    const { embedding } = pyResponse.data;
    if (!embedding) {
      return res.status(400).json({ message: 'No face detected in the image.' });
    }

    // Save embedding and respond
    user.faceEmbeddings = embedding;
    await user.save();

    res.status(200).json({ message: 'Face enrolled successfully.' });

  } catch (error) {
    // Pass any errors to the centralized error handler
    next(error);
  } finally {
    // Ensure temporary file is always cleaned up
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
};


/**
 * @controller  handleVerifyFace
 * @desc        Processes face verification, calls Python service, and returns match status.
 */
const handleVerifyFace = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    const user = await User.findById(userId).select('+faceEmbeddings');
    if (!user || !user.faceEmbeddings?.length) {
      return res.status(404).json({ message: 'User has no enrolled face.' });
    }

    // Prepare form data and call Python service
    const form = new FormData();
    form.append('face', fs.createReadStream(req.file.path));
    form.append('stored_embedding', JSON.stringify(user.faceEmbeddings));

    const pyResponse = await axios.post(`${PYTHON_SERVICE_URL}/compare-faces`, form, {
      headers: form.getHeaders(),
      timeout: AXIOS_TIMEOUT
    });

    // Respond based on match status
    if (pyResponse.data.is_match) {
      return res.json({ verified: true, message: 'Face matched.' });
    } else {
      return res.status(401).json({ verified: false, message: 'Face did not match.' });
    }
  
  } catch (error) {
    next(error);
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
};


/* ============================================================================
 * 4. Error Handling Middleware (for this route file)
 *
 * This middleware catches errors from the controllers and formats a
 * consistent JSON response.
 * ========================================================================== */

const handleRouteError = (err, req, res, next) => {
  console.error(`[Face Route Error] ${err.message}`);
  
  // Handle Axios timeout error specifically
  if (axios.isCancel(err)) {
    return res.status(504).json({ message: 'Face service timed out. Please try again.' });
  }

  // Handle errors coming from the Python service
  if (err.response) {
    console.error('[Python Service Response Error]', err.response.data);
    return res.status(err.response.status || 500).json({ 
        message: err.response.data.error || 'An error occurred during face processing.'
    });
  }
  
  // Handle other generic server errors
  res.status(500).json({ message: 'An internal server error occurred.' });
};


/* ============================================================================
 * 5. Route Definitions
 * ========================================================================== */

// @route   POST /api/faces/enroll/:userId
// @desc    Enroll a new face for a user
router.post(
  '/enroll/:userId',
  upload.single('face'), // Multer middleware for file upload
  handleEnrollFace       // Controller function for route logic
);

// @route   POST /api/faces/verify/:userId
// @desc    Verify a face against a user's stored embedding
router.post(
  '/verify/:userId',
  upload.single('face'),
  handleVerifyFace
);


// Apply the custom error handler to all routes in this file
router.use(handleRouteError);


/* ============================================================================
 * 6. Export Router
 * ========================================================================== */
module.exports = router;
