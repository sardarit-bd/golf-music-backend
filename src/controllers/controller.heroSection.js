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
    const { 
      title, 
      subtitlePrefix, 
      flashWords, 
      buttonText, 
      videoUrl,
      bottomText,
      animationSettings 
    } = req.body;

    let heroData = await HeroSection.findOne();

    if (!heroData) {
      heroData = await HeroSection.create({});
    }

    // Delete OLD video if a NEW video is uploaded
    if (videoUrl && heroData.videoUrl && videoUrl !== heroData.videoUrl) {
      try {
        await cloudinary.uploader.destroy(heroData.videoPublicId, {
          resource_type: "video"
        });
        console.log("Old video deleted:", heroData.videoPublicId);
      } catch (deleteErr) {
        console.error("Failed to delete old video:", deleteErr);
      }
    }

    // Update basic fields
    if (title !== undefined) heroData.title = title;
    if (subtitlePrefix !== undefined) heroData.subtitlePrefix = subtitlePrefix;
    if (buttonText !== undefined) heroData.buttonText = buttonText;

    // Update flash words (if provided)
    if (flashWords !== undefined) {
      if (Array.isArray(flashWords) && flashWords.length > 0) {
        heroData.flashWords = flashWords;
      }
    }

    // Update video
    if (videoUrl !== undefined) {
      heroData.videoUrl = videoUrl;
      // If new video URL doesn't have publicId, set it to null
      if (!videoUrl) {
        heroData.videoPublicId = null;
      }
    }

    // Update bottom text
    if (bottomText !== undefined) {
      if (bottomText.artistName !== undefined) 
        heroData.bottomText.artistName = bottomText.artistName;
      if (bottomText.songName !== undefined) 
        heroData.bottomText.songName = bottomText.songName;
      if (bottomText.separator !== undefined) 
        heroData.bottomText.separator = bottomText.separator;
      if (bottomText.isVisible !== undefined) 
        heroData.bottomText.isVisible = bottomText.isVisible;
    }

    // Update animation settings
    if (animationSettings !== undefined) {
      if (animationSettings.interval !== undefined) 
        heroData.animationSettings.interval = animationSettings.interval;
      if (animationSettings.textColor !== undefined) 
        heroData.animationSettings.textColor = animationSettings.textColor;
      if (animationSettings.isEnabled !== undefined) 
        heroData.animationSettings.isEnabled = animationSettings.isEnabled;
    }

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
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
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

// Get specific field (optional - for partial updates)
export const getHeroField = async (req, res) => {
  try {
    const { field } = req.params;
    const heroData = await HeroSection.findOne();
    
    if (!heroData) {
      return res.status(404).json({
        success: false,
        message: 'Hero section not found'
      });
    }

    // Split nested fields (e.g., "bottomText.artistName")
    const fields = field.split('.');
    let value = heroData;
    for (const f of fields) {
      value = value[f];
      if (value === undefined) break;
    }

    res.status(200).json({
      success: true,
      data: { [field]: value }
    });
  } catch (error) {
    console.error('Get hero field error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hero field',
      error: error.message
    });
  }
};