import { body } from "express-validator";

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
    .isIn(["artist", "venue", "journalist", "fan"])
    .withMessage("User type must be artist, venue, journalist, or fan"),

  body("genre")
    .if(body("userType").equals("artist"))
    .isIn([
      "Rap",
      "Country",
      "Pop",
      "Rock",
      "Jazz",
      "Reggae",
      "EDM",
      "Classical",
      "Other",
    ])
    .withMessage("Invalid genre selected"),

  body("location")
    .if(body("userType").isIn(["venue", "journalist"]))
    .isIn(["New Orleans", "Biloxi", "Mobile", "Pensacola"])
    .withMessage("Invalid location selected"),
];

export const validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),

  body("password").notEmpty().withMessage("Password is required"),
];

export const validateArtistProfile = [
  body("name")
    .notEmpty()
    .withMessage("Artist name is required")
    .isLength({ max: 100 })
    .withMessage("Name cannot exceed 100 characters"),

  body("city").notEmpty().withMessage("City is required"),

  body("genre")
    .isIn([
      "rap",
      "country",
      "pop",
      "rock",
      "jazz",
      "reggae",
      "edm",
      "classical",
      "other",
    ])
    .withMessage("Please select a valid genre"),

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

  body("city")
    .notEmpty()
    .withMessage("City is required")
    .custom((value) => {
      const validCities = ["new orleans", "biloxi", "mobile", "pensacola"];
      if (!validCities.includes(value.toLowerCase().trim())) {
        throw new Error(
          "City must be New Orleans, Biloxi, Mobile, or Pensacola"
        );
      }
      return true;
    }),

  body("address").notEmpty().withMessage("Address is required"),

  body("seatingCapacity")
    .isInt({ min: 1 })
    .withMessage("Seating capacity must be a positive number"),

  body("openHours").notEmpty().withMessage("Open hours are required"),

  body("openDays").notEmpty().withMessage("Open days are required"),
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

  body("location")
    .notEmpty()
    .withMessage("Location is required")
    .custom((value) => {
      const validLocations = ["new orleans", "biloxi", "mobile", "pensacola"];
      if (!validLocations.includes(value.toLowerCase().trim())) {
        throw new Error(
          "Location must be New Orleans, Biloxi, Mobile, or Pensacola"
        );
      }
      return true;
    }),

  body("credit").notEmpty().withMessage("Credit is required"),
];

// Validate Event Creation
export const validateEvent = [
  body("artistBandName")
    .notEmpty()
    .withMessage("Artist/Band name is required")
    .isLength({ max: 100 })
    .withMessage("Artist/Band name cannot exceed 100 characters"),

  body("time").notEmpty().withMessage("Time is required"),

  body("date")
    .isISO8601()
    .withMessage("Date must be a valid date")
    .custom((value) => {
      const eventDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (eventDate < today) {
        throw new Error("Event date cannot be in the past");
      }
      return true;
    }),

  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
];

// Validate Event Update
export const validateEventUpdate = [
  body("artistBandName")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Artist/Band name cannot exceed 100 characters"),

  body("time").optional(),

  body("date")
    .optional()
    .isISO8601()
    .withMessage("Date must be a valid date")
    .custom((value) => {
      if (value) {
        const eventDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (eventDate < today) {
          throw new Error("Event date cannot be in the past");
        }
      }
      return true;
    }),

  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
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
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ max: 100 })
    .withMessage("Full name cannot exceed 100 characters"),

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
