import mongoose from "mongoose";

const featuredSectionSchema = new mongoose.Schema({
  subtitle: {
    type: String,
    default: "About Gulf Coast Music",
  },
  title: {
    type: String,
    default: "Catch The Hottest Live Shows On The Gulf Coast",
  },
  description: {
    type: String,
    default:
      "From intimate jazz nights to high-energy rock concerts — explore the best upcoming live music events across the Gulf Coast. Filter by city, artist, or venue and never miss a beat.",
  },

  // Image
  imageUrl: {
    type: String,
    default: null,
  },

  // Badges
  // streamsCount: {
  //   type: Number,
  //   default: 259,
  // },
  // hitsCount: {
  //   type: Number,
  //   default: 100,
  // },

  // Bullet list
  listItems: [
    {
      icon: { type: String },
      title: { type: String },
      text: { type: String },
    },
  ],
});

const FeaturedSection = mongoose.model("FeaturedSection", featuredSectionSchema);
export default FeaturedSection;
