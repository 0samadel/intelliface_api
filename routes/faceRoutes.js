// ────────────────────────────────────────────────────────────────────────────────
// File    : routes/faceRoutes.js (WITH DEBUG LOGGING)
// ────────────────────────────────────────────────────────────────────────────────

const express  = require('express');
const axios    = require('axios');
const FormData = require('form-data');
const fs       = require('fs');
const router   = express.Router();

const User     = require('../models/User');
const upload   = require('../middleware/faceUploadMiddleware');

const PYTHON_SERVICE_URL = 'https://face-rec-service-1.onrender.com';

router.post('/enroll/:userId', upload.single('face'), async (req, res) => {
  console.log('--- [Enroll Face] Route Started ---');
  
  const { userId } = req.params;
  console.log(`[Enroll Face] 1. Received request for userId: ${userId}`);

  if (!req.file) {
    console.error('[Enroll Face] ❌ ERROR: No image file was provided in the request.');
    return res.status(400).json({ message: 'No image file provided.' });
  }
  console.log(`[Enroll Face] 2. Received file: ${req.file.originalname}, path: ${req.file.path}`);

  try {
    console.log('[Enroll Face] 3. Searching for user in database...');
    const user = await User.findById(userId);

    if (!user) {
      console.error(`[Enroll Face] ❌ ERROR: User not found with ID: ${userId}`);
      fs.unlinkSync(req.file.path); // Clean up file
      return res.status(404).json({ message: 'User not found.' });
    }
    console.log(`[Enroll Face] 4. User found: ${user.username}`);

    console.log('[Enroll Face] 5. Preparing form data to send to Python service...');
    const form = new FormData();
    form.append('face', fs.createReadStream(req.file.path));
    console.log('[Enroll Face] 6. Form data prepared.');

    console.log(`[Enroll Face] 7. Sending request to Python service at: ${PYTHON_SERVICE_URL}/generate-embedding`);
    const pyResponse = await axios.post(`${PYTHON_SERVICE_URL}/generate-embedding`, form, {
      headers: form.getHeaders(),
      timeout: 90000 // 90 second timeout
    });
    console.log('[Enroll Face] 8. Received response from Python service. Status:', pyResponse.status);

    const { embedding } = pyResponse.data;
    if (!embedding) {
      console.error('[Enroll Face] ❌ ERROR: Python service responded but no embedding was found.');
      return res.status(400).json({ message: 'No face detected in the image.' });
    }
    console.log('[Enroll Face] 9. Embedding received successfully.');

    user.faceEmbeddings = embedding;
    console.log('[Enroll Face] 10. Saving user with new embedding to the database...');
    await user.save();
    console.log('[Enroll Face] 11. User saved successfully.');

    console.log('--- [Enroll Face] ✅ Route Succeeded ---');
    res.status(200).json({ message: 'Face enrolled successfully.' });

  } catch (err) {
    console.error('--- [Enroll Face] ❌ CATCH BLOCK ERROR ---');
    if (axios.isCancel(err)) {
        console.error('[Enroll Face] ERROR TYPE: Axios request timed out.');
        return res.status(504).json({ message: 'Face processing service timed out. Please try again.' });
    }
    console.error('[Enroll Face] Raw Error Message:', err.message);
    if (err.response) {
      console.error('[Enroll Face] Error Response Status:', err.response.status);
      console.error('[Enroll Face] Error Response Data:', JSON.stringify(err.response.data, null, 2));
    }
    console.error('--- [Enroll Face] End of Error Details ---');

    res.status(500).json({ 
        message: 'Enrollment failed. Check server logs for details.'
    });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      console.log('[Enroll Face] 12. Cleaning up temporary file.');
      fs.unlinkSync(req.file.path);
    }
    console.log('--- [Enroll Face] Route Finished ---');
  }
});


// The verify route remains unchanged, but you can add similar logging if needed.
router.post('/verify/:userId', upload.single('face'), async (req, res) => {
    // ... verification logic ...
});

module.exports = router;
