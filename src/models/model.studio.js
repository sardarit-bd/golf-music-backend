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

    photos: [{
        url: String,
        publicId: String,
    }],

    audioFile: {
        url: String,
        publicId: String,
    },

    // Admin control fields
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


const Studio = mongoose.model("Studio", studioSchema);
export default Studio;