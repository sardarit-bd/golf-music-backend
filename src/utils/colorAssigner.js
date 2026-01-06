import mongoose from "mongoose";

const CITY_COLORS = {
  'new orleans': [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
    "#F8C471", "#82E0AA", "#F1948A", "#A9DFBF", "#D7BDE2",
    "#F9E79F", "#AED6F1", "#E59866", "#ABEBC6", "#FAD7A0"
  ],
  'biloxi': [
    "#E74C3C", "#3498DB", "#2ECC71", "#F39C12", "#9B59B6",
    "#1ABC9C", "#D35400", "#C0392B", "#27AE60", "#8E44AD",
    "#16A085", "#E67E22", "#2980B9", "#D68910", "#A569BD",
    "#138D75", "#CA6F1E", "#7D3C98", "#117A65", "#B9770E"
  ],
  'mobile': [
    "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF",
    "#00FFFF", "#FFA500", "#800080", "#008000", "#800000",
    "#008080", "#000080", "#808000", "#808080", "#C0C0C0",
    "#FFD700", "#DA70D6", "#32CD32", "#FF4500", "#9400D3"
  ],
  'pensacola': [
    "#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD",
    "#8C564B", "#E377C2", "#7F7F7F", "#BCBD22", "#17BECF",
    "#393B79", "#637939", "#8C6D31", "#843C39", "#7B4173",
    "#5254A3", "#8CA252", "#BD9E39", "#AD494A", "#A55194"
  ]
};

export class ColorAssigner {
  static async getNextAvailableColor(city) {
    try {
      const Venue = mongoose.model('Venue');
      const usedColors = await Venue.find({ 
        city: city.toLowerCase(),
        colorCode: { $exists: true, $ne: null }
      }).distinct('colorCode');
      
      const availableColors = CITY_COLORS[city.toLowerCase()].filter(
        color => !usedColors.includes(color)
      );
      
      if (availableColors.length > 0) {
        return availableColors[0];
      }
      
      // If all colors are used, start recycling from beginning
      return CITY_COLORS[city.toLowerCase()][0];
    } catch (error) {
      console.error('Error getting next available color:', error);
      return CITY_COLORS[city.toLowerCase()][0];
    }
  }

  static async assignColorToVenue(venueId, city, specificColor = null) {
    try {
      const Venue = mongoose.model('Venue');
      
      if (specificColor) {
        // Check if color is available in the city
        const existingVenue = await Venue.findOne({
          city: city.toLowerCase(),
          colorCode: specificColor
        });
        
        if (existingVenue) {
          throw new Error(`Color ${specificColor} is already taken by another venue in ${city}`);
        }
        
        return specificColor;
      }
      
      return await this.getNextAvailableColor(city);
    } catch (error) {
      console.error('Error assigning color:', error);
      throw error;
    }
  }

  static async reassignColors(city) {
    try {
      const Venue = mongoose.model('Venue');
      const venues = await Venue.find({ 
        city: city.toLowerCase() 
      }).sort({ createdAt: 1 });
      
      const cityColors = CITY_COLORS[city.toLowerCase()];
      const assignedColors = new Set();
      
      for (let i = 0; i < venues.length; i++) {
        const venue = venues[i];
        const colorIndex = i % cityColors.length;
        const color = cityColors[colorIndex];
        
        // If color already assigned, find next available
        if (assignedColors.has(color)) {
          const availableColor = cityColors.find(c => !assignedColors.has(c));
          venue.colorCode = availableColor || color;
        } else {
          venue.colorCode = color;
        }
        
        assignedColors.add(venue.colorCode);
        await venue.save();
      }
      
      return true;
    } catch (error) {
      console.error('Error reassigning colors:', error);
      throw error;
    }
  }
}