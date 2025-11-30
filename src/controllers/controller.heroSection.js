import { cloudinary } from "../config/cloudinary.js";
import HeroSection from '../models/model.heroSection.js';

// Get hero section data
export const getHeroSection = async (req, res) => {
  try {
    let heroData = await HeroSection.findOne();

    if (!heroData) {
      heroData = await HeroSection.create({});
    }

    res.status(200).json({
      success: true,
      data: heroData
    });
  } catch (error) {
    console.error('Get hero section error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hero section',
      error: error.message
    });
  }
};

// Update hero section
export const updateHeroSection = async (req, res) => {
  try {
    const { title, subtitle, buttonText, videoUrl } = req.body;

    let heroData = await HeroSection.findOne();

    if (!heroData) {
      heroData = await HeroSection.create({});
    }

    // Delete OLD video if a NEW video is uploaded
    if (videoUrl && heroData.videoUrl && videoUrl !== heroData.videoUrl) {
      try {
        await cloudinary.uploader.destroy(heroData.videoUrl, {
          resource_type: "video"
        });
        console.log("Old video deleted:", heroData.videoUrl);
      } catch (deleteErr) {
        console.error("Failed to delete old video:", deleteErr);
      }
    }

    // Update fields
    if (title !== undefined) heroData.title = title;
    if (subtitle !== undefined) heroData.subtitle = subtitle;
    if (buttonText !== undefined) heroData.buttonText = buttonText;

    // Update video
    if (videoUrl !== undefined) heroData.videoUrl = videoUrl;

    await heroData.save();

    res.status(200).json({
      success: true,
      message: "Hero section updated successfully",
      data: heroData
    });
  } catch (error) {
    console.error("Update hero section error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update hero section",
      error: error.message
    });
  }
};

// Get Cloudinary upload signature
export const getUploadSignature = async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: 'hero-videos',
        resource_type: 'video'
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      success: true,
      data: {
        signature,
        timestamp,
        cloudName: process.env.CLOUDINARY_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY
      }
    });
  } catch (error) {
    console.error('Signature generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate upload signature',
      error: error.message
    });
  }
};