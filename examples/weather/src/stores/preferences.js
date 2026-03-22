/**
 * UI preferences store — a second, independent store.
 *
 * Demonstrates:
 * - Multiple stores: this exists alongside the weather store
 * - Both stores appear in the devtools panel
 * - Components can connect to multiple stores at once (see CurrentWeather)
 */
import { devtools, instrumentStore } from '@shane_il/pulse/devtools';

const { store: prefsStore } = instrumentStore(devtools, {
  name: 'preferences',
  state: {
    units: 'celsius', // 'celsius' | 'fahrenheit'
  },
  actions: {
    toggleUnits: (state) => ({
      ...state,
      units: state.units === 'celsius' ? 'fahrenheit' : 'celsius',
    }),
  },
});

export { prefsStore };
