
export function HorizonBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="horizon-glow" />
      <div className="horizon-line" />
      <div className="horizon-floor">
        <div className="horizon-grid" />
      </div>
    </div>
  );
}