import mongoose from 'mongoose';
import { MONGODB_URI } from './environment.js';

const connectDB = async () => {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is missing in environment variables');
    process.exit(1);
  }

  try {
    // MongoDB connection 
    const conn = await mongoose.connect(MONGODB_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:');
    console.error(error.message);
    process.exit(1);
  }

  // Handle connection events 
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('🚨 MongoDB connection error:', err);
  });
};

export default connectDB;
