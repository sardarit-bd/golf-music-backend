import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    // 🔑 Order Type
    orderType: {
      type: String,
      enum: ["merch", "market"],
      required: true,
    },

    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.orderType === "market";
      },
    },

    /* ======================
       MERCH ORDER FIELDS
    ====================== */
    merch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merch",
      required: function () {
        return this.orderType === "merch";
      },
    },

    quantity: {
      type: Number,
      min: 1,
      required: function () {
        return this.orderType === "merch";
      },
    },

    paymentMethod: {
      type: String,
      enum: ["stripe", "cod"],
      required: function () {
        return this.orderType === "merch";
      },
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
        "cancelled",
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

    /* ======================
       MARKET ORDER FIELDS
    ====================== */
    marketItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketItem",
      required: function () {
        return this.orderType === "market";
      },
    },

    platformFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* ======================
       COMMON FIELDS
    ====================== */
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    stripePaymentIntentId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ buyer: 1 });
OrderSchema.index({ seller: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ orderType: 1 });

export default mongoose.model("Order", OrderSchema);
