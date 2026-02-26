import mongoose from "mongoose";

const marketItemSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one listing per seller
    },

    sellerType: {
      type: String,
      enum: ["artist", "venue", "photographer", "studio", "journalist", "fan"],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    location: {
      type: String,
      default: "",
      enum: ["Louisiana", "Mississippi", "Alabama", "Florida", ""],
    },

    photos: {
      type: [String],
      default: [],
      validate: [
        (arr) => arr.length <= 5,
        "Maximum 5 photos allowed",
      ],
    },

    videos: {
      type: [String],
      default: [],
    },

    // Studio-specific fields
    services: {
      type: Array,
      default: [],
    },

    audioFile: {
      type: String,
      default: "",
    },

    // Subscription snapshot (important for commission stability)
    subscriptionPlan: {
      type: String,
      enum: ["free", "pro"],
      default: "free",
    },

    // Commission snapshot (pre-calculated at creation/update time)
    stripeFee: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["pending", "active", "sold", "hidden"],
      default: "pending",
    },

    stripeConnectRequired: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Full-text search index
marketItemSchema.index({
  title: "text",
  description: "text",
  location: "text",
});

export default mongoose.model("MarketItem", marketItemSchema);