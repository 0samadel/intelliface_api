// ────────────────────────────────────────────────────────────────────────────────
// File    : middleware/faceUploadMiddleware.js
// Purpose : Handles temporary face image uploads using Multer in memory.
// ────────────────────────────────────────────────────────────────────────────────

const multer = require('multer');

// Store files in memory as Buffer objects. This avoids disk I/O issues.
const storage = multer.memoryStorage();

// Filter to accept only image files.
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    // Create a specific error that can be caught by error handlers.
    const err = new Error('File is not an image! Please upload only images.');
    err.status = 400; // Bad Request
    cb(err, false);
  }
};

// Create the Multer instance.
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload;
