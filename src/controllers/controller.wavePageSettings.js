import WavePageSettings from "../models/model.wavePageSettings.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ErrorResponse } from "../middleware/errorHandler.js";

// GET section text (public)
export const getWavePageSettings = asyncHandler(async (req, res) => {
  let settings = await WavePageSettings.findOne();

  if (!settings) {
    settings = await WavePageSettings.create({});
  }

  res.status(200).json({
    success: true,
    data: {
      sectionTitle: settings.sectionTitle,
      sectionSubtitle: settings.sectionSubtitle,
      yourWavesTitle: settings.yourWavesTitle,
    },
  });
});

// UPDATE section text (admin)
export const updateWavePageSettings = asyncHandler(async (req, res, next) => {
  const { sectionTitle, sectionSubtitle, yourWavesTitle } = req.body;

  // Check if at least one field is provided
  if (!sectionTitle && !sectionSubtitle && !yourWavesTitle) {
    return next(new ErrorResponse("At least one field is required to update", 400));
  }

  const updateData = {};
  
  if (sectionTitle !== undefined) {
    updateData.sectionTitle = sectionTitle.trim();
  }
  
  if (sectionSubtitle !== undefined) {
    updateData.sectionSubtitle = sectionSubtitle.trim();
  }
  
  if (yourWavesTitle !== undefined) {
    updateData.yourWavesTitle = yourWavesTitle.trim();
  }

  const settings = await WavePageSettings.findOneAndUpdate(
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
    message: "Page settings updated successfully!",
    data: {
      sectionTitle: settings.sectionTitle,
      sectionSubtitle: settings.sectionSubtitle,
      yourWavesTitle: settings.yourWavesTitle,
    },
  });
});