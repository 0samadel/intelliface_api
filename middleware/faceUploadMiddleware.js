// ────────────────────────────────────────────────────────────────────────────────
// File    : middleware/faceUploadMiddleware.js
// Purpose : Handles temporary face image uploads using Multer
// Access  : Used in routes that handle face image uploads for verification/enrollment
// ────────────────────────────────────────────────────────────────────────────────

/* ============================================================================
 * 1. Imports & Constants
 * ========================================================================== */
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define a directory for temporary face image uploads
const UPLOAD_DIR = path.join(__dirname, '..', 'temp_face_uploads');

/* ============================================================================
 * 2. Ensure Upload Directory Exists
 * ========================================================================== */
fs.mkdirSync(UPLOAD_DIR, { recursive: true }); // Creates directory if it doesn't exist

/* ============================================================================
 * 3. Configure Multer Storage
 * ========================================================================== */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR); // All images saved in temp_face_uploads/
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

/* ============================================================================
 * 4. File Filter (Only Accept Images)
 * ========================================================================== */
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true); // Accept image file
  } else {
    cb(new Error('File is not an image! Please upload only images.'), false); // Reject others
  }
};

/* ============================================================================
 * 5. Multer Upload Instance
 * ========================================================================== */
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Max: 5MB
  },
  fileFilter: fileFilter
});

/* ============================================================================
 * 6. Export Middleware
 * ========================================================================== */
module.exports = upload;
/* ───────────────────────────────────────────────────────────────────────────── */
