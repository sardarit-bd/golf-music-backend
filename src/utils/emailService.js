import nodemailer from 'nodemailer';
import { EMAIL_PASSWORD, EMAIL_SERVICE, EMAIL_USERNAME } from '../config/environment.js';

const transporter = nodemailer.createTransport({
  service: EMAIL_SERVICE,
  auth: {
    user: EMAIL_USERNAME,
    pass: EMAIL_PASSWORD
  }
});

export const sendVerificationEmail = async (userEmail, userType) => {
  try {
    const verificationMessages = {
      artist: 'Hello, please email thegulfcoastmusic@gmail.com to request verification as a Gulf Coast Artist.',
      venue: 'Hello, please email thegulfcoastmusic@gmail.com to request verification as a Gulf Coast Venue.',
      journalist: 'Hello, please email thegulfcoastmusic@gmail.com to request verification as a Gulf Coast Journalist.',
      // NEW: Photographer message
      photographer: 'Hello, please email thegulfcoastmusic@gmail.com to request verification as a Gulf Coast Photo/Videographer.'
    };

    const message =
      verificationMessages[userType] ||
      'Hello, please contact thegulfcoastmusic@gmail.com for verification.';

    const mailOptions = {
      from: EMAIL_USERNAME,
      to: userEmail,
      subject: `Gulf Coast Music - ${userType.charAt(0).toUpperCase() + userType.slice(1)} Verification`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Gulf Coast Music Verification</h2>
          <p>${message}</p>
          <p>Thank you for registering with Gulf Coast Music!</p>
          <br>
          <p>Best regards,<br>Gulf Coast Music Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send verification email');
  }
};


export const sendResetPasswordEmail = async (email, resetUrl) => {
  const transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE,
    auth: {
      user: EMAIL_USERNAME,
      pass: EMAIL_PASSWORD
    }
  });

  const message = {
    from: `"Gulf Music" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject: "Password Reset Request",
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" target="_blank">${resetUrl}</a>
      <p>This link is valid for 15 minutes.</p>
    `,
  };

  await transporter.sendMail(message);
};

export const sendOrderConfirmationEmail = async (email, order) => {
  try {
    await transporter.sendMail({
      from: EMAIL_USERNAME,
      to: email,
      subject: "Your Order is Confirmed - Gulf Coast Music",
      html: `
        <h2>🎉 Thank you for your purchase!</h2>
        <p>Your payment has been successfully completed.</p>

        <h3>🧾 Order Details:</h3>
        <p><strong>Order ID:</strong> ${order._id}</p>
        <p><strong>Total Amount:</strong> $${order.totalPrice}</p>

        <p>You will be notified when your order ships.</p>
        <br>
        <p>Regards,<br>Gulf Coast Music Team</p>
      `
    });
  } catch (err) {
    console.log("❌ Failed to send order confirmation email:", err);
  }
};

export const sendAdminNewOrderEmail = async (order) => {
  try {
    await transporter.sendMail({
      from: EMAIL_USERNAME,
      to: "thegulfcoastmusic@gmail.com",
      subject: "🔔 New Paid Order Received - Gulf Coast Music",
      html: `
        <h2>New Order Paid</h2>

        <p><strong>Buyer:</strong> ${order.buyer.email}</p>
        <p><strong>Order ID:</strong> ${order._id}</p>
        <p><strong>Total:</strong> $${order.totalPrice}</p>
        <p><strong>Payment Method:</strong> Stripe (Paid)</p>

        <br>
        <p>Login to your dashboard to process the order.</p>
      `
    });
  } catch (err) {
    console.log("❌ Failed to notify admin:", err);
  }
};

