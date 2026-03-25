import { connect } from '@shane_il/pulse';
import { weatherStore } from '../stores/weather';
import { prefsStore } from '../stores/preferences';
import { getWeatherInfo } from '../weather-codes';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';

/**
 * Current weather display — connected to BOTH stores.
 *
 * This is the key multi-store demo: the connect() bindings object maps
 * selectors from two different stores into a single component's props.
 * When either store updates, the component re-renders.
 */
function CurrentWeatherView({ current, city, units, loading, error, tempUnits }) {
  if (loading) {
    return <LoadingSpinner message="Fetching weather data..." />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (!current) {
    return (
      <div className="empty-state">
        <p>Search for a city to see the weather</p>
      </div>
    );
  }

  const weather = getWeatherInfo(current.weatherCode);
  const temp =
    tempUnits === 'fahrenheit'
      ? Math.round((current.temperature * 9) / 5 + 32)
      : Math.round(current.temperature);
  const unitLabel = tempUnits === 'fahrenheit' ? '°F' : '°C';

  return (
    <div className="current-weather">
      <div className="current-location">
        {city.name}, {city.country}
      </div>
      <div className="current-icon">{weather.icon}</div>
      <div className="current-temp">
        {temp}{unitLabel}
      </div>
      <div className="current-condition">{weather.label}</div>
      <div className="current-details">
        <span>Humidity: {current.humidity}{units.humidity}</span>
        <span>Wind: {current.windSpeed} {units.windSpeed}</span>
      </div>
    </div>
  );
}

// Connected to BOTH stores — weather data + temperature unit preference
export const CurrentWeather = connect({
  current: weatherStore.select((s) => s.current),
  city: weatherStore.select((s) => s.city),
  units: weatherStore.select((s) => s.units),
  loading: weatherStore.select((s) => s.loading),
  error: weatherStore.select((s) => s.error),
  tempUnits: prefsStore.select((s) => s.units),
})(CurrentWeatherView);
