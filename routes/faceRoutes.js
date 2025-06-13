// ────────────────────────────────────────────────────────────────────────────────
// File    : routes/faceRoutes.js
// Purpose : Handle face enrollment and verification via a Python microservice.
// ────────────────────────────────────────────────────────────────────────────────

/* ============================================================================
 * 1. Imports
 * ========================================================================== */
const express  = require('express');
const axios    = require('axios');
const FormData = require('form-data');
const fs       = require('fs');
const router   = express.Router();

const User     = require('../models/User');
const upload   = require('../middleware/faceUploadMiddleware');

/* ============================================================================
 * 2. Config: Python microservice base URL
 * ========================================================================== */
// This URL should point to your deployed Python service on OnRender.
const PYTHON_SERVICE_URL = 'https://face-rec-service-1.onrender.com';

/* ============================================================================
 * 3. Route: Enroll Face
 * @desc    Generate and store face embedding for a user.
 * @route   POST /api/faces/enroll/:userId
 * ========================================================================== */
router.post('/enroll/:userId', upload.single('face'), async (req, res) => {
  const { userId } = req.params;
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      // Important: Clean up the uploaded file if the user is not found.
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'User not found.' });
    }

    // Prepare form data for the Python service.
    const form = new FormData();
    form.append('face', fs.createReadStream(req.file.path));

    // Call the Flask service with an increased timeout to handle "cold starts".
    const pyResponse = await axios.post(`${PYTHON_SERVICE_URL}/generate-embedding`, form, {
      headers: form.getHeaders(),
      timeout: 90000 // 90,000 milliseconds = 90 seconds
    });

    const { embedding } = pyResponse.data;
    if (!embedding) {
      // This case handles when the Python service runs but detects no face.
      return res.status(400).json({ message: 'No face detected in the image.' });
    }

    // Correctly assign the embedding array to the user's field.
    user.faceEmbeddings = embedding; 
    await user.save();

    res.status(200).json({ message: 'Face enrolled successfully.' });

  } catch (err) {
    console.error('Enroll error:', err.response?.data || err.message);
    
    // Specifically handle timeout errors from Axios for clearer feedback.
    if (axios.isCancel(err)) {
        console.error('Request to Python service timed out.');
        return res.status(504).json({ message: 'Face processing service timed out. Please try again in a minute.' });
    }

    // Handle other errors, including those from the Python service.
    res.status(err.response?.status || 500).json({ 
        message: err.response?.data?.error || 'Enrollment failed due to an internal error.'
    });
  } finally {
    // Clean up the temporary file in all cases.
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

/* ============================================================================
 * 4. Route: Verify Face
 * @desc    Compare submitted face against stored embedding.
 * @route   POST /api/faces/verify/:userId
 * ========================================================================== */
router.post('/verify/:userId', upload.single('face'), async (req, res) => {
  const { userId } = req.params;
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided.' });
  }

  try {
    const user = await User.findById(userId).select('+faceEmbeddings');
    if (!user || !user.faceEmbeddings?.length) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'User has no enrolled face.' });
    }

    const form = new FormData();
    form.append('face', fs.createReadStream(req.file.path));
    // Correctly stringify the entire embedding array.
    form.append('stored_embedding', JSON.stringify(user.faceEmbeddings));

    // Call the Flask service with an increased timeout.
    const pyResponse = await axios.post(`${PYTHON_SERVICE_URL}/compare-faces`, form, {
      headers: form.getHeaders(),
      timeout: 90000 // 90 second timeout
    });

    const { is_match } = pyResponse.data;
    if (is_match) {
      return res.json({ verified: true, message: 'Face matched.' });
    }

    res.status(401).json({ verified: false, message: 'Face did not match.' });

  } catch (err) {
    console.error('Verify error:', err.response?.data || err.message);

    if (axios.isCancel(err)) {
        console.error('Request to Python service timed out.');
        return res.status(504).json({ message: 'Face verification service timed out. Please try again.' });
    }

    res.status(err.response?.status || 500).json({ 
        message: err.response?.data?.error || 'Verification failed due to an internal error.'
    });
  } finally {
    // Clean up the temporary file in all cases.
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

/* ============================================================================
 * 5. Export Router
 * ========================================================================== */
module.exports = router;
/* ───────────────────────────────────────────────────────────────────────────── */
