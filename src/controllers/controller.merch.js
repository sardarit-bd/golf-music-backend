import { ErrorResponse } from "../middleware/errorHandler.js";
import Merch from "../models/model.merch.js";
import { validationResult } from "express-validator";
import { asyncHandler } from "../utils/asyncHandler.js";
import axios from "axios";


// Get all merch items (Public)

export const getAllMerch = asyncHandler(async (req, res, next) => {
  const merch = await Merch.find({}).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: merch.length,
    data: merch,
  });
});


// Create new merch item (Admin only)

export const createMerch = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array()
    });
  }


  const { name, price, image, printifyId } = req.body;

  // Check duplicates
  const existingMerch = await Merch.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${name}$`, "i") } },
      { printifyId },
    ],
  });

  if (existingMerch) {
    if (existingMerch.name.toLowerCase() === name.toLowerCase()) {
      return next(new ErrorResponse("A merch with this name already exists", 400));
    } else if (existingMerch.printifyId === printifyId) {
      return next(new ErrorResponse("This Printify ID is already linked to another product", 400));
    }
  }

  const merch = await Merch.create({ name, price, image, printifyId });

  res.status(201).json({
    success: true,
    message: "Merch item created successfully!",
    data: merch,
  });
});

// Update merch item (Admin only)
// Private/Admin

export const updateMerch = asyncHandler(async (req, res, next) => {
  const merch = await Merch.findById(req.params.id);
  if (!merch) {
    return next(new ErrorResponse("Merch item not found", 404));
  }

  // Prevent duplicate name/printifyId when updating
  const { name, printifyId } = req.body;
  if (name || printifyId) {
    const duplicate = await Merch.findOne({
      $or: [{ name: name }, { printifyId }],
      _id: { $ne: req.params.id },
    });

    if (duplicate) {
      return next(
        new ErrorResponse("Another merch item with same name or Printify ID already exists", 400)
      );
    }
  }

  const updatedMerch = await Merch.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "Merch item updated successfully",
    data: updatedMerch,
  });
});

// Delete merch item (Admin only)
//  Private/Admin

export const deleteMerch = asyncHandler(async (req, res, next) => {
  const merch = await Merch.findById(req.params.id);
  if (!merch) {
    return next(new ErrorResponse("Merch item not found", 404));
  }

  await merch.deleteOne();

  res.status(200).json({
    success: true,
    message: "Merch item deleted successfully",
  });
});

//!* =========================================== Printify ===============================================================

export const fetchPrintifyProducts = asyncHandler(async (req, res, next) => {
  try {
    const response = await axios.get(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
        },
      }
    );

    const products = response.data.data || response.data;

    res.status(200).json({
      success: true,
      count: products.length,
      data: products.map((p) => ({
        id: p.id,
        title: p.title,
        image: p.images?.[0]?.src || "",
        price: p.variants?.[0]?.price / 100,
        visible: p.visible,
      })),
    });
  } catch (error) {
    console.error("Printify Fetch Error:", error.response?.data || error.message);
    next(new ErrorResponse("Failed to fetch Printify products", 500));
  }
});

// Add all Printify products to database (Admin-only)
export const addAllPrintifyProducts = asyncHandler(async (req, res, next) => {
  try {
    const response = await axios.get(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products.json`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
        },
      }
    );

    const products = response.data.data || response.data;
    let addedCount = 0;

    for (const item of products) {
      const existing = await Merch.findOne({ printifyId: item.id });
      if (!existing) {
        await Merch.create({
          name: item.title,
          price: item.variants?.[0]?.price / 100,
          image: item.images?.[0]?.src || "",
          printifyId: item.id,
        });
        addedCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `${addedCount} new products added successfully.`,
    });
  } catch (error) {
    console.error("AddAll Error:", error.response?.data || error.message);
    next(new ErrorResponse("Failed to import all Printify products", 500));
  }
});

// Add single Printify product to database (Admin-only)
export const addSinglePrintifyProduct = asyncHandler(async (req, res, next) => {
  const { productId } = req.params;

  try {
    const response = await axios.get(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products/${productId}.json`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
        },
      }
    );

    const product = response.data;
    const existing = await Merch.findOne({ printifyId: product.id });
    if (existing) {
      return next(new ErrorResponse("This product already exists in your store", 400));
    }

    const merch = await Merch.create({
      name: product.title,
      price: product.variants?.[0]?.price / 100,
      image: product.images?.[0]?.src || "",
      printifyId: product.id,
    });

    res.status(201).json({
      success: true,
      message: `Product "${product.title}" added successfully.`,
      data: merch,
    });
  } catch (error) {
    console.error("AddSingle Error:", error.response?.data || error.message);
    next(new ErrorResponse("Failed to add this product", 500));
  }
});

// Delete a product (Admin Only)
export const deletePrintifyProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { deleteFromPrintify } = req.query;

  const merch = await Merch.findById(id);
  if (!merch) {
    return next(new ErrorResponse("Product not found in your store", 404));
  }

  try {

    if (deleteFromPrintify === "true" && merch.printifyId) {
      await axios.delete(
        `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/products/${merch.printifyId}.json`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
          },
        }
      );
      console.log(`Printify product ${merch.printifyId} deleted.`);
    }

    // Delete from MongoDB
    await merch.deleteOne();

    res.status(200).json({
      success: true,
      message: `Product "${merch.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error("Delete Product Error:", error.response?.data || error.message);
    next(new ErrorResponse("Failed to delete product", 500));
  }
});
