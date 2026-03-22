import { h, connect } from '@shane_il/pulse';
import { weatherStore } from '../stores/weather';
import { prefsStore } from '../stores/preferences';
import { ForecastDay } from './ForecastDay';

function ForecastView({ daily, tempUnits }) {
  if (daily.length === 0) return null;

  return (
    <div className="forecast">
      <h2>5-Day Forecast</h2>
      <div className="forecast-grid">
        {daily.map((day) => (
          <ForecastDay key={day.date} day={day} units={tempUnits} />
        ))}
      </div>
    </div>
  );
}

// Connected to both stores for forecast data + unit preference
export const Forecast = connect({
  daily: weatherStore.select((s) => s.daily),
  tempUnits: prefsStore.select((s) => s.units),
})(ForecastView);
