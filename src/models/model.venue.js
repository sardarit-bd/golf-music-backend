// models/model.venue.js
import mongoose from "mongoose";

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

  // BASIC FIELDS (free & pro)
  venueName: {
    type: String,
    required: [true, "Venue name is required"],
    trim: true,
    maxlength: [100, "Venue name cannot exceed 100 characters"],
  },

  city: {
    type: String,
    required: [true, "City is required"],
    enum: ["new orleans", "biloxi", "mobile", "pensacola"],
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
    default: "#000000",
  },

  shows: [showSchema],

  isActive: {
    type: Boolean,
    default: false,
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

venueSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Venue = mongoose.model("Venue", venueSchema);
export default Venue;
