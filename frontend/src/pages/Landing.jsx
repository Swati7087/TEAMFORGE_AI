import { Link } from "react-router-dom";
import InteractiveCube from "../components/common/InteractiveCube";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient neon blobs — green + pink + amber */}
      <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] bg-green-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-pink-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-amber-500/[0.05] rounded-full blur-[160px] pointer-events-none" />

      <div className="relative w-full max-w-6xl grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: hero content */}
        <div className="text-center lg:text-left order-2 lg:order-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-green-400/30 bg-green-400/5 text-green-300 text-[11px] font-medium mb-8 tracking-[0.2em] uppercase backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse" />
            Built for Coding Students
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.05]">
            Team
            <span className="bg-gradient-to-r from-green-400 via-emerald-300 to-pink-400 bg-clip-text text-transparent [text-shadow:_0_0_40px_rgba(74,222,128,0.3)]">
              Forge
            </span>{" "}
            AI
          </h1>

          <p className="text-lg text-gray-400 mb-10 max-w-md mx-auto lg:mx-0 leading-relaxed">
            Ship projects faster with AI-assisted planning, smart team matching,
            and real-time contribution insights.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <Link
              to="/signup"
              className="group relative bg-gradient-to-r from-green-500 to-pink-500 text-white font-semibold px-7 py-3 rounded-xl transition-all duration-300 hover:shadow-[0_0_40px_rgba(74,222,128,0.5)] hover:scale-[1.02]"
            >
              Start building
            </Link>
            <Link
              to="/login"
              className="border border-white/15 text-white font-semibold px-7 py-3 rounded-xl transition-all duration-300 hover:bg-white/5 hover:border-white/30 backdrop-blur-sm"
            >
              Log in
            </Link>
          </div>

          <div className="mt-12 flex items-center justify-center lg:justify-start gap-8 text-xs text-gray-500 tracking-wider uppercase">
            <span>Gemini</span>
            <span className="w-1 h-1 rounded-full bg-gray-700" />
            <span>MongoDB</span>
            <span className="w-1 h-1 rounded-full bg-gray-700" />
            <span>GitHub</span>
          </div>
        </div>

        {/* Right: draggable 3D cube */}
        <div className="order-1 lg:order-2 flex flex-col items-center gap-4">
          <InteractiveCube />
          <p className="text-[11px] text-gray-500 tracking-[0.25em] uppercase select-none">
            Drag the cube
          </p>
        </div>
      </div>
    </div>
  );
}
