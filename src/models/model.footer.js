import mongoose from "mongoose";

const footerSchema = new mongoose.Schema({
  logoUrl: {
    type: String,
    default: "/images/logo.png"
  },

  getInTouch: {
    type: [String],
    default: [
      "Campus Contact",
      "Meet With Us",
      "Report Copyright",
      "Report on Security Issues",
      "Privacy Statement"
    ]
  },

  usefulLinks: {
    type: [String],
    default: [
      "Campus Contact",
      "Meet With Us",
      "Report Copyright",
      "Report on Security Issues",
      "Privacy Statement"
    ]
  },

  contact: {
    phone: { type: String, default: "2519994651" },
    email: { type: String, default: "thegulfcoastmusic@gmail.com" }
  },

  socialLinks: {
    instagram: { type: String, default: "" },
    youtube: { type: String, default: "" }
  }

}, { timestamps: true });

const Footer = mongoose.model("Footer", footerSchema);
export default Footer;
