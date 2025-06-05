// --- controllers/attendanceController.js ---
const Attendance = require('../models/Attendance');
const Location = require('../models/Location');
const axios = require('axios'); // Add axios for Python service calls

const PYTHON_SERVICE_URL = 'http://localhost:5001'; // Python service URL

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

exports.checkIn = async (req, res) => {
  console.log("CHECK-IN ATTEMPT - User from token:", req.user);
  console.log("CHECK-IN ATTEMPT - Request Body:", req.body);
  try {
    const userIdFromToken = req.user.userId;
    const { latitude, longitude, snapshotImage } = req.body;

    if (!latitude || !longitude || !snapshotImage) {
      return res.status(400).json({ message: 'Latitude, longitude, and snapshotImage are required for check-in.' });
    }

    // Verify face with Python service
    try {
      const faceResponse = await axios.post(`${PYTHON_SERVICE_URL}/verify_face`, {
        employee_id: userIdFromToken,
        image_base64_to_check: snapshotImage,
      });
      if (!faceResponse.data.match) {
        return res.status(400).json({ message: faceResponse.data.reason || 'Face verification failed.' });
      }
      console.log(`Face verified for user ${userIdFromToken}. Distance: ${faceResponse.data.distance}`);
    } catch (faceError) {
      console.error('Face verification error:', faceError.response?.data || faceError.message);
      return res.status(500).json({ message: 'Face verification failed. Please try again.' });
    }

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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const alreadyCheckedIn = await Attendance.findOne({
      userId: userIdFromToken,
      checkInTime: { $gte: todayStart, $lt: todayEnd },
    });

    if (alreadyCheckedIn) {
      return res.status(400).json({ message: 'You have already checked in today.' });
    }

    const attendance = new Attendance({
      userId: userIdFromToken,
      location: { latitude, longitude },
      snapshotImage,
      status: 'Present',
    });

    await attendance.save();
    const populatedAttendance = await Attendance.findById(attendance._id).populate('userId', 'fullName username employeeId');

    res.status(201).json({ message: 'Check-in successful!', attendance: populatedAttendance });
  } catch (err) {
    console.error("Check-In Error:", err);
    res.status(500).json({ error: 'Server error during check-in: ' + err.message });
  }
};

exports.checkOut = async (req, res) => {
  console.log("CHECK-OUT ATTEMPT - User from token:", req.user);
  try {
    const userIdFromToken = req.user.userId;
    const { snapshotImage } = req.body; // Add snapshotImage for check-out

    // Optional: Verify face for check-out
    if (snapshotImage) {
      try {
        const faceResponse = await axios.post(`${PYTHON_SERVICE_URL}/verify_face`, {
          employee_id: userIdFromToken,
          image_base64_to_check: snapshotImage,
        });
        if (!faceResponse.data.match) {
          return res.status(400).json({ message: faceResponse.data.reason || 'Face verification failed.' });
        }
        console.log(`Face verified for check-out user ${userIdFromToken}. Distance: ${faceResponse.data.distance}`);
      } catch (faceError) {
        console.error('Face verification error:', faceError.response?.data || faceError.message);
        return res.status(500).json({ message: 'Face verification failed. Please try again.' });
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

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

    attendanceRecord.checkOutTime = new Date();
    if (snapshotImage) attendanceRecord.snapshotImage = snapshotImage; // Store check-out image
    await attendanceRecord.save();
    const populatedAttendance = await Attendance.findById(attendanceRecord._id).populate('userId', 'fullName username employeeId');

    res.status(200).json({ message: 'Check-out successful!', attendance: populatedAttendance });
  } catch (err) {
    console.error("Check-Out Error:", err);
    res.status(500).json({ error: 'Server error during check-out: ' + err.message });
  }
};

// Other functions (getAllAttendance, deleteAttendance, getTodaysAttendanceForUser) remain unchanged

// 📌 GET ALL ATTENDANCE (Admin Only - keep as is, assuming it's protected by verifyAdmin)
exports.getAllAttendance = async (req, res) => {
  try {
    const records = await Attendance.find().sort({createdAt: -1}).populate('userId', 'fullName username employeeId');
    res.json(records);
  } catch (err) {
    console.error("Get All Attendance Error:", err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

// 📌 DELETE ATTENDANCE (Admin Only - keep as is, assuming it's protected by verifyAdmin)
exports.deleteAttendance = async (req, res) => {
  try {
    const deletedRecord = await Attendance.findByIdAndDelete(req.params.id);
    if (!deletedRecord) {
        return res.status(404).json({ message: 'Attendance record not found.' });
    }
    res.json({ message: 'Attendance record deleted successfully.' });
  } catch (err) {
    console.error("Delete Attendance Error:", err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

// 📌 GET TODAY'S ATTENDANCE FOR CURRENTLY AUTHENTICATED USER (New Function)
exports.getTodaysAttendanceForUser = async (req, res) => {
  console.log("GET TODAY'S ATTENDANCE FOR USER - User from token:", req.user);
  try {
    const userIdFromToken = req.user.userId; // Get from auth middleware

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const attendanceRecord = await Attendance.findOne({
        userId: userIdFromToken,
        checkInTime: { $gte: todayStart, $lte: todayEnd } // Use $lte for end of day
    }).populate('userId', 'fullName username employeeId'); // Populate if needed by client

    if (!attendanceRecord) {
        // It's normal for a user not to have a record if they haven't checked in.
        // Return 200 with null or an empty object based on client expectation.
        return res.status(200).json(null); 
    }
    res.json(attendanceRecord);
  } catch (err) {
    console.error("Error fetching today's attendance for user:", err);
    res.status(500).json({ error: 'Server error while fetching today\'s attendance.' });
  }
};