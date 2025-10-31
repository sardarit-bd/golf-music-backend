import mongoose from 'mongoose';

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    enum: {
      values: ['new orleans', 'biloxi', 'mobile', 'pensacola'],
      message: 'Location must be New Orleans, Biloxi, Mobile, or Pensacola'
    }
  },
  credit: {
    type: String,
    required: [true, 'Credit is required'],
    trim: true
  },
  photos: [
    {
      url: String,
      filename: String
    }
  ],
  journalist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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


newsSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const News = mongoose.model('News', newsSchema);
export default News;
