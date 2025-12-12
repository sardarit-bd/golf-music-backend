import mongoose from "mongoose";

const artistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // BASIC FIELDS (available to free & pro)
  name: {
    type: String,
    required: [true, "Artist name is required"],
    trim: true,
    maxlength: [100, "Name cannot exceed 100 characters"],
  },

  city: {
    type: String,
    required: [true, "City is required"],
    trim: true,
  },

  genre: {
    type: String,
    required: [true, "Genre is required"],
    enum: [
      "rap",
      "country",
      "pop",
      "rock",
      "jazz",
      "reggae",
      "edm",
      "classical",
      "other",
    ],
  },

  // PRO FEATURES
  biography: {
    type: String,
    maxlength: [2000, "Biography cannot exceed 2000 characters"],
  },

  photos: [
    {
      url: String,
      filename: String,
    },
  ],

  mp3Files: [
    {
      url: String,
      filename: String,
      originalName: String,
    },
  ],

  // NEW FIELDS (Enable Free vs Pro)
  photosLimit: {
    type: Number,
    default: 0,
  },

  mp3Limit: {
    type: Number,
    default: 0,
  },

  featuresLocked: {
    type: Boolean,
    default: true,
  },

  isActive: {
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

artistSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Artist = mongoose.model("Artist", artistSchema);
export default Artist;
