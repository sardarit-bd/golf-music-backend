import mongoose from "mongoose";

const servicePriceSchema = new mongoose.Schema({
    service: {
        type: String,
        required: [true, "Service name is required"],
        trim: true,
    },
    price: {
        type: String,
        required: [true, "Price is required"],
    }
});

// 🔥 FIXED: Photo schema with better defaults
const photoSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true
    },
    publicId: {
        type: String,
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
}, {
    _id: true,
    timestamps: false
});

const studioSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },

    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
    },

    city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
        lowercase: true,
    },

    state: {
        type: String,
        required: [true, "State is required"],
        enum: ["Louisiana", "Mississippi", "Alabama", "Florida"],
    },

    biography: {
        type: String,
        default: "",
    },

    services: [servicePriceSchema],

    // 🔥 FIXED: Use photoSchema for consistency
    photos: [photoSchema],

    audioFile: {
        url: String,
        publicId: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    },

    isActive: {
        type: Boolean,
        default: true,
    },

    isVerified: {
        type: Boolean,
        default: false,
    },

    isFeatured: {
        type: Boolean,
        default: false,
    },

}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        getters: true 
    },
    toObject: {             
        virtuals: true,
        getters: true 
    }
});

// 🔥 FIXED: Virtual for photo count
studioSchema.virtual('photoCount').get(function() {
    return this.photos?.length || 0;
});

// 🔥 FIXED: Virtual for hasAudio
studioSchema.virtual('hasAudio').get(function() {
    return !!(this.audioFile && this.audioFile.url);
});

const Studio = mongoose.model("Studio", studioSchema);
export default Studio;