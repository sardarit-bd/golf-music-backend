import mongoose from "mongoose";
import { STATE_CITY_MAPPING } from "../utils/constants.js";

const eventSchema = new mongoose.Schema({
  artistBandName: {
    type: String,
    required: [true, "Artist/Band name is required"],
    trim: true,
    maxlength: [100, "Artist/Band name cannot exceed 100 characters"],
  },

  image: {
    url: { type: String },
    filename: { type: String },
  },

  eventTime: {
    type: String,
    required: [true, "Time is required"],
    validate: {
      validator: function (v) {
        if (!v) return false;
        return /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(am|pm|AM|PM)$/.test(v);
      },
      message: "Please enter a valid time format (e.g., 08:30 PM)",
    },
  },

  date: {
    type: Date,
    required: [true, "Date is required"],
    set: function (dateInput) {
      let d;

      if (typeof dateInput === "string" && dateInput.includes("/")) {
        const [month, day, year] = dateInput.split("/").map(Number);
        d = new Date(year, month - 1, day);
      } else {
        d = new Date(dateInput);
      }

      let hours = 0;
      let minutes = 0;

      if (this.eventTime) {
        const timeMatch = this.eventTime.match(/(\d+):(\d+)\s*(am|pm)/i);

        if (timeMatch) {
          hours = parseInt(timeMatch[1]);
          minutes = parseInt(timeMatch[2]);

          const period = timeMatch[3].toLowerCase();

          if (period === "pm" && hours < 12) hours += 12;
          if (period === "am" && hours === 12) hours = 0;
        }
      }

      return new Date(Date.UTC(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        hours,
        minutes,
        0
      ));
    },
    validate: {
      validator: function (value) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const eventDate = new Date(value);
        eventDate.setHours(0, 0, 0, 0);

        return eventDate >= today;
      },
      message: "Event date cannot be in the past",
    },
  },

  dateOnly: {
    type: Date,
    index: true,
  },

  description: {
    type: String,
    maxlength: [1000, "Description cannot exceed 1000 characters"],
    default: "",
  },

  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Venue",
    required: false,
    default: null,
  },

  customVenueName: {
    type: String,
    trim: true,
    default: "",
  },

  state: {
    type: String,
    enum: ["Louisiana", "Mississippi", "Alabama", "Florida"],
    default: "Alabama",
  },

  city: {
    type: String,
    required: [true, "City is required"],
    set: (v) => (v ? v.toLowerCase().trim() : v),
  },

  color: {
    type: String,
    default: "#000000",
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

eventSchema.pre("validate", function (next) {
  if (!this.venue && !this.customVenueName) {
    return next(
      new Error("Either existing venue or custom venue name is required")
    );
  }

  next();
});

eventSchema.pre("save", async function (next) {
  this.updatedAt = Date.now();

  if (this.venue) {
    try {
      const Venue = mongoose.model("Venue");
      const venue = await Venue.findById(this.venue).select(
        "state city colorCode"
      );

      if (venue) {
        this.state = venue.state || this.state || "Alabama";
        this.city = venue.city || this.city || "mobile";
        this.color = venue.colorCode || this.color || "#000000";
      }
    } catch (error) {
      console.error("Error fetching venue:", error);
    }
  }

  // dateOnly set
  if (this.date) {
    const d = new Date(this.date);
    this.dateOnly = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    );
  }

  // state-city validation
  if (this.state && this.city) {
    const stateCities = STATE_CITY_MAPPING[this.state] || [];

    if (!stateCities.includes(this.city.toLowerCase())) {
      return next(
        new Error(`City "${this.city}" is not valid for state "${this.state}"`)
      );
    }
  }

  next();
});

eventSchema.virtual("formattedDate").get(function () {
  const localDate = new Date(this.date);

  return localDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

eventSchema.virtual("displayTime").get(function () {
  if (this.eventTime) return this.eventTime;

  const localDate = new Date(this.date);

  let hours = localDate.getHours();
  let minutes = localDate.getMinutes();

  const ampm = hours >= 12 ? "pm" : "am";

  hours = hours % 12;
  hours = hours ? hours : 12;
  minutes = minutes < 10 ? "0" + minutes : minutes;

  return `${hours}:${minutes} ${ampm}`;
});

eventSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    if (doc.populated("venue") && doc.venue?.colorCode) {
      ret.color = doc.venue.colorCode;
    } else {
      ret.color = doc.color || "#000000";
    }

    ret.displayDate = doc.formattedDate;
    ret.displayTime = doc.displayTime;

    // Frontend display helper
    ret.venueDisplayName =
      doc.venue?.venueName || doc.customVenueName || "Custom Venue";

    return ret;
  },
});

eventSchema.index({ state: 1, city: 1, dateOnly: 1 });
eventSchema.index({ venue: 1, dateOnly: 1 });
eventSchema.index({ isActive: 1, dateOnly: 1 });

const Event = mongoose.model("Event", eventSchema);

export default Event;