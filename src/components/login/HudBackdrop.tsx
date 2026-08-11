/**
 * The slow targeting ring behind the sign-in panel — the instrument dressing
 * that sits between the WebGL backdrop and the form.
 *
 * ## Why CSS and not more WebGL
 * Three concentric rings turning at different rates is a job for two elements
 * and a transform. Putting them in the 3D scene would mean geometry, a
 * material and a draw call each, for something that never needs perspective.
 *
 * ## Purely decorative
 * `aria-hidden` and `pointer-events: none`: nothing here is content, and
 * nothing here may intercept a click meant for the form.
 *
 * The hexagon mesh that used to live here is gone — {@see ./LoginScene} now
 * renders a floor that genuinely recedes, which no CSS transform can fake.
 */
const HudBackdrop = () => (
    <div className="login-hud" aria-hidden="true">
      {/* ---- Targeting ring ---- */}
      <div className="login-hud-ring">
        {/* Layers, outermost first. Each turns at its own rate and direction:
            matched speeds would collapse the whole thing into one flat disc. */}
        <span className="login-hud-ring-outer" />
        <span className="login-hud-ring-dashes" />
        <span className="login-hud-ring-inner" />
        <span className="login-hud-ring-ticks" />
        {/* The sweep is what makes it read as *scanning* rather than merely
            spinning — a radar without a beam is just jewellery. */}
        <span className="login-hud-ring-sweep" />
        {/* Four nodes pinned to the cardinals, pulsing in sequence. */}
        <i className="login-hud-node login-hud-node--n" />
        <i className="login-hud-node login-hud-node--e" />
        <i className="login-hud-node login-hud-node--s" />
        <i className="login-hud-node login-hud-node--w" />
      </div>
    </div>
);

export default HudBackdrop;
