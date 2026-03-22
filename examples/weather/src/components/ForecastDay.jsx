import { h } from '@shane_il/pulse';
import { getWeatherInfo } from '../weather-codes';

/**
 * Single forecast day card — a plain (non-connected) component.
 * Receives all data via props. Not everything needs connect().
 */
export function ForecastDay({ day, units }) {
  const weather = getWeatherInfo(day.weatherCode);
  const convert = (temp) =>
    units === 'fahrenheit' ? Math.round((temp * 9) / 5 + 32) : Math.round(temp);

  const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
  });

  return (
    <div className="forecast-day">
      <div className="forecast-day-name">{dayName}</div>
      <div className="forecast-day-icon">{weather.icon}</div>
      <div className="forecast-day-temps">
        <span className="temp-high">{convert(day.maxTemp)}°</span>
        <span className="temp-low">{convert(day.minTemp)}°</span>
      </div>
    </div>
  );
}
