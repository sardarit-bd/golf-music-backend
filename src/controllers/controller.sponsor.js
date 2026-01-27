import { ErrorResponse } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Sponsor from "../models/model.sponsor.js";

// CREATE Sponsor
export const createSponsor = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse("Logo image is required", 400));
  }

  // Create sponsor with explicit isPageText: false
  const sponsor = await Sponsor.create({
    name: req.body.name,
    logo: req.file.path,
    isPageText: false  // Explicitly set to false to avoid unique constraint issues
  });

  res.status(201).json({
    success: true,
    message: "Sponsor created successfully",
    data: sponsor,
  });
});

// GET ALL Sponsors
export const getSponsors = asyncHandler(async (req, res) => {
  // Get only sponsors where isPageText is not true
  const sponsors = await Sponsor.find({ 
    $or: [
      { isPageText: false },
      { isPageText: { $exists: false } }
    ]
  }).sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    data: sponsors,
  });
});

// UPDATE Sponsor
export const updateSponsor = asyncHandler(async (req, res, next) => {
  let sponsor = await Sponsor.findOne({ 
    _id: req.params.id,
    $or: [
      { isPageText: false },
      { isPageText: { $exists: false } }
    ]
  });

  if (!sponsor) {
    return next(new ErrorResponse("Sponsor not found", 404));
  }

  sponsor.name = req.body.name || sponsor.name;

  if (req.file) {
    sponsor.logo = req.file.path;
  }

  await sponsor.save();

  res.status(200).json({
    success: true,
    message: "Sponsor updated successfully",
    data: sponsor,
  });
});

// DELETE Sponsor
export const deleteSponsor = asyncHandler(async (req, res, next) => {
  const sponsor = await Sponsor.findOneAndDelete({ 
    _id: req.params.id,
    $or: [
      { isPageText: false },
      { isPageText: { $exists: false } }
    ]
  });

  if (!sponsor) {
    return next(new ErrorResponse("Sponsor not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Sponsor deleted successfully",
  });
});

// GET SECTION TEXT (public)
export const getSponsorSectionText = asyncHandler(async (req, res) => {
  const pageText = await Sponsor.findOneAndUpdate(
    { isPageText: true },
    {
      $setOnInsert: {
        isPageText: true,
        sectionTitle: "Our Sponsors",
        sectionSubtitle:
          "We're proud to partner with amazing local businesses and community supporters.",
      },
    },
    {
      new: true,
      upsert: true,
    }
  );

  res.status(200).json({
    success: true,
    data: {
      sectionTitle: pageText.sectionTitle,
      sectionSubtitle: pageText.sectionSubtitle,
    },
  });
});

// UPDATE SECTION TEXT (admin)
export const updateSponsorSectionText = asyncHandler(async (req, res) => {
  const { sectionTitle, sectionSubtitle } = req.body;

  if (!sectionTitle && !sectionSubtitle) {
    return next( 
      new ErrorResponse("At least one field is required to update", 400)
    );
  }

  const updateData = {};
  if (sectionTitle !== undefined) updateData.sectionTitle = sectionTitle.trim();
  if (sectionSubtitle !== undefined)
    updateData.sectionSubtitle = sectionSubtitle.trim();

  const pageText = await Sponsor.findOneAndUpdate(
    { isPageText: true },
    updateData,
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    success: true,
    message: "Section text updated successfully!",
    data: {
      sectionTitle: pageText.sectionTitle,
      sectionSubtitle: pageText.sectionSubtitle,
    },
  });
});
