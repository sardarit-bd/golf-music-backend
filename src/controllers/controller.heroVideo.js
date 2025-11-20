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

// UPDATE hero content + video
export const updateHeroSection = async (req, res, next) => {
  try {
    let hero = await HeroSection.findOne();
    if (!hero) hero = await HeroSection.create({});

    if (req.body.title) hero.title = req.body.title;
    if (req.body.subtitle) hero.subtitle = req.body.subtitle;
    if (req.body.buttonText) hero.buttonText = req.body.buttonText;

    if (req.file) {
      hero.videoUrl = req.file.path;
    }

    await hero.save();

    res.json({
      success: true,
      message: "Hero section updated successfully",
      data: hero,
    });
  } catch (error) {
    next(error);
  }
};
