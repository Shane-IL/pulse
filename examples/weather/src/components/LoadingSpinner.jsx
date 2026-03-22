import { h } from '@shane_il/pulse';

export function LoadingSpinner({ message }) {
  return (
    <div className="loading">
      <div className="spinner"></div>
      <p>{message || 'Loading...'}</p>
    </div>
  );
}
