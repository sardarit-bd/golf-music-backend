import mongoose from "mongoose";

const sponsorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Sponsor name is required"],
      trim: true,
      maxlength: 100,
    },
    logo: {
      type: String,
      required: [true, "Sponsor logo is required"],
    },
    
    // SECTION TEXT SETTINGS (For Admin to edit page text)
    isPageText: {
      type: Boolean,
      default: false,
    },
    
    sectionTitle: {
      type: String,
      default: "Our Sponsors",
      trim: true,
    },
    
    sectionSubtitle: {
      type: String,
      default: "We're proud to partner with amazing local businesses and community supporters.",
      trim: true,
    },
  },
  { timestamps: true }
);

// Use partialFilterExpression for better uniqueness control
sponsorSchema.index({ isPageText: 1 }, { 
  unique: true, 
  partialFilterExpression: { isPageText: true }
});

const Sponsor = mongoose.model("Sponsor", sponsorSchema);
export default Sponsor;