import { stripe } from "../config/stripe.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import MarketItem from "../models/model.marketItem.js";
import Order from "../models/model.order.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const calculatePlatformFee = (amount, plan) => {
    const rate = plan === "pro" ? 0.05 : 0.10;
    return Math.round(amount * rate);
};

export const createMarketCheckout = asyncHandler(async (req, res, next) => {
    const { itemId } = req.body;

    if (!req.user) {
        return next(new ErrorResponse("Unauthorized", 401));
    }

    // ✅ seller IS User
    const item = await MarketItem.findById(itemId).populate("seller");

    if (!item) {
        return next(new ErrorResponse("Item not found", 404));
    }

    const seller = item.seller; // ← THIS IS User model

    if (!seller) {
        return next(new ErrorResponse("Seller not found", 404));
    }

    if (!seller.stripeAccountId) {
        return next(
            new ErrorResponse("Seller has not completed Stripe onboarding", 400)
        );
    }

    if (item.status !== "active") {
        return next(
            new ErrorResponse("Item not available for purchase", 400)
        );
    }

    const totalAmount = item.price;

    const platformFee = calculatePlatformFee(
        totalAmount,
        seller.subscriptionPlan
    );

    const order = await Order.create({
        orderType: "market",
        buyer: req.user._id,
        seller: seller._id,
        marketItem: item._id,
        totalPrice: totalAmount,
        platformFee,
        paymentStatus: "pending",
    });


    const session = await stripe.checkout.sessions.create({
        mode: "payment",

        automatic_tax: { enabled: true },

        shipping_address_collection: {
            allowed_countries: ["US"],
        },

        line_items: [
            {
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: item.title,
                    },
                    unit_amount: totalAmount * 100,
                },
                quantity: 1,
            },
        ],

        payment_intent_data: {
            application_fee_amount: platformFee * 100,
            transfer_data: {
                destination: seller.stripeAccountId,
            },
            metadata: {
                orderId: order._id.toString(),
                type: "market",
            },
        },

        success_url: `${process.env.CLIENT_URL}/order-success`,
        cancel_url: `${process.env.CLIENT_URL}/order-cancel`,
    });

    res.status(200).json({
        success: true,
        url: session.url,
    });
});
