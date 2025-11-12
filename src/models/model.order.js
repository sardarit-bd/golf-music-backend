import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
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
      min: 1,
    },
    totalPrice: {
      type: Number,
      required: true,
    },

    // Payment method: stripe | cod
    paymentMethod: {
      type: String,
      enum: ["stripe", "cod"],
      required: true,
    },

    // Payment status
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    // Delivery status
    deliveryStatus: {
      type: String,
      enum: ["pending", "shipped", "delivered", "cancelled"],
      default: "pending",
    },

    shippingInfo: {
      name: { type: String, required: false },
      email: { type: String, required: false },
      phone: { type: String, required: false },
      address: { type: String, required: false },
      city: { type: String, required: false },
      postalCode: { type: String, required: false },
      country: { type: String, required: false, default: "Bangladesh" },
      note: { type: String },
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
