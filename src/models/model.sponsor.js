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
  },
  { timestamps: true }
);

const Sponsor = mongoose.model("Sponsor", sponsorSchema);
export default Sponsor;
