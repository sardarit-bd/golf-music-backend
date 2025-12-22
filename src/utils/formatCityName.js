export const formatCityName = (city) => {
  if (!city) return "Unknown";
  return city
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
