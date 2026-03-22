/**
 * WMO Weather interpretation codes → human-readable labels + emoji.
 * See: https://open-meteo.com/en/docs#weathervariables
 */
const WEATHER_CODES = {
  0: { label: 'Clear sky', icon: '\u2600\uFE0F' },
  1: { label: 'Mainly clear', icon: '\uD83C\uDF24\uFE0F' },
  2: { label: 'Partly cloudy', icon: '\u26C5' },
  3: { label: 'Overcast', icon: '\u2601\uFE0F' },
  45: { label: 'Fog', icon: '\uD83C\uDF2B\uFE0F' },
  48: { label: 'Rime fog', icon: '\uD83C\uDF2B\uFE0F' },
  51: { label: 'Light drizzle', icon: '\uD83C\uDF26\uFE0F' },
  53: { label: 'Moderate drizzle', icon: '\uD83C\uDF26\uFE0F' },
  55: { label: 'Dense drizzle', icon: '\uD83C\uDF27\uFE0F' },
  61: { label: 'Slight rain', icon: '\uD83C\uDF27\uFE0F' },
  63: { label: 'Moderate rain', icon: '\uD83C\uDF27\uFE0F' },
  65: { label: 'Heavy rain', icon: '\uD83C\uDF27\uFE0F' },
  71: { label: 'Slight snow', icon: '\uD83C\uDF28\uFE0F' },
  73: { label: 'Moderate snow', icon: '\uD83C\uDF28\uFE0F' },
  75: { label: 'Heavy snow', icon: '\u2744\uFE0F' },
  77: { label: 'Snow grains', icon: '\u2744\uFE0F' },
  80: { label: 'Slight showers', icon: '\uD83C\uDF26\uFE0F' },
  81: { label: 'Moderate showers', icon: '\uD83C\uDF27\uFE0F' },
  82: { label: 'Violent showers', icon: '\uD83C\uDF27\uFE0F' },
  85: { label: 'Slight snow showers', icon: '\uD83C\uDF28\uFE0F' },
  86: { label: 'Heavy snow showers', icon: '\u2744\uFE0F' },
  95: { label: 'Thunderstorm', icon: '\u26C8\uFE0F' },
  96: { label: 'Thunderstorm with hail', icon: '\u26C8\uFE0F' },
  99: { label: 'Thunderstorm with heavy hail', icon: '\u26C8\uFE0F' },
};

export function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { label: 'Unknown', icon: '\u2753' };
}
