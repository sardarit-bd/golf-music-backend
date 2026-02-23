import mongoose from "mongoose";
import { STATE_CITY_MAPPING } from "../utils/constants.js";

const showSchema = new mongoose.Schema({
  artist: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
});

const venueSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // BASIC FIELDS
  venueName: {
    type: String,
    required: [true, "Venue name is required"],
    trim: true,
    maxlength: [100, "Venue name cannot exceed 100 characters"],
  },

  // NEW: STATE FIELD
  state: {
    type: String,
    required: [true, "State is required"],
    enum: ["Louisiana", "Mississippi", "Alabama", "Florida"],
    default: "Alabama"
  },

  // UPDATED: City validation will be dynamic
  city: {
    type: String,
    required: [true, "City is required"],
    set: (v) => v.toLowerCase().trim(),
  },

  address: {
    type: String,
    trim: true,
  },

  seatingCapacity: {
    type: Number,
    min: [0, "Seating capacity must be at least 1"],
    default: 0,
  },

  biography: {
    type: String,
    maxlength: 2000,
  },

  openHours: { type: String },
  openDays: { type: String },

  photos: [
    {
      url: String,
      filename: String,
    },
  ],

  featuresLocked: {
    type: Boolean,
    default: true,
  },

  showLimit: {
    type: Number,
    default: 1,
  },

  photosLimit: {
    type: Number,
    default: 0,
  },

  verifiedOrder: {
    type: Number,
    default: 0,
  },

  colorCode: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        return v === null || /^#[0-9A-F]{6}$/i.test(v);
      },
      message: props => `${props.value} is not a valid color code!`
    }
  },

  shows: [showSchema],

  isActive: {
    type: Boolean,
    default: false,
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Middleware for state-city validation
venueSchema.pre("save", async function (next) {
  this.updatedAt = Date.now();
  
  // If city is being changed or state is being changed
  if (this.isModified('city') || this.isModified('state')) {
    try {
      // Use STATE_CITY_MAPPING directly from constants
      const stateCities = STATE_CITY_MAPPING[this.state] || [];
      
      if (!stateCities.includes(this.city.toLowerCase())) {
        throw new Error(`City "${this.city}" is not valid for state "${this.state}"`);
      }
    } catch (error) {
      return next(error);
    }
  }
  
  next();
});

const Venue = mongoose.model("Venue", venueSchema);
export default Venue;