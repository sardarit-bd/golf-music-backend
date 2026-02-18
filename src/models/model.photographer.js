import mongoose from "mongoose";

const STATE_CITY_MAPPING = {
  LA: ["mobile"],
  MS: ["biloxi"],
  AL: ["mobile"],
  FL: ["pensacola"]
};

const photographerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },

  // BASIC INFO
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    minlength: [2, "Name must be at least 2 characters"]
  },

  // STATE - Now using acronyms (LA, MS, AL, FL)
  state: {
    type: String,
    enum: {
      values: ["LA", "MS", "AL", "FL"],
      message: "State must be one of: LA, MS, AL, FL"
    },
    required: [true, "State is required"],
    trim: true,
    uppercase: true
  },

  // CITY - Mobile only for AL, otherwise based on mapping
  city: {
    type: String,
    required: [true, "City is required"],
    lowercase: true,
    trim: true,
    // City becomes immutable after creation
    immutable: function() {
      return !this.isNew;
    }
  },

  biography: {
    type: String,
    maxlength: [2000, "Biography cannot exceed 2000 characters"],
    default: "",
  },

  // SERVICES - Removed duration field
  services: [
    {
      service: {
        type: String,
        required: true,
        trim: true,
      },

      price: {
        type: String,
        required: true,
        trim: true,
      },

      description: {
        type: String,
        trim: true,
        default: "",
        maxlength: 1000,
      },

      // duration field removed as requested

      category: {
        type: String,
        enum: [
          "photography",
          "videography",
          "editing",
          "consultation",
          "workshop",
          "equipment",
          "other",
        ],
        default: "photography",
      },

      contact: {
        email: {
          type: String,
          lowercase: true,
          trim: true,
          match: [/^\S+@\S+\.\S+$/, "Invalid email"],
        },

        phone: {
          type: String,
          trim: true,
          maxlength: 20,
        },

        preferredContact: {
          type: String,
          enum: ["email", "phone"],
          default: "email",
        },

        showPhonePublicly: {
          type: Boolean,
          default: false,
        },
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  // PHOTOS
  photos: [
    {
      url: {
        type: String,
        required: true
      },
      caption: {
        type: String,
        default: ""
      },
      public_id: {
        type: String,
        required: true
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    },
  ],

  // VIDEOS
  videos: [
    {
      url: {
        type: String,
        required: true,
      },

      title: {
        type: String,
        default: "Untitled Video",
      },

      description: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: "",
      },

      public_id: {
        type: String,
        required: true,
      },

      duration: Number,
      format: String,
      bytes: Number,

      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  // SUBSCRIPTION-RELATED
  photosLimit: {
    type: Number,
    default: 5,
  },

  videosLimit: {
    type: Number,
    default: 1,
  },

  featuresLocked: {
    type: Boolean,
    default: false,
  },

  // Location-based categorization
  locationTags: [{
    type: String,
    enum: ["LA", "MS", "AL", "FL"]
  }],

  isActive: {
    type: Boolean,
    default: true,
  },

  isVerified: {
    type: Boolean,
    default: false,
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

// Pre-save middleware
photographerSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Validate state-city combination
  if (this.isNew || this.isModified('city') || this.isModified('state')) {
    if (!this.state) {
      return next(new Error("State is required"));
    }

    if (!this.city) {
      return next(new Error("City is required"));
    }

    // Get valid cities for this state
    const validCities = STATE_CITY_MAPPING[this.state];

    if (!validCities) {
      return next(new Error(`Invalid state: ${this.state}`));
    }

    if (!validCities.includes(this.city.toLowerCase())) {
      return next(new Error(
        `City "${this.city}" is not valid for state "${this.state}". ` +
        `Valid city for ${this.state}: ${validCities.join(", ")}`
      ));
    }
  }

  // For existing documents, prevent city modification
  if (!this.isNew && this.isModified('city')) {
    return next(new Error("City cannot be modified after profile creation"));
  }

  // Auto-populate locationTags based on state
  if (this.state) {
    this.locationTags = [this.state];
  }

  // Enforce limits
  if (this.photos && this.photos.length > this.photosLimit) {
    return next(new Error(`Maximum ${this.photosLimit} photos allowed`));
  }

  if (this.videos && this.videos.length > this.videosLimit) {
    return next(new Error(`Maximum ${this.videosLimit} video allowed`));
  }

  next();
});

// Indexes
photographerSchema.index({ state: 1, isActive: 1 });
photographerSchema.index({ state: 1, city: 1 });
photographerSchema.index({ user: 1 }, { unique: true });
photographerSchema.index({ locationTags: 1 });

// Virtual for formatted location
photographerSchema.virtual('formattedLocation').get(function () {
  if (!this.city || !this.state) return "Location not set";

  const formatCity = this.city
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const stateFullNames = {
    'LA': 'Louisiana',
    'MS': 'Mississippi',
    'AL': 'Alabama',
    'FL': 'Florida'
  };

  return `${formatCity}, ${stateFullNames[this.state] || this.state}`;
});

photographerSchema.set('toJSON', { virtuals: true });
photographerSchema.set('toObject', { virtuals: true });

const Photographer = mongoose.model("Photographer", photographerSchema);
export default Photographer;