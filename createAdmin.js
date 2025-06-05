const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const existingAdmin = await User.findOne({ username: 'admin' });
    if (existingAdmin) {
      console.log('Admin already exists');
      return process.exit();
    }

    const hashedPassword = await bcrypt.hash('admin1234', 10);

    const admin = new User({
      fullName: 'Super Admin',
      email: 'admin@intelliface.com',
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      department: 'Management',
    });

    await admin.save();
    console.log('✅ Admin created: username=osama, password=admin123');
    process.exit();
  } catch (err) {
    console.error('❌ Error creating admin:', err.message);
    process.exit(1);
  }
};

createAdmin();
