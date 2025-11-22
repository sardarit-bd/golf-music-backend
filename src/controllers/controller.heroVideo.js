import HeroSection from "../models/model.heroVideo.js";

// GET current hero content
export const getHeroSection = async (req, res, next) => {
  try {
    const data = await HeroSection.findOne();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE hero content + video - FIXED VERSION
export const updateHeroSection = async (req, res, next) => {
  try {

    let hero = await HeroSection.findOne();
    if (!hero) {
      hero = await HeroSection.create({});
    }

    // Fix: Check if req.body exists before accessing properties
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Request body is missing"
      });
    }

    const { title, subtitle, buttonText, videoUrl } = req.body;

    // Update fields if they exist in request body
    if (title !== undefined) hero.title = title;
    if (subtitle !== undefined) hero.subtitle = subtitle;
    if (buttonText !== undefined) hero.buttonText = buttonText;
    if (videoUrl !== undefined) hero.videoUrl = videoUrl;

    await hero.save();

    res.json({
      success: true,
      message: "Hero section updated successfully",
      data: hero,
    });
  } catch (error) {
    console.error("Update error:", error);
    next(error);
  }
};
