import "./OrbitalBackdrop.css";

export default function OrbitalBackdrop() {
  return (
    <div className="vera-orbital-backdrop" aria-hidden="true">
      <div className="vera-orbital-cluster vera-orbital-cluster--left">
        <span className="vera-orbital-ring vera-orbital-ring--a" />
        <span className="vera-orbital-ring vera-orbital-ring--b" />
        <span className="vera-orbital-ring vera-orbital-ring--c" />
        <span className="vera-orbital-core" />
      </div>
      <div className="vera-orbital-cluster vera-orbital-cluster--right">
        <span className="vera-orbital-ring vera-orbital-ring--a" />
        <span className="vera-orbital-ring vera-orbital-ring--b" />
        <span className="vera-orbital-ring vera-orbital-ring--c" />
        <span className="vera-orbital-core" />
      </div>
    </div>
  );
}
