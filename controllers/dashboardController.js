// --- START OF FILE controllers/dashboardController.js ---
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const moment = require('moment'); // For easier date manipulation

// @desc    Get dashboard statistics (summary cards, attendance trends)
// @route   GET /api/dashboard/stats
// @access  Admin
exports.getDashboardStats = async (req, res) => {
  try {
    // --- 1. Summary Card Data ---
    const totalEmployees = await User.countDocuments({ role: 'employee' }); // Count only employees

    const todayStart = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();

    const todaysAttendanceRecords = await Attendance.find({
      checkInTime: { $gte: todayStart, $lte: todayEnd },
      // status: { $in: ['Present', 'Late'] } // Consider if you only want 'Present' or 'Late' for this count
    });

    const uniqueUsersPresentToday = new Set();
    todaysAttendanceRecords.forEach(record => {
        if (record.status === 'Present' || record.status === 'Late') {
            uniqueUsersPresentToday.add(record.userId.toString());
        }
    });
    const totalPresentToday = uniqueUsersPresentToday.size;
    const totalAbsentToday = Math.max(0, totalEmployees - totalPresentToday); // Ensure non-negative

    // --- 2. Attendance Trends Data (e.g., last 7 days) ---
    // Client can pass a 'trendDays' query parameter, defaulting to 7
    const trendDays = parseInt(req.query.trendDays) || 7;
    const trendData = [];
    const dailyPresentCounts = {};

    // Initialize counts for the last 'trendDays'
    for (let i = 0; i < trendDays; i++) {
      const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
      dailyPresentCounts[date] = 0;
    }

    // Fetch attendance records for the trend period
    const trendPeriodStart = moment().subtract(trendDays - 1, 'days').startOf('day').toDate();
    const trendPeriodEnd = moment().endOf('day').toDate(); // Include today fully

    const attendanceForTrend = await Attendance.find({
      checkInTime: { $gte: trendPeriodStart, $lte: trendPeriodEnd },
      status: { $in: ['Present', 'Late'] }
    }).populate('userId', 'employeeId'); // Populate if you need user details per record for trends

    // Aggregate daily present counts
    attendanceForTrend.forEach(record => {
      const recordDateStr = moment(record.checkInTime).format('YYYY-MM-DD');
      if (dailyPresentCounts.hasOwnProperty(recordDateStr)) {
        // To count unique users present per day for the trend:
        // This is more complex. A simpler approach (counting check-ins) is used below.
        // For unique users, you'd group by date and then count unique userIds within each group.
        // For simplicity now, we'll count present/late check-ins.
         dailyPresentCounts[recordDateStr]++;
      }
    });
    
    // Prepare trendData array (oldest to newest for chart)
    for (let i = trendDays - 1; i >= 0; i--) {
      const date = moment().subtract(i, 'days');
      const dateStr = date.format('YYYY-MM-DD');
      trendData.push({
        date: dateStr,
        // dayLabel: date.format('MMM DD'), // For chart labels
        presentCount: dailyPresentCounts[dateStr] || 0,
      });
    }

    // --- 3. Today's Attendance Snapshot (Optional, could be separate or fetched by client) ---
    // For simplicity, we'll keep this on the client from the full attendance list for now,
    // but you could include a small snapshot here too.

    res.json({
      summary: {
        totalEmployees,
        totalPresentToday,
        totalAbsentToday,
        // faceScanSuccessRate: "N/A", // Placeholder, requires different data source
      },
      attendanceTrend: trendData,
    });

  } catch (err) {
    console.error('Error in getDashboardStats:', err);
    res.status(500).json({ error: 'Server error while fetching dashboard stats: ' + err.message });
  }
};
// --- END OF FILE controllers/dashboardController.js ---