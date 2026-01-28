import mongoose from "mongoose";
import { STATE_CITY_MAPPING } from "./constants.js";


// Extended color palettes for ALL cities
const CITY_COLORS = {
  // Existing cities (keep your original colors)
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
  ],
  
  // NEW: Colors for additional Louisiana cities
  'baton rouge': [
    "#FF5733", "#33FF57", "#3357FF", "#F3FF33", "#FF33F3",
    "#33FFF3", "#FF8333", "#8F33FF", "#33FF8F", "#FF3383",
    "#8333FF", "#33FFB8", "#B833FF", "#33D4FF", "#FFD433",
    "#33FF6E", "#6E33FF", "#33FFA8", "#A833FF", "#FF3333"
  ],
  'lafayette': [
    "#6A0572", "#AB83A1", "#3B8BEB", "#FF6F61", "#1EA896",
    "#FFD166", "#EF476F", "#06D6A0", "#118AB2", "#073B4C",
    "#7209B7", "#F15BB5", "#00BBF9", "#00F5D4", "#FF9E00",
    "#8338EC", "#3A86FF", "#FB5607", "#FF006E", "#FFBE0B"
  ],
  'shreveport': [
    "#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51",
    "#9B5DE5", "#F15BB5", "#FEE440", "#00BBF9", "#00F5D4",
    "#FF6D00", "#FF9E00", "#7B2CBF", "#3C096C", "#9D4EDD",
    "#C77DFF", "#FF9E00", "#FF6D00", "#FF0054", "#00A8CC"
  ],
  'lake charles': [
    "#0077B6", "#00B4D8", "#90E0EF", "#CAF0F8", "#03045E",
    "#023E8A", "#0096C7", "#48CAE4", "#ADE8F4", "#0077B6",
    "#00509D", "#003F88", "#00296B", "#003049", "#669BBC",
    "#F4D35E", "#EE964B", "#F95738", "#0D3B66", "#F4D35E"
  ],
  'monroe': [
    "#5F0F40", "#9A031E", "#FB8B24", "#E36414", "#0F4C5C",
    "#5D5F71", "#6B9080", "#A4C3B2", "#CCE3DE", "#F6FFF8",
    "#AFCBFF", "#FFEBB7", "#FFB5C2", "#B0C4B1", "#FAD4D8",
    "#D4A5A5", "#9C89B8", "#F0A6CA", "#B8BEDD", "#EFC3E6"
  ],
  
  // NEW: Colors for additional Mississippi cities
  'jackson': [
    "#012A4A", "#013A63", "#01497C", "#014F86", "#2A6F97",
    "#2C7DA0", "#468FAF", "#61A5C2", "#89C2D9", "#A9D6E5",
    "#BB3E03", "#CA6702", "#EE9B00", "#E9D8A6", "#94D2BD",
    "#0A9396", "#005F73", "#94D2BD", "#E9D8A6", "#EE9B00"
  ],
  'gulfport': [
    "#3D5A80", "#98C1D9", "#E0FBFC", "#EE6C4D", "#293241",
    "#3D5A80", "#98C1D9", "#E0FBFC", "#EE6C4D", "#3D5A80",
    "#577590", "#4D908E", "#43AA8B", "#90BE6D", "#F9C74F",
    "#F9844A", "#F8961E", "#F3722C", "#F94144", "#577590"
  ],
  'oxford': [
    "#132A13", "#31572C", "#4F772D", "#90A955", "#ECF39E",
    "#1B4332", "#2D6A4F", "#40916C", "#52B788", "#74C69D",
    "#99582A", "#BB9457", "#E6CCB2", "#EDE0D4", "#7F5539",
    "#9C6644", "#B08968", "#DDB892", "#E6CCB2", "#EDE0D4"
  ],
  'hattiesburg': [
    "#7400B8", "#6930C3", "#5E60CE", "#5390D9", "#4EA8DE",
    "#48BFE3", "#56CFE1", "#64DFDF", "#72EFDD", "#80FFDB",
    "#FF6B6B", "#FF8E72", "#FFAA7A", "#FFC49B", "#FFE0B5",
    "#D8BFAA", "#BC8DA0", "#A06B9A", "#845A94", "#68498E"
  ],
  
  // NEW: Colors for additional Alabama cities
  'birmingham': [
    "#9B2226", "#AE2012", "#BB3E03", "#CA6702", "#EE9B00",
    "#E9D8A6", "#94D2BD", "#0A9396", "#005F73", "#001219",
    "#005F73", "#0A9396", "#94D2BD", "#E9D8A6", "#EE9B00",
    "#CA6702", "#BB3E03", "#AE2012", "#9B2226", "#6A040F"
  ],
  'huntsville': [
    "#FF9F1C", "#FFBF69", "#FFFFFF", "#CBF3F0", "#2EC4B6",
    "#011627", "#FF9F1C", "#2EC4B6", "#E71D36", "#FF9F1C",
    "#2EC4B6", "#E71D36", "#011627", "#FD9F1C", "#2EC4B6",
    "#E71D36", "#011627", "#FF9F1C", "#2EC4B6", "#E71D36"
  ],
  'tuscaloosa': [
    "#606C38", "#283618", "#FEFAE0", "#DDA15E", "#BC6C25",
    "#582F0E", "#7F4F24", "#936639", "#A68A64", "#B6AD90",
    "#656D4A", "#414833", "#333D29", "#582F0E", "#7F4F24",
    "#936639", "#A68A64", "#B6AD90", "#C2C5AA", "#A4AC86"
  ],
  
  // NEW: Colors for additional Florida cities
  'tampa': [
    "#03045E", "#023E8A", "#0077B6", "#0096C7", "#00B4D8",
    "#48CAE4", "#90E0EF", "#ADE8F4", "#CAF0F8", "#F8F9FA",
    "#FF5400", "#FF6D00", "#FF8500", "#FF9E00", "#FFB700",
    "#FFD000", "#FFEA00", "#FFF700", "#FF9E00", "#FF6D00"
  ],
  'st. petersburg': [
    "#7209B7", "#560BAD", "#480CA8", "#3A0CA3", "#3F37C9",
    "#4361EE", "#4895EF", "#4CC9F0", "#F72585", "#B5179E",
    "#7209B7", "#560BAD", "#480CA8", "#3A0CA3", "#3F37C9",
    "#4361EE", "#4895EF", "#4CC9F0", "#F72585", "#B5179E"
  ],
  'clearwater': [
    "#0077B6", "#00B4D8", "#90E0EF", "#CAF0F8", "#03045E",
    "#4CC9F0", "#4895EF", "#4361EE", "#3F37C9", "#3A0CA3",
    "#480CA8", "#560BAD", "#7209B7", "#B5179E", "#F72585",
    "#FF6D00", "#FF9E00", "#FFB700", "#FFD000", "#FFEA00"
  ],
  'panama city': [
    "#0FA3B1", "#B5E2FA", "#F9F7F3", "#EDDEA4", "#F7A072",
    "#FF9B54", "#FF7F51", "#CE4257", "#720026", "#4F000B",
    "#0FA3B1", "#B5E2FA", "#F9F7F3", "#EDDEA4", "#F7A072",
    "#FF9B54", "#FF7F51", "#CE4257", "#720026", "#4F000B"
  ],
  'fort myers': [
    "#FF9F1C", "#FFBF69", "#FFFFFF", "#CBF3F0", "#2EC4B6",
    "#E63946", "#F1FAEE", "#A8DADC", "#457B9D", "#1D3557",
    "#FF9F1C", "#FFBF69", "#FFFFFF", "#CBF3F0", "#2EC4B6",
    "#E63946", "#F1FAEE", "#A8DADC", "#457B9D", "#1D3557"
  ]
};

// Default colors for any city not in the list
const DEFAULT_COLORS = [
  "#FF6B6B", "#4ECDC4", "#FFD166", "#06D6A0", "#118AB2",
  "#073B4C", "#EF476F", "#7209B7", "#FF9E00", "#8338EC",
  "#3A86FF", "#FB5607", "#FF006E", "#8338EC", "#3A86FF",
  "#06D6A0", "#FFD166", "#EF476F", "#118AB2", "#7209B7"
];

export class ColorAssigner {
  
  // Get all valid states
  static getStates() {
    return Object.keys(STATE_CITY_MAPPING);
  }
  
  // Get cities for a specific state
  static getCitiesByState(state) {
    return STATE_CITY_MAPPING[state] || [];
  }
  
  // Get color palette for a city
  static getCityColors(city) {
    const cityKey = city.toLowerCase();
    return CITY_COLORS[cityKey] || DEFAULT_COLORS;
  }
  
  // Validate if a city belongs to a state
  static isValidCityForState(state, city) {
    const stateCities = STATE_CITY_MAPPING[state] || [];
    return stateCities.includes(city.toLowerCase());
  }
  
  // Get next available color for a venue in a city
  static async getNextAvailableColor(city, state = null) {
    try {
      const Venue = mongoose.model('Venue');
      
      // Build query
      const query = { 
        city: city.toLowerCase(),
        colorCode: { $exists: true, $ne: null }
      };
      
      // Add state filter if provided
      if (state) {
        query.state = state;
      }
      
      const usedColors = await Venue.find(query).distinct('colorCode');
      
      const cityColors = this.getCityColors(city);
      const availableColors = cityColors.filter(
        color => !usedColors.includes(color)
      );
      
      if (availableColors.length > 0) {
        return availableColors[0];
      }
      
      // If all colors are used, start recycling from beginning
      return cityColors[0];
      
    } catch (error) {
      console.error('Error getting next available color:', error);
      return this.getCityColors(city)[0];
    }
  }

  // Assign color to venue (with state support)
  static async assignColorToVenue(venueId, city, state = null, specificColor = null) {
    try {
      const Venue = mongoose.model('Venue');
      
      if (specificColor) {
        // Validate color is in city's palette
        const cityColors = this.getCityColors(city);
        if (!cityColors.includes(specificColor)) {
          throw new Error(`Color ${specificColor} is not in ${city}'s color palette`);
        }
        
        // Check if color is available
        const query = {
          city: city.toLowerCase(),
          colorCode: specificColor,
          _id: { $ne: venueId }
        };
        
        if (state) {
          query.state = state;
        }
        
        const existingVenue = await Venue.findOne(query);
        
        if (existingVenue) {
          throw new Error(`Color ${specificColor} is already taken by ${existingVenue.venueName} in ${city}`);
        }
        
        return specificColor;
      }
      
      return await this.getNextAvailableColor(city, state);
      
    } catch (error) {
      console.error('Error assigning color:', error);
      throw error;
    }
  }

  // Reassign colors for all venues in a city (with state support)
  static async reassignColors(city, state = null) {
    try {
      const Venue = mongoose.model('Venue');
      
      // Build query
      const query = { 
        city: city.toLowerCase(),
        isActive: true 
      };
      
      if (state) {
        query.state = state;
      }
      
      const venues = await Venue.find(query).sort({ createdAt: 1 });
      const cityColors = this.getCityColors(city);
      const assignedColors = new Set();
      
      const results = [];
      
      for (let i = 0; i < venues.length; i++) {
        const venue = venues[i];
        const colorIndex = i % cityColors.length;
        const color = cityColors[colorIndex];
        
        let assignedColor = color;
        
        // If color already assigned, find next available
        if (assignedColors.has(color)) {
          const availableColor = cityColors.find(c => !assignedColors.has(c));
          assignedColor = availableColor || color;
        }
        
        const oldColor = venue.colorCode;
        venue.colorCode = assignedColor;
        await venue.save();
        
        assignedColors.add(assignedColor);
        
        // Update all events for this venue
        const Event = mongoose.model('Event');
        await Event.updateMany(
          { venue: venue._id },
          { $set: { color: assignedColor } }
        );
        
        results.push({
          venueId: venue._id,
          venueName: venue.venueName,
          oldColor,
          newColor: assignedColor,
          eventsUpdated: await Event.countDocuments({ venue: venue._id })
        });
      }
      
      return {
        success: true,
        message: `Reassigned colors for ${venues.length} venues in ${city}${state ? `, ${state}` : ''}`,
        results
      };
      
    } catch (error) {
      console.error('Error reassigning colors:', error);
      throw error;
    }
  }
  
  // Reassign colors for all venues in a state
  static async reassignStateColors(state) {
    try {
      const cities = this.getCitiesByState(state);
      const allResults = [];
      
      for (const city of cities) {
        const result = await this.reassignColors(city, state);
        allResults.push({
          city,
          ...result
        });
      }
      
      return {
        success: true,
        message: `Reassigned colors for all cities in ${state}`,
        cities: allResults
      };
      
    } catch (error) {
      console.error('Error reassigning state colors:', error);
      throw error;
    }
  }
  
  // Get color statistics for a city
  static async getColorStats(city, state = null) {
    try {
      const Venue = mongoose.model('Venue');
      
      const query = { city: city.toLowerCase() };
      if (state) {
        query.state = state;
      }
      
      const totalVenues = await Venue.countDocuments(query);
      const venuesWithColor = await Venue.countDocuments({
        ...query,
        colorCode: { $exists: true, $ne: null }
      });
      
      const cityColors = this.getCityColors(city);
      const usedColors = await Venue.find({
        ...query,
        colorCode: { $exists: true, $ne: null }
      }).distinct('colorCode');
      
      const availableColors = cityColors.filter(
        color => !usedColors.includes(color)
      );
      
      return {
        city,
        state,
        totalVenues,
        venuesWithColor,
        venuesWithoutColor: totalVenues - venuesWithColor,
        totalColors: cityColors.length,
        usedColors: usedColors.length,
        availableColors: availableColors.length,
        colorCoveragePercentage: totalVenues > 0 
          ? Math.round((venuesWithColor / totalVenues) * 100) 
          : 0,
        availableColorsList: availableColors,
        usedColorsList: usedColors
      };
      
    } catch (error) {
      console.error('Error getting color stats:', error);
      throw error;
    }
  }
}