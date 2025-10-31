import mongoose from 'mongoose';
import { MONGODB_URI } from '../config/environment.js';
import User from '../models/model.user.js';

const createAdminUser = async () => {
  try {
    await mongoose.connect(MONGODB_URI);

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@gulfcoastmusic.com' });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin user
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@gulfcoastmusic.com',
      password: 'admin123',
      userType: 'admin',
      isVerified: true
    });

    console.log(' Admin user created successfully:', {
      id: adminUser._id,
      username: adminUser.username,
      email: adminUser.email
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();
