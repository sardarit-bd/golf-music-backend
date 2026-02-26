import { stripe } from "../config/stripe.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import MarketItem from "../models/model.marketItem.js";
import Order from "../models/model.order.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createMarketCheckout = asyncHandler(async (req, res, next) => {
  const { itemId } = req.body;

  if (!req.user) {
    return next(new ErrorResponse("Unauthorized", 401));
  }

  const item = await MarketItem.findById(itemId).populate("seller");

  if (!item) {
    return next(new ErrorResponse("Item not found", 404));
  }

  if (item.status !== "active") {
    return next(new ErrorResponse("Item not available for purchase", 400));
  }

  const seller = item.seller;

  if (!seller || !seller.stripeAccountId) {
    return next(
      new ErrorResponse("Seller has not completed Stripe onboarding", 400)
    );
  }

  /* ===============================
     PRICE & COMMISSION (SAFE CENTS LOGIC)
     ✅ Buyer pays full price
     ✅ Fee deducted from seller's portion
  =============================== */

  const itemPrice = parseFloat(item.price);

  if (isNaN(itemPrice) || itemPrice <= 0) {
    return next(new ErrorResponse("Invalid item price", 400));
  }

  // Convert to cents (Stripe safe)
  const itemPriceInCents = Math.round(itemPrice * 100);

  // Commission rate based on seller's subscription
  const commissionRate = seller.subscriptionPlan === "pro" ? 0.05 : 0.10;

  // Platform fee in cents (deducted from seller)
  const platformFeeInCents = Math.round(itemPriceInCents * commissionRate);

  // Seller receives (price minus fee)
  const sellerReceivesInCents = itemPriceInCents - platformFeeInCents;

  /* ===============================
     SHIPPING LOGIC (STATE BASED)
     ✅ $5 same state, $10 different state
  =============================== */

  let shippingInCents = 500; // default $5

  const itemState = item.location;
  const buyerState = req.user.location;

  if (itemState && buyerState && itemState !== buyerState) {
    shippingInCents = 1000; // $10
  }

  /* ===============================
     CREATE ORDER (STORE DOLLARS)
  =============================== */

  const order = await Order.create({
    orderType: "market",
    buyer: req.user._id,
    seller: seller._id,
    marketItem: item._id,
    totalPrice: itemPrice, // dollars (buyer pays full price)
    platformFee: platformFeeInCents / 100, // dollars (deducted from seller)
    shippingCost: shippingInCents / 100, // dollars (added for buyer)
    sellerReceives: sellerReceivesInCents / 100, // dollars (what seller gets after fee)
    paymentStatus: "pending",
  });

  /* ===============================
     STRIPE SESSION
     ✅ application_fee_amount = platform fee (deducted from seller)
     ✅ transfer_data to seller for the remaining amount
  =============================== */

  const session = await stripe.checkout.sessions.create({
    mode: "payment",

    automatic_tax: { enabled: true },

    shipping_address_collection: {
      allowed_countries: ["US"],
    },

    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: {
            amount: shippingInCents,
            currency: "usd",
          },
          display_name:
            shippingInCents === 500
              ? "Standard Shipping (Same State)"
              : "Long Distance Shipping (Different State)",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 3 },
            maximum: { unit: "business_day", value: 7 },
          },
        },
      },
    ],

    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: item.title,
            description: item.description.substring(0, 100),
          },
          unit_amount: itemPriceInCents, // Buyer pays full price
        },
        quantity: 1,
      },
    ],

    payment_intent_data: {
      // Platform fee (deducted from seller's portion)
      application_fee_amount: platformFeeInCents,
      
      // Transfer remaining amount to seller
      transfer_data: {
        destination: seller.stripeAccountId,
      },
      
      metadata: {
        orderId: order._id.toString(),
        type: "market",
        itemId: item._id.toString(),
        sellerId: seller._id.toString(),
        buyerId: req.user._id.toString(),
      },
    },

    success_url: `${process.env.CLIENT_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/order-cancel`,
  });

  res.status(200).json({
    success: true,
    url: session.url,
    breakdown: {
      buyerPays: itemPrice,                 // ✅ $10
      shippingCost: shippingInCents / 100,   // ✅ $5 or $10
      totalBuyerPays: itemPrice + (shippingInCents / 100), // ✅ Total
      sellerReceives: sellerReceivesInCents / 100, // ✅ $9
      adminCommission: platformFeeInCents / 100,    // ✅ $1
      commissionRate: commissionRate * 100 + "%",   // ✅ 10% or 5%
    },
  });
});