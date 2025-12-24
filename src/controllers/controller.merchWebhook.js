import Order from "../models/model.order.js";
import { sendAdminNewOrderEmail, sendOrderConfirmationEmail } from "../utils/emailService.js";

export const handleMerchWebhook = async (event) => {
  if (event.type !== "checkout.session.completed") return;

  const session = event.data.object;

  // only merch payments
  if (session.mode !== "payment") return;

  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  const order = await Order.findById(orderId).populate("buyer");
  if (!order) return;

  order.paymentStatus = "paid";
  await order.save();

  await sendOrderConfirmationEmail(order.buyer.email, order);
  await sendAdminNewOrderEmail(order);

  console.log("Merch order completed:", orderId);
};
