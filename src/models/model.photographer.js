import mongoose from "mongoose";

const photographerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  city: {
    type: String,
    enum: ["new orleans", "biloxi", "mobile", "pensacola"],
    required: true,
  },
  biography: {
    type: String,
    maxlength: 2000,
    default: "",
  },
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
    },
  ],
  photos: [
    {
      url: String,
      caption: String,
    },
  ],
  videos: [
    {
      url: String,
      title: String,
    },
  ],
  isActive: {
    type: Boolean,
    default: false,
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

photographerSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Photographer = mongoose.model("Photographer", photographerSchema);
export default Photographer;