import mongoose from 'mongoose';

const journalistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fullName: {
    type: String,
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  bio: {
    type: String,
    maxlength: [2000, 'Bio cannot exceed 2000 characters']
  },
  profilePhoto: {
    url: String,
    filename: String,
    publicId: String
  },

  city: {
    type: String,
    trim: true,
    lowercase: true,
  },
  
  state: {
    type: String,
    enum: ['Louisiana', 'Mississippi', 'Alabama', 'Florida', ''],
    default: '',
  },
  
  areasOfCoverage: [
    {
      type: String,
      enum: [
        // Louisiana cities
        'new orleans', 'baton rouge', 'lafayette', 
        'shreveport', 'lake charles', 'monroe',
        // Mississippi cities
        'jackson', 'biloxi', 'gulfport', 'oxford', 'hattiesburg',
        // Alabama cities
        'birmingham', 'mobile', 'huntsville', 'tuscaloosa',
        // Florida cities
        'tampa', 'st. petersburg', 'clearwater', 
        'pensacola', 'panama city', 'fort myers'
      ]
    }
  ],
  
  subscriptionPlan: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free',
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  isActive: {
    type: Boolean,
    default: true // All journalists active by default
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

journalistSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  
  // Auto-calculate state from city
  if (this.city && !this.state) {
    const cityLower = this.city.toLowerCase();
    
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

// Indexes for faster querying
journalistSchema.index({ state: 1, city: 1 });
journalistSchema.index({ isActive: 1 });
journalistSchema.index({ subscriptionPlan: 1 });
journalistSchema.index({ isVerified: 1 });

const Journalist = mongoose.model('Journalist', journalistSchema);
export default Journalist;