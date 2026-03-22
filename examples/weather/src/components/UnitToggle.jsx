import { h, connect } from '@shane_il/pulse';
import { prefsStore } from '../stores/preferences';

function UnitToggleView({ units }) {
  return (
    <button
      className="unit-toggle"
      onClick={() => prefsStore.dispatch('toggleUnits')}
    >
      {units === 'celsius' ? '°C → °F' : '°F → °C'}
    </button>
  );
}

export const UnitToggle = connect({
  units: prefsStore.select((s) => s.units),
})(UnitToggleView);
