import Artist from "../models/model.artist.js";
import News from "../models/model.news.js";
import User from "../models/model.user.js";
import Venue from "../models/model.venue.js";
import Contact from "../models/models.contact.js";
import Event from "../models/models.event.js";

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalArtists,
      totalVenues,
      totalNews,
      totalEvents,
      pendingContacts,
      recentUsers,
      recentEvents
    ] = await Promise.all([
      User.countDocuments(),
      Artist.countDocuments({ isActive: true }),
      Venue.countDocuments({ isActive: true }),
      News.countDocuments({ isActive: true }),
      Event.countDocuments({ isActive: true }),
      Contact.countDocuments({ isRead: false }),
      User.find().sort({ createdAt: -1 }).limit(5),
      Event.find({ isActive: true })
        .populate('venue', 'venueName city')
        .sort({ date: 1 })
        .limit(5)
    ]);

    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$userType',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalArtists,
          totalVenues,
          totalNews,
          totalEvents,
          pendingContacts
        },
        userStats,
        recentUsers,
        upcomingEvents: recentEvents
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard statistics'
    });
  }
};

// @desc    Get all users with filtering
// @route   GET /api/admin/users
// @access  Private (Admin only)
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, userType, search, verified } = req.query;
    
    let query = {};
    
    if (userType && userType !== 'all') {
      query.userType = userType;
    }
    
    if (verified !== undefined) {
      query.isVerified = verified === 'true';
    }
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
};

// @desc    Verify user
// @route   PUT /api/admin/users/:id/verify
// @access  Private (Admin only)
export const verifyUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        isVerified: true,
        verificationRequested: false
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User verified successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying user'
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    
    if (user.userType === 'artist') {
      await Artist.findOneAndUpdate(
        { user: req.params.id },
        { isActive: false }
      );
    } else if (user.userType === 'venue') {
      await Venue.findOneAndUpdate(
        { user: req.params.id },
        { isActive: false }
      );
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user'
    });
  }
};

// @desc    Get all content for moderation
// @route   GET /api/admin/content
// @access  Private (Admin only)
export const getContentForModeration = async (req, res) => {
  try {
    const { type, page = 1, limit = 10 } = req.query;
    
    let model, populateField;
    
    switch (type) {
      case 'artists':
        model = Artist;
        populateField = { path: 'user', select: 'username email' };
        break;
      case 'venues':
        model = Venue;
        populateField = { path: 'user', select: 'username email' };
        break;
      case 'news':
        model = News;
        populateField = { path: 'journalist', select: 'username email' };
        break;
      case 'events':
        model = Event;
        populateField = { path: 'venue', select: 'venueName city' };
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid content type'
        });
    }

    const content = await model.find({ isActive: true })
      .populate(populateField)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await model.countDocuments({ isActive: true });

    res.json({
      success: true,
      data: {
        content,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching content'
    });
  }
};

// @desc    Toggle content status
// @route   PUT /api/admin/content/:type/:id/toggle
// @access  Private (Admin only)
export const toggleContentStatus = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { isActive } = req.body;
    
    let model;
    
    switch (type) {
      case 'artist':
        model = Artist;
        break;
      case 'venue':
        model = Venue;
        break;
      case 'news':
        model = News;
        break;
      case 'event':
        model = Event;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid content type'
        });
    }

    const content = await model.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    );

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      message: `Content ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { content }
    });

  } catch (error) {
    console.error('Toggle content error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while toggling content status'
    });
  }
};

// @desc    Get all contact messages
// @route   GET /api/admin/contacts
// @access  Private (Admin only)
export const getContactMessages = async (req, res) => {
  try {
    const { page = 1, limit = 10, read } = req.query;
    
    let query = {};
    
    if (read !== undefined) {
      query.isRead = read === 'true';
    }

    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Contact.countDocuments(query);
    const unreadCount = await Contact.countDocuments({ isRead: false });

    res.json({
      success: true,
      data: {
        contacts,
        unreadCount,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching contact messages'
    });
  }
};

// @desc    Mark contact as read
// @route   PUT /api/admin/contacts/:id/read
// @access  Private (Admin only)
export const markContactAsRead = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact marked as read',
      data: { contact }
    });

  } catch (error) {
    console.error('Mark contact read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking contact as read'
    });
  }
};

// @desc    Delete contact message
// @route   DELETE /api/admin/contacts/:id
// @access  Private (Admin only)
export const deleteContactMessage = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact message deleted successfully'
    });

  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting contact message'
    });
  }
};

// @desc    System settings
// @route   GET /api/admin/settings
// @access  Private (Admin only)
export const getSystemSettings = async (req, res) => {
  try {
    const settings = {
      siteName: 'Gulf Coast Music',
      siteDescription: 'Your premier platform for Gulf Coast music scene',
      maintenanceMode: false,
      allowRegistrations: true,
      maxFileSize: 10,
      allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'audio/mpeg'],
      emailNotifications: true
    };

    res.json({
      success: true,
      data: { settings }
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching system settings'
    });
  }
};
