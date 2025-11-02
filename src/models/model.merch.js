import mongoose from "mongoose";

const merchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: String, required: true },
    image: { type: String, required: true },
    printifyId: { type: String }, 
  },
  { timestamps: true }
);

const Merch = mongoose.model("Merch", merchSchema);
export default Merch;
