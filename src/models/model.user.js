import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Username is required"],
    unique: true,
    trim: true,
    minlength: [3, "Username must be at least 3 characters"],
    maxlength: [50, "Username cannot exceed 50 characters"],
    match: [
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores",
    ],
  },

  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      "Please enter a valid email",
    ],
  },

  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false,
  },


  userType: {
    type: String,
    required: [true, "User type is required"],
    enum: ["artist", "venue", "journalist", "fan", "admin"],
    set: (val) => val.toLowerCase(),
  },

  genre: {
    type: String,
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
    set: (val) => (val ? val.toLowerCase() : val),
    required: function () {
      return this.userType === "artist";
    },
  },


  location: {
    type: String,
    enum: ["new orleans", "biloxi", "mobile", "pensacola"],
    set: (val) => (val ? val.toLowerCase() : val),
    required: function () {
      return this.userType === "venue" || this.userType === "journalist";
    },
  },

  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verificationRequested: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});


userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});


userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
