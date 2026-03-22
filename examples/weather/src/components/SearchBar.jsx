import { h, connect } from '@shane_il/pulse';
import { weatherStore, searchForCities, selectCityAndFetch } from '../stores/weather';

// Module-scope debounce timer.
// Since Pulse re-calls the component function on each render (no hooks/refs),
// persistent state like timers must live at module scope.
let debounceTimer = null;

function SearchBarView({ searchResults, searchLoading, searchError }) {
  function handleInput(e) {
    const query = e.target.value.trim();
    if (query.length < 2) {
      weatherStore.dispatch('clearSearch');
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => searchForCities(query), 300);
  }

  function handleSelect(city) {
    selectCityAndFetch(city);
  }

  return (
    <div className="search-container">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search for a city..."
          onInput={handleInput}
        />
        {searchLoading && <span className="search-spinner">...</span>}
      </div>
      {searchError && <p className="search-error">{searchError}</p>}
      {searchResults.length > 0 && (
        <ul className="search-results">
          {searchResults.map((city) => (
            <li
              key={`${city.latitude}-${city.longitude}`}
              className="search-result-item"
              onClick={() => handleSelect(city)}
            >
              {city.name}
              {city.admin1 ? `, ${city.admin1}` : ''} — {city.country}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const SearchBar = connect({
  searchResults: weatherStore.select((s) => s.searchResults),
  searchLoading: weatherStore.select((s) => s.searchLoading),
  searchError: weatherStore.select((s) => s.searchError),
})(SearchBarView);
