// middleware/validation.js
import { body } from "express-validator";
import { STATE_CITY_MAPPING } from "../utils/constants.js";

export const validateRegistration = [
  body("username")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers and underscores"),

  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body("userType")
    .customSanitizer((value) => value?.toLowerCase())
    .isIn(["artist", "venue", "journalist", "fan", "photographer", "admin", "studio"])
    .withMessage("User type must be artist, venue, journalist, photographer, studio, fan, or admin"),

  body("genre")
    .if(body("userType").equals("artist"))
    .customSanitizer((value) => value?.toLowerCase())
    .custom((value) => {
      const validGenres = [
        "rap",
        "country",
        "pop",
        "rock",
        "jazz",
        "reggae",
        "edm",
        "classical",
        "other",
      ];
      if (!validGenres.includes(value)) {
        throw new Error("Invalid genre selected");
      }
      return true;
    }),

  // STATE validation (for non-fan users)
  body("state")
    .custom((value, { req }) => {
      const userType = req.body.userType;
       const requiresState = ["artist", "venue", "journalist", "photographer", "studio"].includes(userType);
      
      if (requiresState) {
        if (!value) {
          throw new Error("State is required for this user type");
        }
        
        const validStates = Object.keys(STATE_CITY_MAPPING);
        if (!validStates.includes(value)) {
          throw new Error(`Invalid state. Must be one of: ${validStates.join(", ")}`);
        }
      }
      return true;
    })
    .customSanitizer((value) => {
      if (!value) return value;
      // Capitalize first letter, lowercase rest
      return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    }),

  // CITY validation (for non-fan users)
  body("city")
    .custom((value, { req }) => {
      const userType = req.body.userType;
      const requiresCity = ["artist", "venue", "journalist", "photographer", "studio"].includes(userType);
      
      if (requiresCity) {
        if (!value) {
          throw new Error("City is required for this user type");
        }
        
        const state = req.body.state;
        if (state) {
          const stateCities = STATE_CITY_MAPPING[state] || [];
          if (!stateCities.includes(value.toLowerCase())) {
            throw new Error(`City "${value}" is not valid for state "${state}"`);
          }
        }
      }
      return true;
    })
    .customSanitizer((value) => {
      if (!value) return value;
      return value.toLowerCase().trim();
    }),
];

export const validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),

  body("password").notEmpty().withMessage("Password is required"),
];

export const validateForgotPassword = [
  body("email").isEmail().withMessage("Valid email required"),
];

export const validateResetPassword = [
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

export const validateArtistProfile = [
  body("name")
    .notEmpty()
    .withMessage("Artist name is required")
    .isLength({ max: 100 })
    .withMessage("Name cannot exceed 100 characters"),

  body("state")
    .notEmpty()
    .withMessage("State is required")
    .custom((value) => {
      const validStates = Object.keys(STATE_CITY_MAPPING);
      if (!validStates.includes(value)) {
        throw new Error(`Invalid state. Must be one of: ${validStates.join(", ")}`);
      }
      return true;
    }),

  body("city")
    .notEmpty()
    .withMessage("City is required")
    .custom((value, { req }) => {
      const state = req.body.state;
      if (state) {
        const stateCities = STATE_CITY_MAPPING[state] || [];
        if (!stateCities.includes(value.toLowerCase())) {
          throw new Error(`City "${value}" is not valid for state "${state}"`);
        }
      }
      return true;
    }),

  body("genre").custom((value) => {
    const validGenres = [
      "rap",
      "country",
      "pop",
      "rock",
      "jazz",
      "reggae",
      "edm",
      "classical",
      "other",
    ];
    if (!validGenres.includes(value?.toLowerCase())) {
      throw new Error("Please select a valid genre");
    }
    return true;
  }),

  body("biography")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Biography cannot exceed 2000 characters"),
];

export const validateVenueProfile = [
  body("venueName")
    .notEmpty()
    .withMessage("Venue name is required")
    .isLength({ max: 100 })
    .withMessage("Venue name cannot exceed 100 characters"),

  body("state")
    .notEmpty()
    .withMessage("State is required")
    .custom((value) => {
      const validStates = Object.keys(STATE_CITY_MAPPING);
      if (!validStates.includes(value)) {
        throw new Error(`Invalid state. Must be one of: ${validStates.join(", ")}`);
      }
      return true;
    }),

  body("city")
    .notEmpty()
    .withMessage("City is required")
    .custom((value, { req }) => {
      const state = req.body.state;
      if (state) {
        const stateCities = STATE_CITY_MAPPING[state] || [];
        if (!stateCities.includes(value.toLowerCase())) {
          throw new Error(`City "${value}" is not valid for state "${state}"`);
        }
      }
      return true;
    }),

  body("address")
    .optional({ checkFalsy: true })
    .isString()
    .withMessage("Address must be a string"),

  body("seatingCapacity")
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage("Seating capacity must be a positive number"),

  body("openHours")
    .optional({ checkFalsy: true })
    .isString()
    .withMessage("Open hours must be a string"),

  body("openDays")
    .optional({ checkFalsy: true })
    .isString()
    .withMessage("Open days must be a string"),
];

export const validateNews = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),

  body("description")
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ max: 5000 })
    .withMessage("Description cannot exceed 5000 characters"),

  body("state")
    .notEmpty()
    .withMessage("State is required")
    .custom((value) => {
      const validStates = Object.keys(STATE_CITY_MAPPING);
      if (!validStates.includes(value)) {
        throw new Error(`Invalid state. Must be one of: ${validStates.join(", ")}`);
      }
      return true;
    }),

  body("city")
    .notEmpty()
    .withMessage("City is required")
    .custom((value, { req }) => {
      const state = req.body.state;
      if (state) {
        const stateCities = STATE_CITY_MAPPING[state] || [];
        if (!stateCities.includes(value.toLowerCase())) {
          throw new Error(`City "${value}" is not valid for state "${state}"`);
        }
      }
      return true;
    }),

  body("credit").notEmpty().withMessage("Credit is required"),
];

// Validate Event Creation
export const validateEvent = [
  body('artistBandName')
    .trim()
    .notEmpty().withMessage('Artist/Band name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Artist/Band name must be between 2-100 characters'),

  body('date')
    .notEmpty().withMessage('Date is required')
    .custom((value) => {
      // Validate MM/DD/YYYY format
      const regex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}$/;
      if (!regex.test(value)) {
        throw new Error('Date must be in MM/DD/YYYY format (e.g., 01/21/2024)');
      }

      const [month, day, year] = value.split('/').map(Number);
      const date = new Date(year, month - 1, day);

      // Check if date is valid
      if (
        date.getFullYear() !== year ||
        date.getMonth() + 1 !== month ||
        date.getDate() !== day
      ) {
        throw new Error('Invalid date (e.g., February 30th)');
      }

      // Check if date is not in past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);

      if (date < today) {
        throw new Error('Event date cannot be in the past');
      }

      return true;
    }),

  body('time')
    .notEmpty().withMessage('Time is required')
    .matches(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(am|pm|AM|PM)$/)
    .withMessage('Time must be in HH:MM AM/PM format (e.g., 08:30 PM)'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),

  // Note: state and city will be automatically taken from venue profile
];

// Validate Event Update
export const validateEventUpdate = [
  body('artistBandName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Artist/Band name must be between 2-100 characters'),

  body('date')
    .optional()
    .custom((value) => {
      if (!value) return true;

      const regex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}$/;
      if (!regex.test(value)) {
        throw new Error('Date must be in MM/DD/YYYY format');
      }

      const [month, day, year] = value.split('/').map(Number);
      const date = new Date(year, month - 1, day);

      if (
        date.getFullYear() !== year ||
        date.getMonth() + 1 !== month ||
        date.getDate() !== day
      ) {
        throw new Error('Invalid date');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);

      if (date < today) {
        throw new Error('Event date cannot be in the past');
      }

      return true;
    }),

  body('time')
    .optional()
    .matches(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(am|pm|AM|PM)$/)
    .withMessage('Time must be in HH:MM AM/PM format'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),

  body('state')
    .optional()
    .isIn(Object.keys(STATE_CITY_MAPPING)).withMessage('Invalid state'),

  body('city')
    .optional()
    .custom((value, { req }) => {
      if (!value) return true;

      if (req.body.state) {
        const stateCities = STATE_CITY_MAPPING[req.body.state] || [];
        if (!stateCities.includes(value.toLowerCase())) {
          throw new Error(`City "${value}" is not valid for state "${req.body.state}"`);
        }
      }
      return true;
    }),
];

export const validateContact = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),

  body("subject")
    .notEmpty()
    .withMessage("Subject is required")
    .isLength({ max: 200 })
    .withMessage("Subject cannot exceed 200 characters"),

  body("message")
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ max: 2000 })
    .withMessage("Message cannot exceed 2000 characters"),
];

export const validateJournalistProfile = [
  body("fullName")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Full name cannot exceed 100 characters"),

  body("state")
    .optional()
    .custom((value) => {
      if (!value) return true;
      const validStates = Object.keys(STATE_CITY_MAPPING);
      if (!validStates.includes(value)) {
        throw new Error(`Invalid state. Must be one of: ${validStates.join(", ")}`);
      }
      return true;
    }),

  body("cities")
    .optional()
    .custom((value) => {
      if (!value) return true;
      try {
        const cities = JSON.parse(value);
        if (!Array.isArray(cities)) {
          throw new Error("Cities must be a valid JSON array");
        }
        return true;
      } catch {
        throw new Error("Cities must be a valid JSON array");
      }
    }),

  body("bio")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Bio cannot exceed 1000 characters"),

  body("areasOfCoverage")
    .optional()
    .custom((value) => {
      try {
        const areas = JSON.parse(value);
        if (!Array.isArray(areas)) {
          throw new Error("Areas of coverage must be a valid JSON array");
        }
        return true;
      } catch {
        throw new Error("Areas of coverage must be a valid JSON array");
      }
    }),
];

export const validateAdminActions = [
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),

  body("role")
    .optional()
    .isIn(["super_admin", "content_admin", "moderator"])
    .withMessage("Role must be super_admin, content_admin, or moderator"),
];

// MERCH VALIDATION
export const validateMerch = [
  // Product name validation
  body("name")
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ max: 100 })
    .withMessage("Product name cannot exceed 100 characters"),

  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .custom((value) => {
      const cleanValue =
        typeof value === "string" ? value.replace("$", "").trim() : value;

      if (isNaN(cleanValue) || Number(cleanValue) <= 0) {
        throw new Error("Price must be a valid positive number");
      }
      return true;
    }),

  // Description validation
  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  // Image validation (optional if you're using file upload)
  body("image").optional().isURL().withMessage("Image must be a valid URL"),

  // Stock validation
  body("stock")
    .notEmpty()
    .withMessage("Stock is required")
    .isInt({ min: 0 })
    .withMessage("Stock must be a valid non-negative integer"),

  // Quantity validation
  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
];

// CAST (PODCAST) VALIDATION
export const validateCast = [
  body("title")
    .notEmpty()
    .withMessage("Podcast title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),

  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
];

export const validateWave = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),
];