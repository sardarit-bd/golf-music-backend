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
      journalist: 'Hello, please email thegulfcoastmusic@gmail.com to request verification as a Gulf Coast Journalist.'
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
    // console.log(`Verification email sent to: ${userEmail}`);
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send verification email');
  }
};
