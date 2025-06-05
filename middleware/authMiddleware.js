// intelliface_api/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

exports.verifyToken = (req, res, next) => {
  // Added console logs for debugging at the start of the function
  console.log("BACKEND verifyToken: Middleware hit for URL:", req.originalUrl, "Method:", req.method);
  const authHeader = req.headers.authorization;
  console.log("BACKEND verifyToken: Auth Header Received:", authHeader);

  if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables for token verification.");
    return res.status(500).json({ success: false, message: 'Authentication configuration error.' });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Access token is required or malformed.' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Token not found.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // This should contain 'userId' based on your token generation
    console.log("BACKEND verifyToken: Token decoded successfully. req.user set:", req.user); // Debug
    next();
  } catch (err) {
    console.error("BACKEND verifyToken: Token Verification Error:", err.name, "-", err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Unauthorized: Token has expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token.' });
    }
    return res.status(401).json({ success: false, message: 'Unauthorized: Token verification failed.' });
  }
};

exports.verifyAdmin = (req, res, next) => {
  if (!req.user || !req.user.role) {
    console.error("BACKEND verifyAdmin Error: req.user or req.user.role not set.");
    return res.status(401).json({ success: false, message: 'Unauthorized: User role not determined.' });
  }

  if (req.user.role !== 'admin') {
    console.log(`BACKEND verifyAdmin: Access Denied. Role '${req.user.role}' is not 'admin'. User: ${req.user.username || req.user.userId}`);
    return res.status(403).json({ success: false, message: 'Forbidden: Access restricted to administrators.' });
  }
  next();
};