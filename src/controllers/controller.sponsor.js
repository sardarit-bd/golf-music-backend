
import { ErrorResponse } from "../middleware/errorHandler.js";
import Sponsor from "../models/model.sponsor.js";

// CREATE
export const createSponsor = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ErrorResponse("Logo image is required", 400));
    }

    const sponsor = await Sponsor.create({
      name: req.body.name,
      logo: req.file.path,
    });

    res.status(201).json({
      success: true,
      message: "Sponsor created successfully",
      data: sponsor,
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL
export const getSponsors = async (req, res, next) => {
  try {
    const sponsors = await Sponsor.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: sponsors,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE
export const updateSponsor = async (req, res, next) => {
  try {
    let sponsor = await Sponsor.findById(req.params.id);

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
  } catch (error) {
    next(error);
  }
};

// DELETE
export const deleteSponsor = async (req, res, next) => {
  try {
    const sponsor = await Sponsor.findByIdAndDelete(req.params.id);

    if (!sponsor) {
      return next(new ErrorResponse("Sponsor not found", 404));
    }

    res.status(200).json({
      success: true,
      message: "Sponsor deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
