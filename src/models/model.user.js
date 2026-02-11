import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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
    enum: ["artist", "venue", "journalist", "fan", "admin", "photographer", "studio"],
    set: (val) => val.toLowerCase(),
  },

  genre: {
    type: String,
    enum: ["rap", "country", "pop", "rock", "jazz", "reggae", "edm", "classical", "other"],
    set: (val) => (val ? val.toLowerCase() : val),
    required: function () {
      return this.userType === "artist";
    },
  },

  state: {
    type: String,
    enum: ["Louisiana", "Mississippi", "Alabama", "Florida", null],
    default: null,
    set: (val) => {
      if (!val) return null;
      return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
    },
    required: function () {
      return ["artist", "venue", "journalist", "photographer", "studio"].includes(this.userType);
    },
  },

  city: {
    type: String,
    set: (val) => (val ? val.toLowerCase().trim() : val),
    required: function () {
      return ["artist", "venue", "journalist", "photographer", "studio"].includes(this.userType);
    },
    validate: {
      validator: function (v) {
        if (!v || !this.state) return true;

        const stateCityMapping = {
          'Louisiana': ['new orleans', 'baton rouge', 'lafayette', 'shreveport', 'lake charles', 'monroe'],
          'Mississippi': ['jackson', 'biloxi', 'gulfport', 'oxford', 'hattiesburg'],
          'Alabama': ['birmingham', 'mobile', 'huntsville', 'tuscaloosa'],
          'Florida': ['tampa', 'st. petersburg', 'clearwater', 'pensacola', 'panama city', 'fort myers']
        };

        const validCities = stateCityMapping[this.state] || [];
        return validCities.includes(v.toLowerCase());
      },
      message: function (props) {
        return `City "${props.value}" is not valid for state "${this.state}"`;
      }
    }
  },

  subscriptionPlan: {
    type: String,
    enum: ["free", "pro"],
    default: "free",
  },

  subscriptionStatus: {
    type: String,
    enum: [
      "none",
      "trialing",
      "active",
      "incomplete",
      "past_due",
      "canceled",
      "expired",
    ],
    default: "none",
  },

  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
  },

  trialStartedAt: {
    type: Date,
    default: null,
  },

  trialEndsAt: {
    type: Date,
    default: null,
  },

  trialUsed: {
    type: Boolean,
    default: false,
  },

  // ===== Stripe Payment =====
  stripeCustomerId: {
    type: String,
    default: null,
  },

  stripeSubscriptionId: {
    type: String,
    default: null,
  },

  // ===== Stripe Connect (Market sellers) =====
  stripeAccountId: {
    type: String,
    default: null,
  },

  // Stripe Connect status
  stripeAccountStatus: {
    type: String,
    enum: ['not_connected', 'pending', 'active', 'restricted'],
    default: 'not_connected',
  },

  resetPasswordToken: { type: String },
  resetPasswordExpire: { type: Date },

  isActive: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  verificationRequested: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update timestamp on save
userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Password hashing middleware
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Method to generate reset password token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
  return resetToken;
};

// Check if Stripe is connected
userSchema.methods.isStripeConnected = function () {
  return !!this.stripeAccountId && this.stripeAccountStatus === 'active';
};

// Check if user can sell in market
userSchema.methods.canSellInMarket = function () {
  const allowedSellerTypes = ["artist", "venue", "photographer", "studio", "journalist", "fan"];
  return this.isVerified && 
         allowedSellerTypes.includes(this.userType) &&
         this.isStripeConnected();
};

// Virtual for display location
userSchema.virtual('displayLocation').get(function () {
  if (this.city && this.state) {
    return `${this.city.charAt(0).toUpperCase() + this.city.slice(1)}, ${this.state}`;
  }
  return null;
});

// Virtual for Stripe status message
userSchema.virtual('stripeStatusMessage').get(function () {
  if (!this.stripeAccountId) return 'Not Connected';
  
  switch (this.stripeAccountStatus) {
    case 'active':
      return 'Connected';
    case 'pending':
      return 'Onboarding in Progress';
    case 'restricted':
      return 'Restricted';
    default:
      return 'Not Connected';
  }
});

// Indexes for faster queries
userSchema.index({ state: 1, city: 1 });
userSchema.index({ userType: 1, state: 1 });
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ stripeAccountId: 1 });
userSchema.index({ isVerified: 1 });

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model("User", userSchema);
export default User;