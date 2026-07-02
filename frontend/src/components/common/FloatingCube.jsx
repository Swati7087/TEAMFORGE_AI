// A wireframe 3D cube built from 6 face divs with CSS transforms.
// Nested wrappers so translateY (float) and rotate (spin) don't fight over `transform`.

function spinClass(speed) {
  // Full class strings so Tailwind's JIT picks them up.
  switch (speed) {
    case "slower":
      return "animate-spin-slower";
    case "reverse":
      return "animate-spin-reverse";
    case "slow":
    default:
      return "animate-spin-slow";
  }
}

function colorClasses(color) {
  switch (color) {
    case "pink":
      return {
        border: "border-pink-400/70",
        tint: "bg-pink-400/[0.03]",
        // Layered box-shadows: outer glow + tighter inner-outer + inset for depth
        shadow:
          "shadow-[0_0_10px_rgba(236,72,153,0.6),0_0_30px_rgba(236,72,153,0.35),inset_0_0_12px_rgba(236,72,153,0.25)]",
      };
    case "amber":
      return {
        border: "border-amber-400/70",
        tint: "bg-amber-400/[0.03]",
        shadow:
          "shadow-[0_0_10px_rgba(251,191,36,0.6),0_0_30px_rgba(251,191,36,0.35),inset_0_0_12px_rgba(251,191,36,0.25)]",
      };
    case "green":
    default:
      return {
        border: "border-green-400/70",
        tint: "bg-green-400/[0.03]",
        shadow:
          "shadow-[0_0_10px_rgba(74,222,128,0.6),0_0_30px_rgba(74,222,128,0.35),inset_0_0_12px_rgba(74,222,128,0.25)]",
      };
  }
}

export default function FloatingCube({
  size = 160,
  color = "green",
  speed = "slow",
  floatDelay = 0,
  className = "",
}) {
  const half = size / 2;
  const { border, shadow, tint } = colorClasses(color);
  const faceCls = `absolute inset-0 border-2 ${border} ${tint} ${shadow}`;

  return (
    <div className={`absolute pointer-events-none ${className}`} style={{ perspective: "1000px" }}>
      <div className="animate-float" style={{ animationDelay: `${floatDelay}s` }}>
        <div
          className={`relative ${spinClass(speed)}`}
          style={{ width: size, height: size, transformStyle: "preserve-3d" }}
        >
          <div className={faceCls} style={{ transform: `translateZ(${half}px)` }} />
          <div className={faceCls} style={{ transform: `rotateY(180deg) translateZ(${half}px)` }} />
          <div className={faceCls} style={{ transform: `rotateY(90deg) translateZ(${half}px)` }} />
          <div className={faceCls} style={{ transform: `rotateY(-90deg) translateZ(${half}px)` }} />
          <div className={faceCls} style={{ transform: `rotateX(90deg) translateZ(${half}px)` }} />
          <div className={faceCls} style={{ transform: `rotateX(-90deg) translateZ(${half}px)` }} />
        </div>
      </div>
    </div>
  );
}
