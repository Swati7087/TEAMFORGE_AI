import { useEffect, useRef } from "react";
import "./InteractiveCube.css";

// The 6 faces of the cube. Order matters — this maps directly to the
// physics-based side detection ported from the original demo.
const DEFAULT_LABELS = ["AI", "TASK", "TEAM", "GIT", "PLAN", "FORGE"];

/**
 * A draggable 3D cube. Grab it with mouse / touch and it spins with
 * momentum + inertia. The face currently facing the camera lights up.
 *
 * Ported (and modernised) from the classic vanilla-JS "6-sided cube" demo.
 */
export default function InteractiveCube({
  labels = DEFAULT_LABELS,
  className = "",
}) {
  const rootRef = useRef(null);
  const cubeRef = useRef(null);
  const faceRefs = useRef([]);

  useEffect(() => {
    const root = rootRef.current;
    const cube = cubeRef.current;
    if (!root || !cube) return;

    // Physics / interaction state kept in a plain object so the
    // animation loop mutates it in place without re-rendering React.
    const s = {
      lastX: 0,
      lastY: 0,
      mouseX: 0,
      mouseY: 0,
      distanceX: 0,
      distanceY: 0,
      positionX: 1122,
      positionY: 136,
      torqueX: 0,
      torqueY: 0,
      down: false,
      upsideDown: false,
      prevX: 0,
      prevY: 0,
      currentSide: 0,
      calculatedSide: 0,
    };

    const cfg = {
      fps: 20, // interval in ms → ~50fps
      sensivity: 0.1,
      sensivityFade: 0.93,
      speed: 2, // torque multiplier when actively dragging
      ambientSpeed: 1.5, // gentler multiplier for hover-free mouse tracking
      touchSensivity: 1.5,
    };

    // --- Handlers ----------------------------------------------------------
    // mousedown is scoped to the cube so dragging on the rest of the page
    // (buttons, links, hero text) doesn't accidentally start a rotation.
    const onDown = () => {
      s.down = true;
    };
    const onUp = () => {
      s.down = false;
    };
    const onMove = (e) => {
      s.mouseX = e.pageX;
      s.mouseY = e.pageY;
    };
    const onTouchStart = (e) => {
      s.down = true;
      const t = e.touches[0];
      s.mouseX = t.pageX / cfg.touchSensivity;
      s.mouseY = t.pageY / cfg.touchSensivity;
      s.lastX = s.mouseX;
      s.lastY = s.mouseY;
    };
    const onTouchMove = (e) => {
      // Only hijack the touch when the user actually started a drag on
      // the cube — otherwise page scrolling stays intact.
      if (!s.down) return;
      if (e.cancelable) e.preventDefault();
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      s.mouseX = t.pageX / cfg.touchSensivity;
      s.mouseY = t.pageY / cfg.touchSensivity;
    };
    const onTouchEnd = () => {
      s.down = false;
    };

    root.addEventListener("mousedown", onDown);
    root.addEventListener("touchstart", onTouchStart, { passive: false });
    document.addEventListener("mouseup", onUp);
    document.addEventListener("keyup", onUp);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);

    // --- Side visual sync --------------------------------------------------
    const applySideChange = () => {
      faceRefs.current.forEach((el) => el && el.classList.remove("active"));
      const active = faceRefs.current[s.currentSide - 1];
      if (active) active.classList.add("active");
    };

    // Faces 0 and 5 rotate in-plane so their labels stay upright as the
    // cube spins horizontally. Faces 1-4 flip when the cube goes upside
    // down. This preserves text readability from every angle.
    const applyInPlaneRotation = () => {
      const face0 = faceRefs.current[0];
      const face5 = faceRefs.current[5];
      const flipped = s.positionY > 90 && s.positionY < 270;
      const angle0 = flipped
        ? s.positionX + s.torqueX
        : s.positionX - s.torqueX;
      const angle5 = flipped
        ? s.positionX + 180 + s.torqueX
        : s.positionX + 180 - s.torqueX;
      if (face0) face0.style.transform = `rotate(${angle0}deg)`;
      if (face5) face5.style.transform = `rotate(${-angle5}deg)`;
    };

    const applyUpsideDown = (upsideDown) => {
      const deg = upsideDown ? "180deg" : "0deg";
      for (let i = 1; i < 5; i++) {
        const face = faceRefs.current[i];
        if (face) face.style.transform = `rotate(${deg})`;
      }
    };

    // --- Animation loop ----------------------------------------------------
    const animate = () => {
      s.distanceX = s.mouseX - s.lastX;
      s.distanceY = s.mouseY - s.lastY;
      s.lastX = s.mouseX;
      s.lastY = s.mouseY;

      // Torque builds from any mouse motion on the page. Dragging uses the
      // full `speed` multiplier; anything else uses the softer `ambientSpeed`
      // so the cube just drifts in response to nearby cursor movement.
      const activeSpeed = s.down ? cfg.speed : cfg.ambientSpeed;
      s.torqueX =
        s.torqueX * cfg.sensivityFade +
        (s.distanceX * activeSpeed - s.torqueX) * cfg.sensivity;
      s.torqueY =
        s.torqueY * cfg.sensivityFade +
        (s.distanceY * activeSpeed - s.torqueY) * cfg.sensivity;

      if (Math.abs(s.torqueX) > 1.0 || Math.abs(s.torqueY) > 1.0) {
        if (!s.down) {
          s.torqueX *= cfg.sensivityFade;
          s.torqueY *= cfg.sensivityFade;
        }

        s.positionY -= s.torqueY;
        if (s.positionY > 360) s.positionY -= 360;
        else if (s.positionY < 0) s.positionY += 360;

        if (s.positionY > 90 && s.positionY < 270) {
          s.positionX -= s.torqueX;
          if (!s.upsideDown) {
            s.upsideDown = true;
            applyUpsideDown(true);
          }
        } else {
          s.positionX += s.torqueX;
          if (s.upsideDown) {
            s.upsideDown = false;
            applyUpsideDown(false);
          }
        }

        if (s.positionX > 360) s.positionX -= 360;
        else if (s.positionX < 0) s.positionX += 360;

        // Figure out which face is currently pointed at the camera.
        // The magic ranges below come from the original demo — they map
        // the (X, Y) rotation state to whichever cube face is dominant.
        const inTopBottom =
          (s.positionY >= 46 && s.positionY <= 130) ||
          (s.positionY >= 220 && s.positionY <= 308);

        if (!inTopBottom) {
          if (s.upsideDown) {
            if (s.positionX >= 42 && s.positionX <= 130) s.calculatedSide = 3;
            else if (s.positionX >= 131 && s.positionX <= 223) s.calculatedSide = 2;
            else if (s.positionX >= 224 && s.positionX <= 314) s.calculatedSide = 5;
            else s.calculatedSide = 4;
          } else {
            if (s.positionX >= 42 && s.positionX <= 130) s.calculatedSide = 5;
            else if (s.positionX >= 131 && s.positionX <= 223) s.calculatedSide = 4;
            else if (s.positionX >= 224 && s.positionX <= 314) s.calculatedSide = 3;
            else s.calculatedSide = 2;
          }
        } else {
          if (s.positionY >= 46 && s.positionY <= 130) s.calculatedSide = 6;
          if (s.positionY >= 220 && s.positionY <= 308) s.calculatedSide = 1;
        }

        if (s.calculatedSide !== s.currentSide) {
          s.currentSide = s.calculatedSide;
          applySideChange();
        }
      }

      cube.style.transform = `rotateX(${s.positionY}deg) rotateY(${s.positionX}deg)`;

      if (s.positionY !== s.prevY || s.positionX !== s.prevX) {
        s.prevY = s.positionY;
        s.prevX = s.positionX;
        applyInPlaneRotation();
      }
    };

    const intervalId = setInterval(animate, cfg.fps);

    return () => {
      clearInterval(intervalId);
      root.removeEventListener("mousedown", onDown);
      root.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("keyup", onUp);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div ref={rootRef} className={`ic-root ${className}`}>
      <div className="ic-viewport">
        <div ref={cubeRef} className="ic-cube">
          {labels.map((label, i) => (
            <div key={i} className="ic-side">
              <div
                ref={(el) => (faceRefs.current[i] = el)}
                className={`ic-face${i === 5 ? " active" : ""}`}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
