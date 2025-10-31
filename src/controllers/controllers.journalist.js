import { validationResult } from 'express-validator';
import Journalist from '../models/model.journalist.js';
import User from '../models/model.user.js';
import News from '../models/model.news.js';


//  CREATE or UPDATE Journalist Profile

export const createOrUpdateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { fullName, bio, areasOfCoverage } = req.body;

    let journalist = await Journalist.findOne({ user: req.user.id });


    // Update existing journalist

    if (journalist) {
      journalist = await Journalist.findByIdAndUpdate(
        journalist._id,
        {
          fullName,
          bio,
          areasOfCoverage: areasOfCoverage
            ? JSON.parse(areasOfCoverage)
            : journalist.areasOfCoverage,
          profilePhoto: req.file
            ? {
                url: req.file.path, 
                filename: req.file.filename,
              }
            : journalist.profilePhoto,
        },
        { new: true, runValidators: true }
      );


    } 

    
    //  Create new journalist profile

    else {
      journalist = await Journalist.create({
        user: req.user.id,
        fullName,
        bio,
        areasOfCoverage: areasOfCoverage ? JSON.parse(areasOfCoverage) : [],
        profilePhoto: req.file
          ? {
              url: req.file.path,
              filename: req.file.filename,
            }
          : null,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Journalist profile saved successfully',
      data: { journalist },
    });
  } catch (error) {
    console.error('Journalist profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while saving journalist profile',
    });
  }
};

//  UPDATE Journalist Profile (explicit PUT)

export const updateJournalistProfile = async (req, res) => {
  try {
    const { fullName, bio, areasOfCoverage } = req.body;

    const journalist = await Journalist.findOneAndUpdate(
      { user: req.user.id },
      {
        fullName,
        bio,
        areasOfCoverage: areasOfCoverage ? JSON.parse(areasOfCoverage) : undefined,
        profilePhoto: req.file
          ? {
              url: `/uploads/${req.file.filename}`,
              filename: req.file.filename,
            }
          : undefined,
      },
      { new: true, runValidators: true }
    );

    if (!journalist) {
      return res.status(404).json({
        success: false,
        message: 'Journalist profile not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Journalist profile updated successfully',
      data: { journalist },
    });
  } catch (error) {
    console.error('Update journalist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating journalist profile',
    });
  }
};


//  DELETE Journalist Profile

export const deleteJournalistProfile = async (req, res) => {
  try {
    const journalist = await Journalist.findOne({ user: req.user.id });

    if (!journalist) {
      return res.status(404).json({
        success: false,
        message: 'Journalist profile not found',
      });
    }

    await journalist.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Journalist profile deleted successfully',
    });
  } catch (error) {
    console.error('Delete journalist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting journalist profile',
    });
  }
};


//  GET Logged-in Journalist Profile

export const getProfile = async (req, res) => {
  try {
    const journalist = await Journalist.findOne({ user: req.user.id }).populate(
      'user',
      'username email userType isVerified'
    );

    if (!journalist) {
      return res.status(404).json({
        success: false,
        message: 'Journalist profile not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { journalist },
    });
  } catch (error) {
    console.error('Get journalist profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching journalist profile',
    });
  }
};


//  GET Journalist by ID (Public)

export const getJournalist = async (req, res) => {
  try {
    const journalist = await Journalist.findById(req.params.id).populate(
      'user',
      'username email userType isVerified'
    );

    if (!journalist) {
      return res.status(404).json({
        success: false,
        message: 'Journalist not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { journalist },
    });
  } catch (error) {
    console.error('Get journalist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching journalist',
    });
  }
};


//  GET All Journalists (Public)

export const getAllJournalists = async (req, res) => {
  try {
    const journalists = await Journalist.find({ isActive: true })
      .populate('user', 'username email userType isVerified')
      .sort({ fullName: 1 });

    res.status(200).json({
      success: true,
      data: { journalists },
    });
  } catch (error) {
    console.error('Get journalists error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching journalists',
    });
  }
};


//  GET News Articles by Journalist (Public)

export const getJournalistNews = async (req, res) => {
  try {
    const news = await News.find({
      journalist: req.params.id,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .populate('journalist', 'fullName organization');

    res.status(200).json({
      success: true,
      data: { news },
    });
  } catch (error) {
    console.error('Get journalist news error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching journalist news',
    });
  }
};


//  VERIFY Journalist (Admin Only)

export const verifyJournalist = async (req, res) => {
  try {
    const journalist = await Journalist.findByIdAndUpdate(
      req.params.id,
      {
        isVerified: true,
        verifiedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!journalist) {
      return res.status(404).json({
        success: false,
        message: 'Journalist not found',
      });
    }

    // Update user as verified too
    await User.findByIdAndUpdate(journalist.user, { isVerified: true });

    res.status(200).json({
      success: true,
      message: 'Journalist verified successfully',
      data: { journalist },
    });
  } catch (error) {
    console.error('Verify journalist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying journalist',
    });
  }
};
