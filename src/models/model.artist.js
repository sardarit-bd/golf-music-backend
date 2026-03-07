import mongoose from "mongoose";

const artistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // BASIC FIELDS
  name: {
    type: String,
    required: [true, "Artist name is required"],
    trim: true,
    maxlength: [100, "Name cannot exceed 100 characters"],
  },

  // LOCATION FIELDS
  city: {
    type: String,
    required: [true, "City is required"],
    trim: true,
    lowercase: true, // Keep consistent for filtering
  },

  state: {
    type: String,
    enum: ['Louisiana', 'Mississippi', 'Alabama', 'Florida', ''], // From client requirement
    default: '',
    trim: true,
  },

  genre: {
    type: String,
    required: [true, "Genre is required"],
    enum: [
      "pop",
      "rock",
      "rap",
      "country",
      "jazz",
      "reggae",
      "edm",
      "classical",
      "rnb_soul",
      "metal",
      "other",
    ],
  },


  // PROFILE CONTENT
  biography: {
    type: String,
    maxlength: [2000, "Biography cannot exceed 2000 characters"],
  },

  photos: [
    {
      url: String,
      filename: String,
      publicId: String,
    },
  ],

  mp3Files: [
    {
      url: String,
      filename: String,
      originalName: String,
      publicId: String,
    },
  ],

  // MARKETPLACE RELATED
  marketItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "MarketItem",
  }],

  // LOCATION CATEGORIZATION (Always enabled for all)
  locationCategorized: {
    type: Boolean,
    default: true,
  },

  // SUBSCRIPTION RELATED
  subscriptionPlan: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free',
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  isActive: {
    type: Boolean,
    default: true, // Changed to true by default
  },

  // METADATA
  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to auto-calculate state from city before saving
artistSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Auto-determine state based on city if not set
  if (this.city && !this.state) {
    const cityLower = this.city.toLowerCase();

    // Map cities to states based on client requirement
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
artistSchema.index({ state: 1, city: 1 });
artistSchema.index({ genre: 1 });
artistSchema.index({ isActive: 1 });
artistSchema.index({ subscriptionPlan: 1 });

// Virtual for getting current photo count
artistSchema.virtual('photoCount').get(function () {
  return this.photos ? this.photos.length : 0;
});

// Virtual for getting current audio count
artistSchema.virtual('audioCount').get(function () {
  return this.mp3Files ? this.mp3Files.length : 0;
});

// Method to check if can add more photos
artistSchema.methods.canAddPhoto = function () {
  // All users can upload up to 5 photos (client requirement)
  return this.photoCount < 5;
};

// Method to check if can add more audio
artistSchema.methods.canAddAudio = function () {
  // All users can upload up to 1 audio file (client requirement)
  return this.audioCount < 1;
};

// Method to get location for categorization
artistSchema.methods.getLocationForCategorization = function () {
  if (this.state && this.city) {
    return `${this.state}/${this.city}`;
  }
  return null;
};

const Artist = mongoose.model("Artist", artistSchema);
export default Artist;