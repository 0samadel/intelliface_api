// ────────────────────────────────────────────────────────────────────────────────
// File    : controllers/attendanceController.js
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
  // ... (all the console logs and initial checks are good)
  
  try {
    // ... (user finding logic is good)
    
    // --- Face Verification ---
    const form = new FormData();
    form.append('face', fs.createReadStream(req.file.path));
    form.append('stored_embedding', JSON.stringify(user.faceEmbeddings));

    // The ONLY change is here: remove the headers property
    const pyResponse = await axios.post(`${PYTHON_SERVICE_URL}/compare-faces`, form, {
        timeout: AXIOS_TIMEOUT
    });
    
    if (!pyResponse.data.is_match) {
        return res.status(401).json({ message: 'Face verification failed. Please try again.' });
    }
    
    // ... (rest of the logic is good)

  } catch (error) {
    // ...
  } finally {
    // ...
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
