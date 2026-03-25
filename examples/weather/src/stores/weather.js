/**
 * Weather data store — the centerpiece of this example.
 *
 * Demonstrates:
 * - instrumentStore: registers with devtools + auto-adds actionHistory middleware
 * - logger() middleware: logs every dispatch to the console
 * - createAsyncAction: wires start/ok/fail dispatches around async API calls
 * - Loading/error state management
 */
import { createAsyncAction, logger } from '@shane_il/pulse';
import { devtools, instrumentStore } from '@shane_il/pulse/devtools';
import { searchCities, fetchWeather } from '../api';

const { store: weatherStore } = instrumentStore(devtools, {
  name: 'weather',
  state: {
    // Current location
    city: null,

    // Search state
    searchResults: [],
    searchLoading: false,
    searchError: null,

    // Weather data
    current: null,
    daily: [],
    units: null,
    loading: false,
    error: null,
  },
  actions: {
    // Search actions (dispatched by searchForCities async action)
    searchStart: () => ({ searchLoading: true, searchError: null }),
    searchOk: (s, results) => ({ searchLoading: false, searchResults: results }),
    searchFail: (s, error) => ({ searchLoading: false, searchError: error }),
    clearSearch: () => ({ searchResults: [], searchError: null }),

    // Weather fetch actions (dispatched by loadWeather async action)
    fetchStart: () => ({ loading: true, error: null }),
    fetchOk: (s, data) => ({
      loading: false,
      current: data.current,
      daily: data.daily,
      units: data.units,
    }),
    fetchFail: (s, error) => ({ loading: false, error }),

    // Select a city (synchronous — clears search dropdown)
    selectCity: (s, city) => ({ city, searchResults: [] }),
  },

  // logger() middleware logs every dispatch to the browser console.
  // instrumentStore automatically adds actionHistory() on top of this.
  middleware: [logger()],
});

// --- Async actions ---
// createAsyncAction wires start/ok/fail dispatches around a Promise.
// Open the console to see logger() output for each dispatch.

const searchForCities = createAsyncAction(weatherStore, {
  start: 'searchStart',
  run: (query) => searchCities(query),
  ok: 'searchOk',
  fail: 'searchFail',
});

const loadWeather = createAsyncAction(weatherStore, {
  start: 'fetchStart',
  run: (lat, lon) => fetchWeather(lat, lon),
  ok: 'fetchOk',
  fail: 'fetchFail',
});

/**
 * High-level action: select a city and fetch its weather.
 * Composes a synchronous dispatch with an async action.
 */
async function selectCityAndFetch(city) {
  weatherStore.dispatch('selectCity', city);
  await loadWeather(city.latitude, city.longitude);
}

export { weatherStore, searchForCities, selectCityAndFetch };
