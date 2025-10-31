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
  venueName: {
    type: String,
    required: [true, "Venue name is required"],
    trim: true,
    maxlength: [100, "Venue name cannot exceed 100 characters"],
  },
  city: {
    type: String,
    required: [true, "City is required"],
    enum: {
      values: ["new orleans", "biloxi", "mobile", "pensacola"],
      message: "City must be New Orleans, Biloxi, Mobile, or Pensacola",
    },
    set: (v) => v.toLowerCase().trim(),
  },
  address: {
    type: String,
    required: [true, "Address is required"],
    trim: true,
  },
  seatingCapacity: {
    type: Number,
    required: [true, "Seating capacity is required"],
    min: [1, "Seating capacity must be at least 1"],
  },
  biography: {
    type: String,
    maxlength: [2000, "Biography cannot exceed 2000 characters"],
  },
  openHours: {
    type: String,
    required: [true, "Open hours are required"],
  },
  openDays: {
    type: String,
    required: [true, "Open days are required"],
  },
  photos: [
    {
      url: String,
      filename: String,
    },
  ],
   verifiedOrder: {
    type: Number,
    default: 0,
  },
  colorCode: {
    type: String,
    default: "Gray",
  },
  shows: [showSchema],
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

// Automatically update `updatedAt` before saving
venueSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Venue = mongoose.model("Venue", venueSchema);
export default Venue;
