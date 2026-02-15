// controllers/controller.sponsorSection.js
import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import SponsorSection from "../models/model.sponsorSection.js";

// GET SECTION TEXT (public)
export const getSponsorSectionText = asyncHandler(async (req, res) => {
  let sectionText = await SponsorSection.findOne();

  if (!sectionText) {
    // Create default section text if doesn't exist
    sectionText = await SponsorSection.create({
      sectionTitle: "Our Sponsors",
      sectionSubtitle: "We're proud to partner with amazing local businesses and community supporters.",
    });
  }

  res.status(200).json({
    success: true,
    data: sectionText,
  });
});

// UPDATE SECTION TEXT (admin)
export const updateSponsorSectionText = asyncHandler(async (req, res, next) => {
  const { sectionTitle, sectionSubtitle } = req.body;

  // Check if at least one field is provided
  if (!sectionTitle && !sectionSubtitle) {
    return next(new ErrorResponse("At least one field is required to update", 400));
  }

  const updateData = {};
  
  if (sectionTitle !== undefined) {
    updateData.sectionTitle = sectionTitle.trim();
  }
  
  if (sectionSubtitle !== undefined) {
    updateData.sectionSubtitle = sectionSubtitle.trim();
  }

  // Get the first document or create new one
  let sectionText = await SponsorSection.findOne();

  if (!sectionText) {
    // Create new document
    sectionText = await SponsorSection.create(updateData);
  } else {
    // Update existing document
    sectionText.sectionTitle = updateData.sectionTitle || sectionText.sectionTitle;
    sectionText.sectionSubtitle = updateData.sectionSubtitle || sectionText.sectionSubtitle;
    await sectionText.save();
  }

  res.status(200).json({
    success: true,
    message: "Section text updated successfully!",
    data: sectionText,
  });
});

// CREATE SECTION TEXT (admin - optional)
export const createSponsorSectionText = asyncHandler(async (req, res) => {
  const { sectionTitle, sectionSubtitle } = req.body;

  // Check if already exists
  const existing = await SponsorSection.findOne();
  if (existing) {
    return res.status(400).json({
      success: false,
      message: "Section text already exists",
    });
  }

  const sectionText = await SponsorSection.create({
    sectionTitle: sectionTitle || "Our Sponsors",
    sectionSubtitle: sectionSubtitle || "We're proud to partner with amazing local businesses and community supporters.",
  });

  res.status(201).json({
    success: true,
    message: "Section text created successfully",
    data: sectionText,
  });
});