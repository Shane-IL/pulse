export function ErrorMessage({ message }) {
  return (
    <div className="error-card">
      <span className="error-icon">!</span>
      <p>{message}</p>
    </div>
  );
}
