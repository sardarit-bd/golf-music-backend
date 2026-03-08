import { asyncHandler } from "../utils/asyncHandler.js";
import { ErrorResponse } from "../middleware/errorHandler.js";
import Order from "../models/model.order.js";
import MarketItem from "../models/model.marketItem.js";
import { stripe } from "../config/stripe.js";

// Get seller analytics
export const getMarketAnalytics = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { range = "30days" } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch(range) {
        case "7days":
            startDate.setDate(startDate.getDate() - 7);
            break;
        case "30days":
            startDate.setDate(startDate.getDate() - 30);
            break;
        case "90days":
            startDate.setDate(startDate.getDate() - 90);
            break;
        case "year":
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        default:
            startDate.setDate(startDate.getDate() - 30);
    }

    // Get seller's items
    const sellerItems = await MarketItem.find({ seller: userId });
    const itemIds = sellerItems.map(item => item._id);

    // Get orders for seller's items
    const orders = await Order.find({
        seller: userId,
        orderType: "market",
        createdAt: { $gte: startDate, $lte: endDate }
    })
    .populate("buyer", "username email")
    .populate("marketItem", "title photos price")
    .sort({ createdAt: -1 });

    // Calculate statistics
    const totalSales = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const totalFees = orders.reduce((sum, order) => sum + (order.platformFee || 0), 0);
    const netEarnings = totalRevenue - totalFees;

    const pendingOrders = orders.filter(o => 
        o.deliveryStatus !== "delivered" && o.deliveryStatus !== "cancelled"
    ).length;
    
    const completedOrders = orders.filter(o => 
        o.deliveryStatus === "delivered"
    ).length;

    // Sales by day for chart
    const salesByDay = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dayStart = new Date(currentDate);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const dayOrders = orders.filter(o => 
            o.createdAt >= dayStart && o.createdAt <= dayEnd
        );

        const dayTotal = dayOrders.reduce((sum, o) => sum + o.totalPrice, 0);

        salesByDay.push({
            date: new Date(currentDate),
            amount: dayTotal,
            count: dayOrders.length
        });

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Top selling items
    const itemSales = {};
    orders.forEach(order => {
        if (order.marketItem) {
            const itemId = order.marketItem._id.toString();
            if (!itemSales[itemId]) {
                itemSales[itemId] = {
                    ...order.marketItem.toObject(),
                    soldCount: 0,
                    revenue: 0
                };
            }
            itemSales[itemId].soldCount++;
            itemSales[itemId].revenue += order.totalPrice;
        }
    });

    const topSellingItems = Object.values(itemSales)
        .sort((a, b) => b.soldCount - a.soldCount)
        .slice(0, 5);

    res.status(200).json({
        success: true,
        data: {
            totalSales,
            totalRevenue,
            totalFees,
            netEarnings,
            activeListings: sellerItems.filter(i => i.status === "active").length,
            totalOrders: orders.length,
            pendingOrders,
            completedOrders,
            recentOrders: orders.slice(0, 10),
            salesByDay,
            topSellingItems
        }
    });
});

// Get Stripe balance
export const getStripeBalance = asyncHandler(async (req, res, next) => {
    const user = req.user;

    if (!user.stripeAccountId) {
        return res.status(200).json({
            success: true,
            data: {
                available: [{ amount: 0, currency: "usd" }],
                pending: [{ amount: 0, currency: "usd" }]
            }
        });
    }

    try {
        const balance = await stripe.balance.retrieve({
            stripeAccount: user.stripeAccountId
        });

        res.status(200).json({
            success: true,
            data: balance
        });
    } catch (error) {
        console.error("Error fetching Stripe balance:", error);
        res.status(200).json({
            success: true,
            data: {
                available: [{ amount: 0, currency: "usd" }],
                pending: [{ amount: 0, currency: "usd" }]
            }
        });
    }
});