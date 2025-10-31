import mongoose from 'mongoose';

const journalistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  bio: {
    type: String,
    maxlength: [1000, 'Bio cannot exceed 1000 characters']
  },
  profilePhoto: {
    url: String,
    filename: String
  },
  areasOfCoverage: [
    {
      type: String,
      enum: ['new orleans', 'biloxi', 'mobile', 'pensacola', 'regional', 'national']
    }
  ],
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp before saving
journalistSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Journalist = mongoose.model('Journalist', journalistSchema);
export default Journalist;
