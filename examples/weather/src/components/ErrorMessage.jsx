import { h } from '@shane_il/pulse';

export function ErrorMessage({ message }) {
  return (
    <div className="error-card">
      <span className="error-icon">!</span>
      <p>{message}</p>
    </div>
  );
}
