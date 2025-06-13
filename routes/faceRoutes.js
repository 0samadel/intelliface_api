// ────────────────────────────────────────────────────────────────────────────────
// File    : routes/faceRoutes.js
// Purpose : Handle face enrollment and verification via a Python microservice
// Routes  : 
//    POST /api/faces/enroll/:userId
//    POST /api/faces/verify/:userId
// Access  : 🔒 Should be protected in production (e.g., verifyToken)
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
const PYTHON_SERVICE_URL = 'https://face-rec-service-1.onrender.com'; // Flask service URL

/* ============================================================================
 * 3. Route: Enroll Face
 * @desc    Generate and store face embedding for a user
 * @route   POST /api/faces/enroll/:userId
 * ========================================================================== */
router.post('/enroll/:userId', upload.single('face'), async (req, res) => {
  const { userId } = req.params;
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Prepare form data for Python service
    const form = new FormData();
    form.append('face', fs.createReadStream(req.file.path));

    // Call Flask: /generate-embedding
    const pyResponse = await axios.post(`${PYTHON_SERVICE_URL}/generate-embedding`, form, {
      headers: form.getHeaders(),
    });

    const { embedding } = pyResponse.data;
    if (!embedding) {
      return res.status(400).json({ message: 'No face detected.' });
    }

    user.faceEmbeddings = embedding; 
    await user.save();

    res.status(200).json({ message: 'Face enrolled successfully.' });
  } catch (err) {
    console.error('Enroll error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ message: 'Enrollment failed.' });
  } finally {
    // Clean up temp file
    fs.unlinkSync(req.file.path);
  }
});

/* ============================================================================
 * 4. Route: Verify Face
 * @desc    Compare submitted face against stored embedding
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
      return res.status(404).json({ message: 'User has no enrolled face.' });
    }

    const form = new FormData();
    form.append('face', fs.createReadStream(req.file.path));
    form.append('stored_embedding', JSON.stringify(user.faceEmbeddings));

    // Call Flask: /compare-faces
    const pyResponse = await axios.post(`${PYTHON_SERVICE_URL}/compare-faces`, form, {
      headers: form.getHeaders(),
    });

    const { is_match } = pyResponse.data;
    if (is_match) {
      return res.json({ verified: true, message: 'Face matched.' });
    }

    res.status(401).json({ verified: false, message: 'Face did not match.' });
  } catch (err) {
    console.error('Verify error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ message: 'Verification failed.' });
  } finally {
    fs.unlinkSync(req.file.path);
  }
});

/* ============================================================================
 * 5. Export Router
 * ========================================================================== */
module.exports = router;
/* ───────────────────────────────────────────────────────────────────────────── */
