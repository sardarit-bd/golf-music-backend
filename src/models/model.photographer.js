import mongoose from "mongoose";
// import { STATE_CITY_MAPPING } from './../utils/constants.js';

const STATE_CITY_MAPPING = {
  louisiana: ["new orleans"],
  mississippi: ["biloxi"],
  alabama: ["mobile"],
  florida: ["pensacola"]
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

  // PDF REQUIREMENT: STATE-BASED CATEGORIZATION
  state: {
    type: String,
    enum: {
      values: ["louisiana", "mississippi", "alabama", "florida"],
      message: "State must be one of: Louisiana, Mississippi, Alabama, Florida"
    },
    required: [true, "State is required"],
    lowercase: true,
    trim: true
  },

  // CITY - Based on PDF requirement (only 4 specific cities)
  city: {
    type: String,
    required: [true, "City is required"],
    lowercase: true,
    trim: true
  },

  biography: {
    type: String,
    maxlength: [2000, "Biography cannot exceed 2000 characters"],
    default: "",
  },

  // SERVICES (All users - PDF requirement)
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

      duration: {
        type: String,
        enum: [
          "30min",
          "1hour",
          "2hours",
          "3hours",
          "4hours",
          "6hours",
          "8hours",
          "fullday",
          "custom",
          "",
        ],
        default: "",
      },

      category: {
        type: String,
        enum: [
          "photography",
          "videography",
          "editing",
          "consultation",
          "workshop",
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



  // PHOTOS (5 photos for all users - PDF requirement)
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

  // VIDEOS (1 video for all users - PDF requirement)
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
    default: 5, // PDF: All users get 5 photos
  },

  videosLimit: {
    type: Number,
    default: 1, // PDF: All users get 1 video
  },

  featuresLocked: {
    type: Boolean,
    default: false, // PDF: All features unlocked for free users
  },

  // PDF REQUIREMENT: Location-based categorization
  locationTags: [{
    type: String,
    enum: ["louisiana", "mississippi", "alabama", "florida"]
  }],

  isActive: {
    type: Boolean,
    default: true, // Auto-active per PDF
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

// Pre-save middleware for validation and auto-population
photographerSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Validate state-city combination based on PDF requirement
  if (this.isModified('city') || this.isModified('state')) {
    if (!this.state) {
      return next(new Error("State is required"));
    }

    if (!this.city) {
      return next(new Error("City is required"));
    }

    // Get valid cities for this state
    const validCities = STATE_CITY_MAPPING[this.state.toLowerCase()];

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

  // Auto-populate locationTags based on state
  if (this.state) {
    this.locationTags = [this.state.toLowerCase()];
  }

  // Enforce photo limit (PDF: 5 photos max)
  if (this.photos && this.photos.length > this.photosLimit) {
    return next(new Error(`Maximum ${this.photosLimit} photos allowed`));
  }

  // Enforce video limit (PDF: 1 video max)
  if (this.videos && this.videos.length > this.videosLimit) {
    return next(new Error(`Maximum ${this.videosLimit} video allowed`));
  }

  next();
});

// Indexes for performance
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

  const formatState = this.state.charAt(0).toUpperCase() + this.state.slice(1);

  return `${formatCity}, ${formatState}`;
});

// Ensure virtuals are included in JSON
photographerSchema.set('toJSON', { virtuals: true });
photographerSchema.set('toObject', { virtuals: true });

const Photographer = mongoose.model("Photographer", photographerSchema);
export default Photographer;