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
