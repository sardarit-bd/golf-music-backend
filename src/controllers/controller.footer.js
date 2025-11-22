import Footer from "../models/model.footer.js";

// GET Footer Data
export const getFooter = async (req, res, next) => {
  try {
    const footer = await Footer.findOne();
    res.json({ success: true, data: footer });
  } catch (error) {
    next(error);
  }
};

// UPDATE Footer Data
export const updateFooter = async (req, res, next) => {
  try {
    let footer = await Footer.findOne();
    if (!footer) footer = await Footer.create({});

    const { getInTouch, usefulLinks, phone, email, instagram, youtube } =
      req.body;

    // Update arrays
    if (getInTouch) footer.getInTouch = JSON.parse(getInTouch);
    if (usefulLinks) footer.usefulLinks = JSON.parse(usefulLinks);

    // Update contact
    if (phone) footer.contact.phone = phone;
    if (email) footer.contact.email = email;

    // Update social links
    if (instagram) footer.socialLinks.instagram = instagram;
    if (youtube) footer.socialLinks.youtube = youtube;

    // Update logo (Cloudinary)
    if (req.file) footer.logoUrl = req.file.path;

    await footer.save();

    res.json({ success: true, message: "Footer updated successfully", data: footer });
  } catch (error) {
    next(error);
  }
};
