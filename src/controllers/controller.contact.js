import { validationResult } from 'express-validator';
import Contact from '../models/models.contact.js';
// import Contact from '../models/model.contact.js';

// Submit Contact Form
export const submitContact = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { email, subject, message } = req.body;

    const contact = await Contact.create({
      email,
      subject,
      message,
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your message. We will get back to you soon!',
      data: { contact },
    });
  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting contact form',
    });
  }
};

// Get All Contacts (Admin only)
export const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { contacts },
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching contacts',
    });
  }
};
