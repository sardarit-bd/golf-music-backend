import { ErrorResponse } from "../middleware/errorHandler.js";
import Merch from "../models/model.merch.js";
import { validationResult } from "express-validator";
import { asyncHandler } from "../utils/asyncHandler.js";


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
