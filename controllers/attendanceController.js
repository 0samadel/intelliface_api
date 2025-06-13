// ────────────────────────────────────────────────────────────────────────────────
// File    : controllers/attendanceController.js (FINALIZED)
// Purpose : Handles employee check-in/out with face/location verification and attendance management
// ────────────────────────────────────────────────────────────────────────────────

const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Location = require('../models/Location');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const moment = require('moment');

const PYTHON_SERVICE_URL = 'https://face-rec-service-1.onrender.com';
const AXIOS_TIMEOUT = 90000; // 90 seconds

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const cleanupFile = (file) => {
  if (file && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
};

// controllers/attendanceController.js (WITH HEAVY DEBUGGING)

// ================== CHECK-IN ==================
exports.checkIn = async (req, res, next) => {
  console.log('--- ✅ CHECK-IN PROCESS STARTED ---');
  
  // Log everything we receive
  console.log('1. User from token:', JSON.stringify(req.user, null, 2));
  console.log('2. Request body:', JSON.stringify(req.body, null, 2));
  console.log('3. File received:', req.file ? `Yes, ${req.file.originalname}` : 'No file received!');

  const { latitude, longitude } = req.body;
  const userId = req.user.userId;

  // Check #1: Are all required fields present?
  if (!req.file || !userId || !latitude || !longitude) {
    console.error('❌ FAILED at Check #1: Missing required data.');
    cleanupFile(req.file);
    return res.status(400).json({ message: 'Face image, user ID, latitude, and longitude are required.' });
  }
  console.log('✅ PASSED Check #1: All required data is present.');

  try {
    console.log(`4. Finding user by ID: ${userId}`);
    const user = await User.findById(userId).select('+faceEmbeddings').populate({
      path: 'department',
      populate: { path: 'location' }
    });

    // Check #2: Does the user exist and have an enrolled face?
    if (!user || !user.faceEmbeddings?.length) {
      console.error('❌ FAILED at Check #2: User not found or face not enrolled.');
      return res.status(404).json({ message: 'User not found or face is not enrolled.' });
    }
    console.log('✅ PASSED Check #2: User found and face is enrolled.');

    // Check #3: Is the user assigned to a department with a location?
    if (!user.department?.location) {
      console.error('❌ FAILED at Check #3: User department or location is missing.');
      console.log('User Department Info:', JSON.stringify(user.department, null, 2));
      return res.status(400).json({ message: 'You are not assigned to a department with a location.' });
    }
    console.log(`✅ PASSED Check #3: User assigned to location: ${user.department.location.name}`);

    // Check #4: Has the user already checked in today?
    const todayStart = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();
    console.log(`5. Checking for existing attendance between ${todayStart} and ${todayEnd}`);
    const existingRecord = await Attendance.findOne({ userId, checkInTime: { $gte: todayStart, $lte: todayEnd } });
    
    if (existingRecord) {
      console.error('❌ FAILED at Check #4: User already checked in today.');
      return res.status(400).json({ message: 'You have already checked in today.' });
    }
    console.log('✅ PASSED Check #4: No existing check-in found for today.');

    // If all checks pass, proceed with verification and saving...
    console.log('6. All pre-checks passed. Proceeding to face and location verification.');
    
    // ... (The rest of your verification and saving logic) ...
    // --- Face Verification ---
    const form = new FormData();
    form.append('face', fs.createReadStream(req.file.path));
    form.append('stored_embedding', JSON.stringify(user.faceEmbeddings));
    const pyResponse = await axios.post(`${PYTHON_SERVICE_URL}/compare-faces`, { headers: form.getHeaders(), timeout: AXIOS_TIMEOUT });
    if (!pyResponse.data.is_match) {
        return res.status(401).json({ message: 'Face verification failed.' });
    }
    console.log('✅ PASSED Face Verification.');

    // --- Location Verification ---
    const officeLocation = user.department.location;
    const distance = getDistanceInMeters(latitude, longitude, officeLocation.latitude, officeLocation.longitude);
    if (distance > officeLocation.radius) {
        return res.status(403).json({ message: `Check-in denied. You are outside the work radius.` });
    }
    console.log('✅ PASSED Location Verification.');

    // --- Create Record ---
    const checkInTime = moment();
    const onTimeDeadline = moment().startOf('day').hour(9).minute(0).second(0);
    const status = checkInTime.isAfter(onTimeDeadline) ? 'Late' : 'Present';
    const attendance = new Attendance({ userId, checkInTime: checkInTime.toDate(), status, location: { latitude, longitude } });
    await attendance.save();
    console.log('✅ Attendance record saved.');
    
    const newRecord = await Attendance.findById(attendance._id).populate('userId', 'fullName employeeId');
    res.status(201).json({ message: `Checked in successfully as ${status}!`, attendance: newRecord });

  } catch (error) {
    console.error('--- ❌ CATCH BLOCK ERROR ---');
    console.error('Error Message:', error.message);
    if(error.response) console.error('Error Response:', error.response.data);
    next(error);
  } finally {
    cleanupFile(req.file);
  }
};


// ================== CHECK-OUT ==================
exports.checkOut = async (req, res, next) => {
    const userId = req.user.userId;
    if (!req.file) {
        return res.status(400).json({ message: 'Face image is required for check-out.' });
    }

    try {
        const user = await User.findById(userId).select('+faceEmbeddings');
        if (!user || !user.faceEmbeddings?.length) {
            return res.status(404).json({ message: 'User not found or face not enrolled.' });
        }

        // --- Face Verification ---
        const form = new FormData();
        form.append('face', fs.createReadStream(req.file.path));
        form.append('stored_embedding', JSON.stringify(user.faceEmbeddings));
        
        const pyResponse = await axios.post(`${PYTHON_SERVICE_URL}/compare-faces`, form, {
            headers: form.getHeaders(),
            timeout: AXIOS_TIMEOUT
        });

        if (!pyResponse.data.is_match) {
            return res.status(401).json({ message: 'Face verification failed for check-out.' });
        }

        // --- Find today's record to update ---
        const todayStart = moment().startOf('day');
        const todayEnd = moment().endOf('day');
        const attendanceRecord = await Attendance.findOne({ userId, checkInTime: { $gte: todayStart.toDate(), $lte: todayEnd.toDate() } });

        if (!attendanceRecord) {
            return res.status(404).json({ message: 'No check-in record found for today.' });
        }
        if (attendanceRecord.checkOutTime) {
            return res.status(400).json({ message: 'You have already checked out today.' });
        }

        attendanceRecord.checkOutTime = new Date();
        await attendanceRecord.save();
        
        const updatedRecord = await Attendance.findById(attendanceRecord._id).populate('userId', 'fullName employeeId');
        res.status(200).json({ message: 'Checked out successfully!', attendance: updatedRecord });

    } catch (error) {
        console.error('Check-out Controller Error:', error.response?.data || error.message);
        next(error);
    } finally {
        cleanupFile(req.file);
    }
};

// ================== GET ALL ATTENDANCE ==================
exports.getAllAttendance = async (req, res) => {
  try {
    const records = await Attendance.find()
      .sort({ checkInTime: -1 })
      .populate('userId', 'fullName username employeeId');
    res.json(records);
  } catch (err) {
    console.error("❌ Get All Attendance Error:", err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

// ================== DELETE ATTENDANCE ==================
exports.deleteAttendance = async (req, res) => {
  try {
    const deletedRecord = await Attendance.findByIdAndDelete(req.params.id);
    if (!deletedRecord) {
      return res.status(404).json({ message: 'Attendance record not found.' });
    }
    res.json({ message: 'Attendance record deleted successfully.' });
  } catch (err) {
    console.error("❌ Delete Attendance Error:", err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

// ================== GET TODAY'S ATTENDANCE FOR USER ==================
exports.getTodaysAttendanceForUser = async (req, res) => {
  try {
    const userIdFromToken = req.user.userId;
    const todayStart = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();

    const attendanceRecord = await Attendance.findOne({
      userId: userIdFromToken,
      checkInTime: { $gte: todayStart, $lte: todayEnd }
    }).populate('userId', 'fullName username employeeId');

    if (!attendanceRecord) {
        return res.status(200).json(null); // Return null explicitly if no record found
    }
    res.json(attendanceRecord);
  } catch (err) {
    console.error("❌ Today's Attendance Error:", err);
    res.status(500).json({ error: 'Server error while fetching today\'s attendance.' });
  }
};
