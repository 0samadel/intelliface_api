// --- controllers/authController.js ---
const User = require('../models/User'); // Assuming User.js is the filename in models
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Check for JWT_SECRET at startup - good practice
if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables. Server cannot sign tokens.");
  // process.exit(1); // Optionally exit if JWT_SECRET is critical for startup
}

exports.register = async (req, res) => {
  console.log("REGISTER ATTEMPT - Request Body:", req.body);
  try {
    const {
      fullName, email, username, password, role,
      department, employeeId, phone, address
    } = req.body;

    if (!fullName || !email || !username || !password) {
        return res.status(400).json({ success: false, message: 'Full name, email, username, and password are required.' });
    }
    // Check for existing user by email OR username
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] });
    if (existingUser) {
      let conflictField = '';
      if (existingUser.email === email.toLowerCase()) conflictField = 'email';
      if (existingUser.username === username.toLowerCase()) conflictField = conflictField ? 'email and username' : 'username';
      console.log(`REGISTER ATTEMPT - User already exists with ${conflictField}`);
      return res.status(400).json({ success: false, message: `User with this ${conflictField} already exists.` });
    }

    // Password is now hashed by the pre-save hook in User.js, so no need to hash here explicitly
    // const hashedPassword = await bcrypt.hash(password, 10); // REMOVE THIS LINE

    let finalEmployeeId = employeeId;
    // Simplified employeeId generation, consider a more robust method for production
    if ((!role || role === 'employee') && !employeeId) {
        const count = await User.countDocuments({ role: 'employee' });
        finalEmployeeId = `EMP${(count + 1).toString().padStart(4, '0')}`;
    } else if (role === 'admin' && !employeeId) {
        const adminCount = await User.countDocuments({ role: 'admin' });
        finalEmployeeId = `ADM${(adminCount + 1).toString().padStart(3, '0')}`;
    }

    const user = new User({
      fullName,
      email: email.toLowerCase(), // Store consistently
      username: username.toLowerCase(), // Store consistently
      password: password, // Pass plain password, pre-save hook will hash it
      role: role || 'employee',
      department: department || null,
      employeeId: finalEmployeeId,
      phone: phone || null,
      address: address || null,
    });

    await user.save(); // pre-save hook hashes the password
    console.log(`REGISTER SUCCESS - User registered: ${user.username}, Role: ${user.role}`);

    // Prepare user object for response (without password)
    const userToReturn = user.toObject();
    delete userToReturn.password; // Even if select:false, good practice after toObject()

    res.status(201).json({ success: true, message: 'User registered successfully', user: userToReturn });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
     if (err.code === 11000) { // MongoDB duplicate key error
        const dupField = Object.keys(err.keyValue || {})[0] || "unique field";
        return res.status(400).json({ success: false, message: `An account with this ${dupField} already exists.` });
    }
    if (err.name === 'ValidationError') {
        return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, error: 'Server error during registration. ' + err.message });
  }
};

// LOGIN FUNCTION
exports.login = async (req, res) => {
  console.log("--- LOGIN ATTEMPT ---");
  console.log("Request Body Received by Backend:", req.body);
  try {
    const { username, password: plainTextPasswordFromRequest } = req.body;

    if (!username || !plainTextPasswordFromRequest) {
      console.log("Backend Error: Username or password missing in request.");
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    console.log(`Backend: Searching for user with username: "${username.toLowerCase()}"`);
    const user = await User.findOne({ username: username.toLowerCase() }) // Query with lowercase username
                           .select('+password') // ***** THIS IS THE CRITICAL FIX *****
                           .populate('department', 'name'); // Populate department details

    if (!user) {
      console.log(`Backend: User NOT FOUND in DB for username: "${username.toLowerCase()}"`);
      // Generic message to avoid revealing whether username or password was wrong
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // At this point, 'user' is found, and 'user.password' (the hash) IS available due to .select('+password')
    console.log(`Backend: User FOUND (candidate): ${user.username}, Role: ${user.role}`);

    // Use the comparePassword method from the User model
    const isMatch = await user.comparePassword(plainTextPasswordFromRequest);

    if (!isMatch) {
      console.log(`Backend: Password MISMATCH for user: "${user.username}"`);
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    console.log(`Backend: Password MATCH for user: "${user.username}"`);

    // Create JWT Payload
    const tokenPayload = {
        userId: user._id.toString(), // Ensure it's a string
        role: user.role,
        username: user.username,
        fullName: user.fullName,
    };
    if (user.department && user.department._id) { // Check if department and its _id exist
        tokenPayload.departmentId = user.department._id.toString();
        tokenPayload.departmentName = user.department.name; // Assuming 'name' is the field in Department model
    }

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET, // Make sure this is defined in your .env
      // { expiresIn: '1d' } // Or from process.env.JWT_EXPIRES_IN
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Prepare user object for response (without password)
    const userToReturn = user.toObject();
    delete userToReturn.password; // Ensure password is not sent back

    res.status(200).json({
      success: true,
      token,
      user: userToReturn,
      message: 'Login successful',
    });

  } catch (err) {
    console.error("Backend login processing error:", err);
    // Avoid sending detailed error messages like err.message to the client in production
    res.status(500).json({ success: false, error: 'Server error during login. Please try again later.' });
  }
};