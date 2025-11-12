import { ErrorResponse } from "../middleware/errorHandler.js";
import Merch from "../models/model.merch.js";
import { validationResult } from "express-validator";
import { asyncHandler } from "../utils/asyncHandler.js";
import Stripe from "stripe";
import Order from "../models/model.order.js";


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Get all merch items (with search & filters)
export const getAllMerch = asyncHandler(async (req, res, next) => {
  const {
    search, 
    minPrice, 
    maxPrice,
    inStock,
    page = 1,
    limit = 10,
  } = req.query;

  const query = {};

  // Search by name or description
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },    
      { description: { $regex: search, $options: "i" } },  
    ];
  }

  // Price range filter
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  // Stock filter
  if (inStock === "true") {
    query.stock = { $gt: 0 };
  } else if (inStock === "false") {
    query.stock = { $lte: 0 };
  }

  // Pagination setup
  const skip = (page - 1) * limit;
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


// Get single merch item by ID
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


// Create new merch (with image upload)
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

  // Check duplicate
  const existing = await Merch.findOne({ name: new RegExp(`^${name}$`, "i") });
  if (existing) {
    return next(new ErrorResponse("A merch with this name already exists", 400));
  }

  const merch = await Merch.create({
    name,
    price,
    description,
    image,
    stock,
    quantity,
  });

  res.status(201).json({
    success: true,
    message: "Merch item created successfully!",
    data: merch,
  });
});

// Update merch (with image upload)
export const updateMerch = asyncHandler(async (req, res, next) => {
  const merch = await Merch.findById(req.params.id);
  if (!merch) {
    return next(new ErrorResponse("Merch item not found", 404));
  }

  const { name, price, description, stock, quantity } = req.body;
  const image = req.file?.path || merch.image;

  // Check for duplicates (except current one)
  if (name && name !== merch.name) {
    const duplicate = await Merch.findOne({
      name: new RegExp(`^${name}$`, "i"),
      _id: { $ne: req.params.id },
    });
    if (duplicate) {
      return next(new ErrorResponse("Another merch item with same name exists", 400));
    }
  }

  merch.name = name || merch.name;
  merch.price = price || merch.price;
  merch.description = description || merch.description;
  merch.image = image;
  merch.stock = stock ?? merch.stock;
  merch.quantity = quantity ?? merch.quantity;
   
  await merch.save();

  res.status(200).json({
    success: true,
    message: "Merch item updated successfully",
    data: merch,
  });
});

// Delete merch
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





// Create Order with Stripe / COD
export const createOrder = asyncHandler(async (req, res, next) => {
  const { merchId, quantity, paymentMethod, shippingInfo } = req.body;
  const userId = req.user._id;

  // Validate payment method
  if (!["stripe", "cod"].includes(paymentMethod)) {
    return next(new ErrorResponse("Invalid payment method", 400));
  }

  // For COD, shipping info required
  if (paymentMethod === "cod" && !shippingInfo) {
    return next(new ErrorResponse("Shipping information is required for COD", 400));
  }

  const merch = await Merch.findById(merchId);
  if (!merch) return next(new ErrorResponse("Product not found", 404));

  if (merch.stock < quantity)
    return next(new ErrorResponse("Insufficient stock", 400));

  const totalPrice = merch.price * quantity;

  let paymentStatus = "pending";
  let deliveryStatus = "pending";
  let stripeSession = null;

  // Stripe Payment Flow
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
          quantity,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/order-success`,
      cancel_url: `${process.env.CLIENT_URL}/order-failed`,
    });
  }

  // Cash On Delivery Flow
  if (paymentMethod === "cod") {
    paymentStatus = "pending";
    deliveryStatus = "pending";
  }

  //Create Order (add shipping info)
  const order = await Order.create({
    merch: merch._id,
    buyer: userId,
    quantity,
    totalPrice,
    paymentMethod,
    paymentStatus,
    deliveryStatus,
    ...(shippingInfo && { shippingInfo })
  });

  // Reduce stock
  merch.stock -= quantity;
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



// Stripe Webhook (for auto payment confirmation)
export const handleStripeWebhook = asyncHandler(async (req, res) => {
  const event = req.body;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const order = await Order.findOne({ totalPrice: session.amount_total / 100 });
    if (order) {
      order.paymentStatus = "paid";
      await order.save();
    }
  }

  res.status(200).json({ received: true });
});

// Admin marks as delivered
// export const markOrderDelivered = asyncHandler(async (req, res, next) => {
//   const order = await Order.findById(req.params.id);
//   if (!order) return next(new ErrorResponse("Order not found", 404));

//   order.deliveryStatus = "delivered";
//   if (order.paymentMethod === "cod") order.paymentStatus = "paid";

//   await order.save();

//   res.status(200).json({
//     success: true,
//     message: "Order marked as delivered",
//     data: order,
//   });
// });


export const getAllOrders = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const total = await Order.countDocuments();
  const orders = await Order.find()
    .populate("buyer", "username email")
    .populate("merch", "name price image")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
    data: orders,
  });
});

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


export const deleteOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ErrorResponse("Order not found", 404));

  if (order.deliveryStatus === "delivered") {
    return next(new ErrorResponse("Delivered orders cannot be deleted", 400));
  }

  await order.deleteOne();
  res.status(200).json({
    success: true,
    message: "Order deleted successfully",
  });
});
