import { ErrorResponse } from "../middleware/errorHandler.js";
import Merch from "../models/model.merch.js";
import { validationResult } from "express-validator";
import { asyncHandler } from "../utils/asyncHandler.js";
import Stripe from "stripe";
import Order from "../models/model.order.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Get all orders with advanced filtering
export const getAllOrders = asyncHandler(async (req, res, next) => {
  const { 
    page = 1, 
    limit = 10, 
    status,
    paymentStatus,
    paymentMethod,
    search 
  } = req.query;
  
  const skip = (page - 1) * parseInt(limit);
  
  // Build query
  const query = {};
  
  if (status && status !== 'all') {
    query.deliveryStatus = status;
  }
  
  if (paymentStatus && paymentStatus !== 'all') {
    query.paymentStatus = paymentStatus;
  }
  
  if (paymentMethod && paymentMethod !== 'all') {
    query.paymentMethod = paymentMethod;
  }
  
  // Search functionality
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    query.$or = [
      { _id: { $regex: searchRegex } },
    ];
  }

  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate("buyer", "username email")
    .populate("merch", "name price image description")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: orders,
  });
});

// Update order delivery status
export const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { deliveryStatus } = req.body;

  const validStatuses = [
    "pending",
    "confirmed", 
    "processing",
    "ready-for-pickup",
    "shipped",
    "delivered",
    "cancelled"
  ];

  if (!validStatuses.includes(deliveryStatus)) {
    return next(new ErrorResponse("Invalid delivery status", 400));
  }

  const order = await Order.findById(id);
  if (!order) {
    return next(new ErrorResponse("Order not found", 404));
  }

  // If changing to cancelled, restore stock
  if (deliveryStatus === "cancelled" && order.deliveryStatus !== "cancelled") {
    const merch = await Merch.findById(order.merch);
    if (merch) {
      merch.stock += parseInt(order.quantity);
      await merch.save();
    }
    
    // If paid with stripe, mark for refund
    if (order.paymentStatus === "paid" && order.paymentMethod === "stripe") {
      order.paymentStatus = "refunded";
    }
  }

  // If changing from cancelled to another status, deduct stock again
  if (order.deliveryStatus === "cancelled" && deliveryStatus !== "cancelled") {
    const merch = await Merch.findById(order.merch);
    if (merch && merch.stock >= parseInt(order.quantity)) {
      merch.stock -= parseInt(order.quantity);
      await merch.save();
    } else {
      return next(new ErrorResponse("Insufficient stock", 400));
    }
    
    // Reset payment status if it was refunded
    if (order.paymentStatus === "refunded") {
      order.paymentStatus = order.paymentMethod === "cod" ? "pending" : "paid";
    }
  }

  // If marking as delivered and COD, mark as paid
  if (deliveryStatus === "delivered" && order.paymentMethod === "cod") {
    order.paymentStatus = "paid";
  }

  order.deliveryStatus = deliveryStatus;
  await order.save();

  // Populate the updated order for response
  const updatedOrder = await Order.findById(id)
    .populate("buyer", "username email")
    .populate("merch", "name price image");

  res.status(200).json({
    success: true,
    message: `Order status updated to ${deliveryStatus}`,
    data: updatedOrder,
  });
});

// Update payment status
export const updatePaymentStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  const validStatuses = ["pending", "paid", "failed", "refunded"];

  if (!validStatuses.includes(paymentStatus)) {
    return next(new ErrorResponse("Invalid payment status", 400));
  }

  const order = await Order.findById(id);
  if (!order) {
    return next(new ErrorResponse("Order not found", 404));
  }

  order.paymentStatus = paymentStatus;
  await order.save();

  const updatedOrder = await Order.findById(id)
    .populate("buyer", "username email")
    .populate("merch", "name price image");

  res.status(200).json({
    success: true,
    message: `Payment status updated to ${paymentStatus}`,
    data: updatedOrder,
  });
});

// Mark order as delivered
export const markOrderDelivered = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ErrorResponse("Order not found", 404));

  if (order.deliveryStatus === "delivered") {
    return next(new ErrorResponse("Order already delivered", 400));
  }

  order.deliveryStatus = "delivered";
  if (order.paymentMethod === "cod") {
    order.paymentStatus = "paid";
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: "Order marked as delivered",
    data: order,
  });
});

// Delete order
export const deleteOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ErrorResponse("Order not found", 404));

  if (order.deliveryStatus === "delivered") {
    return next(new ErrorResponse("Delivered orders cannot be deleted", 400));
  }

  // Restore stock if order is not cancelled
  if (order.deliveryStatus !== "cancelled") {
    const merch = await Merch.findById(order.merch);
    if (merch) {
      merch.stock += parseInt(order.quantity);
      await merch.save();
    }
  }

  await order.deleteOne();
  res.status(200).json({
    success: true,
    message: "Order deleted successfully",
  });
});

// Cancel order
export const cancelOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) return next(new ErrorResponse("Order not found", 404));

  if (order.deliveryStatus === "delivered") {
    return next(new ErrorResponse("Delivered order cannot be cancelled", 400));
  }

  if (order.deliveryStatus === "cancelled") {
    return next(new ErrorResponse("Order already cancelled", 400));
  }

  order.deliveryStatus = "cancelled";

  if (order.paymentStatus === "paid" && order.paymentMethod === "stripe") {
    order.paymentStatus = "refunded";
  }

  const merch = await Merch.findById(order.merch);
  if (merch) {
    merch.stock += parseInt(order.quantity);
    await merch.save();
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: "Order cancelled successfully",
    data: order,
  });
});

// Your existing merch functions remain the same...
export const getAllMerch = asyncHandler(async (req, res, next) => {
  const {
    search,
    minPrice,
    maxPrice,
    inStock,
    page = 1,
    limit = 10,
  } = req.query;

  const query = { isActive: true };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  if (inStock === "true") {
    query.stock = { $gt: 0 };
  } else if (inStock === "false") {
    query.stock = { $lte: 0 };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await Merch.countDocuments(query);

  const merch = await Merch.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    count: merch.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: merch,
  });
});

export const getMerchById = asyncHandler(async (req, res, next) => {
  const merch = await Merch.findById(req.params.id);

  if (!merch) {
    return next(new ErrorResponse("Merch item not found", 404));
  }

  res.status(200).json({
    success: true,
    data: merch,
  });
});

export const createMerch = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const { name, price, description, stock, quantity } = req.body;
  const image = req.file?.path || req.body.image;

  if (!image) {
    return next(new ErrorResponse("Product image is required", 400));
  }

  const existing = await Merch.findOne({ name: new RegExp(`^${name}$`, "i") });
  if (existing) {
    return next(new ErrorResponse("A merch with this name already exists", 400));
  }

  const merch = await Merch.create({
    name,
    price: parseFloat(price),
    description,
    image,
    stock: parseInt(stock),
    quantity: parseInt(quantity),
  });

  res.status(201).json({
    success: true,
    message: "Merch item created successfully!",
    data: merch,
  });
});

export const updateMerch = asyncHandler(async (req, res, next) => {
  const merch = await Merch.findById(req.params.id);
  if (!merch) {
    return next(new ErrorResponse("Merch item not found", 404));
  }

  const { name, price, description, stock, quantity, isActive } = req.body;
  const image = req.file?.path || merch.image;

  if (name && name !== merch.name) {
    const duplicate = await Merch.findOne({
      name: new RegExp(`^${name}$`, "i"),
      _id: { $ne: req.params.id },
    });
    if (duplicate) {
      return next(new ErrorResponse("Another merch item with same name exists", 400));
    }
  }

  merch.name = name ?? merch.name;
  merch.price = price ? parseFloat(price) : merch.price;
  merch.description = description ?? merch.description;
  merch.image = image;
  merch.stock = stock ? parseInt(stock) : merch.stock;
  merch.quantity = quantity ? parseInt(quantity) : merch.quantity;
  merch.isActive = isActive ?? merch.isActive;

  await merch.save();

  res.status(200).json({
    success: true,
    message: "Merch item updated successfully",
    data: merch,
  });
});

export const deleteMerch = asyncHandler(async (req, res, next) => {
  const merch = await Merch.findById(req.params.id);
  if (!merch) {
    return next(new ErrorResponse("Merch item not found", 404));
  }
  await merch.deleteOne();
  res.status(200).json({
    success: true,
    message: "Merch item deleted successfully",
  });
});

export const createOrder = asyncHandler(async (req, res, next) => {
  const { merchId, quantity, paymentMethod, shippingInfo } = req.body;
  const userId = req.user._id;

  if (!["stripe", "cod"].includes(paymentMethod)) {
    return next(new ErrorResponse("Invalid payment method", 400));
  }

  if (paymentMethod === "cod" && !shippingInfo) {
    return next(new ErrorResponse("Shipping information is required for COD", 400));
  }

  const merch = await Merch.findById(merchId);
  if (!merch) return next(new ErrorResponse("Product not found", 404));

  if (merch.stock < parseInt(quantity))
    return next(new ErrorResponse("Insufficient stock", 400));

  const totalPrice = merch.price * parseInt(quantity);

  let paymentStatus = "pending";
  let deliveryStatus = "pending";

  const order = await Order.create({
    merch: merch._id,
    buyer: userId,
    quantity: parseInt(quantity),
    totalPrice: parseFloat(totalPrice),
    paymentMethod,
    paymentStatus,
    deliveryStatus,
    ...(shippingInfo && { shippingInfo })
  });

  let stripeSession = null;

  if (paymentMethod === "stripe") {
    stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: merch.name },
            unit_amount: Math.round(totalPrice * 100),
          },
          quantity: parseInt(quantity),
        },
      ],
      mode: "payment",
      metadata: {
        orderId: order._id.toString(),
      },
      success_url: `${process.env.CLIENT_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/order-failed`,
    });
  }

  merch.stock -= parseInt(quantity);
  await merch.save();

  res.status(201).json({
    success: true,
    message: "Order created successfully",
    data: {
      order,
      ...(stripeSession && { stripeSession }),
    },
  });
});

export const handleStripeWebhook = asyncHandler(async (req, res) => {
  const event = req.body;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata.orderId;

    const order = await Order.findById(orderId);

    if (order) {
      order.paymentStatus = "paid";
      await order.save();
    }
  }

  res.status(200).json({ received: true });
});


export const getUserOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ buyer: req.user._id })
        .populate("merch", "name price image description");

    return res.json({
        success: true,
        data: orders
    });
});