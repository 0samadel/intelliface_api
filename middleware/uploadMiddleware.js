// intelliface_api/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // To create directory if it doesn't exist

// Define a specific subfolder for profile pictures within 'uploads'
const UPLOADS_PROFILE_FOLDER = path.join('uploads', 'profiles'); // e.g., uploads/profiles/

// Ensure the uploads/profiles directory exists
// This creates it relative to the project root (where server.js is usually run from)
const fullUploadPath = path.join(__dirname, '..', UPLOADS_PROFILE_FOLDER); // Path from middleware dir up to root, then down
if (!fs.existsSync(fullUploadPath)) {
    try {
        fs.mkdirSync(fullUploadPath, { recursive: true }); // recursive: true creates parent dirs if needed
        console.log(`Uploads directory created: ${fullUploadPath}`);
    } catch (err) {
        console.error(`Error creating uploads directory ${fullUploadPath}:`, err);
        // Decide if you want to throw the error or let the app continue (multer might fail later)
    }
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Save to the specific profile pictures subfolder
    cb(null, UPLOADS_PROFILE_FOLDER); // This path is relative to where multer is configured to save from (project root)
  },
  filename: function (req, file, cb) {
    // Create a unique filename: fieldname-userid-timestamp.ext
    // req.user should be populated by verifyToken middleware
    const userIdPart = req.user && req.user.userId ? req.user.userId : 'unknownUser';
    const uniqueSuffix = userIdPart + '-' + Date.now() + path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix);
  }
});

// File validation
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF|webp|WEBP)$/i)) { // Added webp, case-insensitive
    // You can pass an error to cb to reject the file
    // cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'), false);
    // Or, to just reject without an explicit error that stops multer:
    req.fileValidationError = 'Only image files are allowed!'; // Attach error to req for custom handling
    return cb(null, false); // Reject the file
  }
  cb(null, true); // Accept the file
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5 // 5MB limit
  },
  fileFilter: fileFilter
});

// Middleware to handle file validation errors from multer's fileFilter
const handleMulterUpload = (fieldName) => (req, res, next) => {
    const uploader = upload.single(fieldName); // 'profileImage' or whatever field name you expect
    uploader(req, res, function (err) {
        if (req.fileValidationError) { // Check for custom validation error
            return res.status(400).json({ success: false, message: req.fileValidationError });
        }
        if (err instanceof multer.MulterError) { // A Multer error occurred when uploading.
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, message: `File too large. Max size is ${upload.limits.fileSize / (1024 * 1024)}MB.` });
            }
            return res.status(400).json({ success: false, message: `Multer error: ${err.message}` });
        } else if (err) { // An unknown error occurred when uploading.
            return res.status(500).json({ success: false, message: `File upload error: ${err.message}` });
        }
        // Everything went fine.
        next();
    });
};


// module.exports = upload; // Original simple export
module.exports = handleMulterUpload; // Export the handler function