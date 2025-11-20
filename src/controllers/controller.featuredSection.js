import FeaturedSection from "../models/model.featuredSection.js";

export const getFeaturedSection = async (req, res) => {
  const featured = await FeaturedSection.findOne();
  res.json({ success: true, data: featured });
};

export const updateFeaturedSection = async (req, res) => {
  let featured = await FeaturedSection.findOne();
  if (!featured) {
    featured = await FeaturedSection.create({});
  }

  const { subtitle, title, description, streamsCount, hitsCount, listItems } =
    req.body;

  if (subtitle) featured.subtitle = subtitle;
  if (title) featured.title = title;
  if (description) featured.description = description;

  if (streamsCount) featured.streamsCount = streamsCount;
  if (hitsCount) featured.hitsCount = hitsCount;

  if (listItems) {
    featured.listItems = JSON.parse(listItems);
  }

  if (req.file) {
    featured.imageUrl = req.file.path;
  }

  await featured.save();

  res.json({
    success: true,
    message: "Featured section updated",
    data: featured,
  });
};
