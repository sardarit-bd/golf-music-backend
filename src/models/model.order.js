import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    merch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merch",
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    quantity: { 
      type: Number, 
      required: true,
      min: 1
    },
    totalPrice: { 
      type: Number, 
      required: true,
      min: 0
    },

    paymentMethod: { 
      type: String, 
      enum: ["stripe", "cod"], 
      required: true 
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    deliveryStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "ready-for-pickup",
        "shipped",
        "delivered",
        "cancelled"
      ],
      default: "pending",
    },

    shippingInfo: {
      name: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      postalCode: String,
      note: String,
    },
  },
  { 
    timestamps: true 
  }
);

// Index for better performance
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ buyer: 1 });
OrderSchema.index({ deliveryStatus: 1 });
OrderSchema.index({ paymentStatus: 1 });

export default mongoose.model("Order", OrderSchema);