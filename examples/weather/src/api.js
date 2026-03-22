/**
 * Open-Meteo API layer — free weather data, no API key needed.
 * These are plain async functions with no framework dependencies.
 */

const GEO_BASE = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * Search for cities by name using Open-Meteo's geocoding API.
 * Returns up to 5 results with coordinates.
 */
export async function searchCities(query) {
  const url = `${GEO_BASE}?name=${encodeURIComponent(query)}&count=5&language=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    name: r.name,
    country: r.country,
    admin1: r.admin1 || '',
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

/**
 * Fetch current weather + 5-day forecast for a lat/lon pair.
 * Normalizes the API response into clean JS objects.
 */
export async function fetchWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      'temperature_2m,wind_speed_10m,relative_humidity_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code',
    timezone: 'auto',
    forecast_days: '5',
  });
  const res = await fetch(`${WEATHER_BASE}?${params}`);
  if (!res.ok) throw new Error(`Weather API failed: ${res.status}`);
  const data = await res.json();
  return {
    current: {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      weatherCode: data.current.weather_code,
    },
    daily: data.daily.time.map((date, i) => ({
      date,
      maxTemp: data.daily.temperature_2m_max[i],
      minTemp: data.daily.temperature_2m_min[i],
      weatherCode: data.daily.weather_code[i],
    })),
    units: {
      temperature: data.current_units.temperature_2m,
      windSpeed: data.current_units.wind_speed_10m,
      humidity: data.current_units.relative_humidity_2m,
    },
  };
}
