import CastPageSettings from "../models/model.castPageSettings.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ErrorResponse } from "../middleware/errorHandler.js";

// GET
export const getCastPageSettings = asyncHandler(async (req, res) => {
  let settings = await CastPageSettings.findOne();

  if (!settings) {
    settings = await CastPageSettings.create({});
  }

  res.status(200).json({
    success: true,
    data: settings,
  });
});

// UPDATE
export const updateCastPageSettings = asyncHandler(async (req, res, next) => {
  const { sectionTitle, sectionSubtitle, yourCastsTitle } = req.body;

  const updateData = {};

  if (sectionTitle !== undefined)
    updateData.sectionTitle = sectionTitle.trim();

  if (sectionSubtitle !== undefined)
    updateData.sectionSubtitle = sectionSubtitle.trim();

  if (yourCastsTitle !== undefined)
    updateData.yourCastsTitle = yourCastsTitle.trim();

  if (Object.keys(updateData).length === 0) {
    return next(new ErrorResponse("No fields provided", 400));
  }

  const settings = await CastPageSettings.findOneAndUpdate(
    {},
    updateData,
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    success: true,
    message: "Page settings updated successfully",
    data: settings,
  });
});