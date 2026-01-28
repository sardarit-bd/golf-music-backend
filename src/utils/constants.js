// utils/constants.js
export const STATE_CITY_MAPPING = {
  'Louisiana': [
    'new orleans', 'baton rouge', 'lafayette', 'shreveport', 
    'lake charles', 'monroe'
  ],
  'Mississippi': [
    'jackson', 'biloxi', 'gulfport', 'oxford', 'hattiesburg'
  ],
  'Alabama': [
    'birmingham', 'mobile', 'huntsville', 'tuscaloosa'
  ],
  'Florida': [
    'tampa', 'st. petersburg', 'clearwater', 'pensacola', 
    'panama city', 'fort myers'
  ]
};

export const DEFAULT_STATE = 'Alabama';
export const DEFAULT_CITY = 'mobile';

export const ALL_STATES = Object.keys(STATE_CITY_MAPPING);

export const getCitiesByState = (state) => {
  return STATE_CITY_MAPPING[state] || [];
};

export const isValidStateCity = (state, city) => {
  const cities = STATE_CITY_MAPPING[state];
  return cities && cities.includes(city.toLowerCase());
};

export const formatCityName = (city) => {
  if (!city) return "Unknown";
  return city
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};