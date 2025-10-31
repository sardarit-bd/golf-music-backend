import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  artistBandName: {
    type: String,
    required: [true, 'Artist/Band name is required'],
    trim: true,
    maxlength: [100, 'Artist/Band name cannot exceed 100 characters'],
  },
  time: {
    type: String,
    required: [true, 'Time is required'],
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    validate: {
      validator: function (value) {
        return value >= new Date().setHours(0, 0, 0, 0);
      },
      message: 'Event date cannot be in the past',
    },
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true,
  },
  city: {
    type: String,
    required: true,
    enum: {
      values: ['new orleans', 'biloxi', 'mobile', 'pensacola'],
      message: 'City must be New Orleans, Biloxi, Mobile, or Pensacola',
    },
    set: (v) => v.toLowerCase().trim(),
  },
  color: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp before saving
eventSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual field for formatted date
eventSchema.virtual('formattedDate').get(function () {
  return this.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

// Ensure virtual fields show in JSON output
eventSchema.set('toJSON', { virtuals: true });

const Event = mongoose.model('Event', eventSchema);
export default Event;
