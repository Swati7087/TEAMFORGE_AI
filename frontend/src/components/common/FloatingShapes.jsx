import FloatingCube from "./FloatingCube";

// Drops 4 rotating 3D wireframe cubes into the background of a page.
// Positioned in the corners so they don't get eaten by a centered card
// or blurred out by the card's backdrop-blur.
// Parent should be `relative overflow-hidden`.
export default function FloatingShapes() {
  return (
    <>
      {/* Big green cube — top-right, sits well outside a centered max-w-md card */}
      <FloatingCube
        size={200}
        color="green"
        speed="slow"
        floatDelay={0}
        className="top-[10%] right-[6%]"
      />

      {/* Medium pink cube — bottom-left */}
      <FloatingCube
        size={160}
        color="pink"
        speed="slower"
        floatDelay={2}
        className="bottom-[10%] left-[6%]"
      />

      {/* Small amber cube — top-left, small enough not to crowd */}
      <FloatingCube
        size={90}
        color="amber"
        speed="reverse"
        floatDelay={4}
        className="top-[15%] left-[10%]"
      />

      {/* Small green cube — bottom-right, mirrors amber */}
      <FloatingCube
        size={100}
        color="green"
        speed="reverse"
        floatDelay={1}
        className="bottom-[18%] right-[10%]"
      />
    </>
  );
}
