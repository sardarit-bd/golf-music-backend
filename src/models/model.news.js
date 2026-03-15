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
    trim: true,
    lowercase: true,
    enum: {
      values: [
        // Louisiana
        'new orleans', 'baton rouge', 'lafayette', 'shreveport', 'lake charles', 'monroe',
        // Mississippi
        'jackson', 'biloxi', 'gulfport', 'oxford', 'hattiesburg',
        // Alabama
        'birmingham', 'mobile', 'huntsville', 'tuscaloosa',
        // Florida
        'tampa', 'st. petersburg', 'clearwater', 'pensacola', 'panama city', 'fort myers'
      ],
      message: 'Please select a valid Gulf Coast city'
    }
  },

  state: {
    type: String,
    enum: ['Louisiana', 'Mississippi', 'Alabama', 'Florida', ''],
    default: ''
  },

  credit: {
  type: String,
  trim: true,
  maxlength: [200, 'Credit cannot exceed 200 characters'],
  default: ""
},

  photos: [
    {
      url: String,
      filename: String,
      publicId: String
    }
  ],

  journalist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  views: {
    type: Number,
    default: 0
  },
  viewLogs: [
    {
      ip: String,
      viewedAt: Date
    }
  ],
  isFeatured: {
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

newsSchema.pre('save', function (next) {
  this.updatedAt = Date.now();

  // Auto-calculate state from location if not set
  if (this.location && !this.state) {
    const cityLower = this.location.toLowerCase();

    const stateMap = {
      // Louisiana cities
      'new orleans': 'Louisiana',
      'baton rouge': 'Louisiana',
      'lafayette': 'Louisiana',
      'shreveport': 'Louisiana',
      'lake charles': 'Louisiana',
      'monroe': 'Louisiana',

      // Mississippi cities
      'jackson': 'Mississippi',
      'biloxi': 'Mississippi',
      'gulfport': 'Mississippi',
      'oxford': 'Mississippi',
      'hattiesburg': 'Mississippi',

      // Alabama cities
      'birmingham': 'Alabama',
      'mobile': 'Alabama',
      'huntsville': 'Alabama',
      'tuscaloosa': 'Alabama',

      // Florida cities
      'tampa': 'Florida',
      'st. petersburg': 'Florida',
      'clearwater': 'Florida',
      'pensacola': 'Florida',
      'panama city': 'Florida',
      'fort myers': 'Florida',
    };

    if (stateMap[cityLower]) {
      this.state = stateMap[cityLower];
    }
  }

  next();
});

// Indexes for better query performance
newsSchema.index({ location: 1, isActive: 1, createdAt: -1 });
newsSchema.index({ state: 1, isActive: 1 });
newsSchema.index({ journalist: 1, isActive: 1 });
newsSchema.index({ isFeatured: 1, createdAt: -1 });
newsSchema.index({ views: -1 });

const News = mongoose.model('News', newsSchema);
export default News;