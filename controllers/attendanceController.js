// ────────────────────────────────────────────────────────────────────────────────
// File    : controllers/attendanceController.js
// Purpose : Handles employee check-in/out with face/location verification and attendance management
// Access  : Employee (token), Admin (verifyAdmin middleware)
// ────────────────────────────────────────────────────────────────────────────────

/* ============================================================================
 * 1. Imports & Constants
 * ========================================================================== */
const Attendance = require('../models/Attendance');
const Location = require('../models/Location');
const axios = require('axios'); // For Python face verification service

const PYTHON_SERVICE_URL = 'http://localhost:5001'; // Python microservice endpoint

/* ============================================================================
 * 2. Utility: Haversine Formula to Calculate Distance (in meters)
 * ========================================================================== */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ============================================================================
 * 3. CHECK-IN (Face + Location Verification)
 * ========================================================================== */
exports.checkIn = async (req, res) => {
  console.log("CHECK-IN ATTEMPT - User:", req.user);
  console.log("CHECK-IN ATTEMPT - Request Body:", req.body);

  try {
    const userIdFromToken = req.user.userId;
    const { latitude, longitude, snapshotImage } = req.body;

    if (!latitude || !longitude || !snapshotImage) {
      return res.status(400).json({ message: 'Latitude, longitude, and snapshotImage are required for check-in.' });
    }

    // ── Face Verification ───────────────────────────────────────
    try {
      const faceResponse = await axios.post(`${PYTHON_SERVICE_URL}/verify_face`, {
        employee_id: userIdFromToken,
        image_base64_to_check: snapshotImage,
      });

      if (!faceResponse.data.match) {
        return res.status(400).json({ message: faceResponse.data.reason || 'Face verification failed.' });
      }

      console.log(`✅ Face verified for user ${userIdFromToken}. Distance: ${faceResponse.data.distance}`);
    } catch (faceError) {
      console.error('❌ Face verification error:', faceError.response?.data || faceError.message);
      return res.status(500).json({ message: 'Face verification failed. Please try again.' });
    }

    // ── Location Validation ─────────────────────────────────────
    const allowedLocations = await Location.find();
    if (!allowedLocations || allowedLocations.length === 0) {
      return res.status(500).json({ message: 'No allowed locations defined in the system.' });
    }

    const matchedLocation = allowedLocations.find(loc => {
      if (loc.latitude != null && loc.longitude != null) {
        const distance = getDistanceInMeters(latitude, longitude, loc.latitude, loc.longitude);
        return distance <= loc.radius;
      }
      return false;
    });

    if (!matchedLocation) {
      return res.status(403).json({ message: 'Check-in denied: You are outside of any allowed work location radius.' });
    }

    // ── Prevent Duplicate Check-In ──────────────────────────────
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const alreadyCheckedIn = await Attendance.findOne({
      userId: userIdFromToken,
      checkInTime: { $gte: todayStart, $lt: todayEnd },
    });

    if (alreadyCheckedIn) {
      return res.status(400).json({ message: 'You have already checked in today.' });
    }

    // ── Save Attendance ─────────────────────────────────────────
    const attendance = new Attendance({
      userId: userIdFromToken,
      location: { latitude, longitude },
      snapshotImage,
      status: 'Present',
    });

    await attendance.save();
    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('userId', 'fullName username employeeId');

    res.status(201).json({ message: 'Check-in successful!', attendance: populatedAttendance });

  } catch (err) {
    console.error("❌ Check-In Error:", err);
    res.status(500).json({ error: 'Server error during check-in: ' + err.message });
  }
};

/* ============================================================================
 * 4. CHECK-OUT (Optional Face Verification)
 * ========================================================================== */
exports.checkOut = async (req, res) => {
  console.log("CHECK-OUT ATTEMPT - User:", req.user);

  try {
    const userIdFromToken = req.user.userId;
    const { snapshotImage } = req.body;

    // ── Optional Face Verification ──────────────────────────────
    if (snapshotImage) {
      try {
        const faceResponse = await axios.post(`${PYTHON_SERVICE_URL}/verify_face`, {
          employee_id: userIdFromToken,
          image_base64_to_check: snapshotImage,
        });

        if (!faceResponse.data.match) {
          return res.status(400).json({ message: faceResponse.data.reason || 'Face verification failed.' });
        }

        console.log(`✅ Face verified for check-out user ${userIdFromToken}. Distance: ${faceResponse.data.distance}`);
      } catch (faceError) {
        console.error('❌ Face verification error:', faceError.response?.data || faceError.message);
        return res.status(500).json({ message: 'Face verification failed. Please try again.' });
      }
    }

    // ── Find Today’s Attendance ─────────────────────────────────
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const attendanceRecord = await Attendance.findOne({
      userId: userIdFromToken,
      checkInTime: { $gte: todayStart, $lte: todayEnd },
    });

    if (!attendanceRecord) {
      return res.status(404).json({ message: 'No check-in record found for you today. Cannot check out.' });
    }

    if (attendanceRecord.checkOutTime) {
      return res.status(400).json({ message: 'You have already checked out today.' });
    }

    // ── Save Check-Out ──────────────────────────────────────────
    attendanceRecord.checkOutTime = new Date();
    if (snapshotImage) attendanceRecord.snapshotImage = snapshotImage;
    await attendanceRecord.save();

    const populatedAttendance = await Attendance.findById(attendanceRecord._id)
      .populate('userId', 'fullName username employeeId');

    res.status(200).json({ message: 'Check-out successful!', attendance: populatedAttendance });

  } catch (err) {
    console.error("❌ Check-Out Error:", err);
    res.status(500).json({ error: 'Server error during check-out: ' + err.message });
  }
};

/* ============================================================================
 * 5. GET ALL ATTENDANCE (Admin Only)
 * ========================================================================== */
exports.getAllAttendance = async (req, res) => {
  try {
    const records = await Attendance.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'fullName username employeeId');

    res.json(records);
  } catch (err) {
    console.error("❌ Get All Attendance Error:", err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

/* ============================================================================
 * 6. DELETE ATTENDANCE (Admin Only)
 * ========================================================================== */
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

/* ============================================================================
 * 7. GET TODAY’S ATTENDANCE FOR CURRENT USER
 * ========================================================================== */
exports.getTodaysAttendanceForUser = async (req, res) => {
  console.log("GET TODAY'S ATTENDANCE - User:", req.user);

  try {
    const userIdFromToken = req.user.userId;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const attendanceRecord = await Attendance.findOne({
      userId: userIdFromToken,
      checkInTime: { $gte: todayStart, $lte: todayEnd }
    }).populate('userId', 'fullName username employeeId');

    // Even if no record, return 200 for UI to handle null
    if (!attendanceRecord) return res.status(200).json(null);
    res.json(attendanceRecord);
  } catch (err) {
    console.error("❌ Today's Attendance Error:", err);
    res.status(500).json({ error: 'Server error while fetching today\'s attendance.' });
  }
};
/* ───────────────────────────────────────────────────────────────────────────── */
