import { h } from '@shane_il/pulse';
import { SearchBar } from './SearchBar';
import { CurrentWeather } from './CurrentWeather';
import { Forecast } from './Forecast';
import { UnitToggle } from './UnitToggle';

export function App() {
  return (
    <div>
      <header className="header">
        <h1>Pulse Weather</h1>
        <UnitToggle />
      </header>
      <SearchBar />
      <CurrentWeather />
      <Forecast />
    </div>
  );
}
