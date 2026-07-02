import { useAuth } from "../hooks/useAuth";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#050508] relative overflow-hidden">
      {/* Ambient neon */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-green-500/[0.08] rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-10%] w-[600px] h-[600px] bg-pink-500/[0.08] rounded-full blur-[160px] pointer-events-none" />

      {/* Top bar */}
      <header className="relative border-b border-white/[0.06] backdrop-blur-xl bg-[#050508]/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-white">
            Team
            <span className="bg-gradient-to-r from-green-400 to-pink-400 bg-clip-text text-transparent">
              Forge
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
              {user?.email}
            </div>
            <button
              onClick={logout}
              className="text-xs font-medium text-gray-300 hover:text-white border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] rounded-lg px-3 py-1.5 transition-all duration-200"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-xs font-medium text-green-400 tracking-[0.2em] uppercase mb-2">
            Dashboard
          </p>
          <h1 className="text-4xl font-bold text-white">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-green-300 to-pink-300 bg-clip-text text-transparent">
              {user?.name}
            </span>
          </h1>
          <p className="text-gray-400 mt-2">
            Your projects, teams, and AI insights all live here.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PlaceholderCard
            label="Projects"
            value="0"
            hint="Create your first project"
            accent="green"
          />
          <PlaceholderCard
            label="Tasks"
            value="0"
            hint="No tasks assigned yet"
            accent="pink"
          />
          <PlaceholderCard
            label="Teams"
            value="0"
            hint="You're flying solo"
            accent="amber"
          />
        </div>

        <div className="mt-6 relative">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-green-500/20 via-transparent to-pink-500/20 opacity-50 blur-sm" />
          <div className="relative bg-[#0a0a12]/70 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
            <p className="text-xs font-medium text-gray-400 tracking-wider uppercase mb-3">
              Account
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InfoRow label="Name" value={user?.name} />
              <InfoRow label="Email" value={user?.email} />
              <InfoRow label="Auth" value={user?.authProvider ?? "local"} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function PlaceholderCard({ label, value, hint, accent }) {
  // Full class strings so Tailwind's JIT can statically detect them.
  const accentMap = {
    green: {
      gradient: "from-green-500/20 to-transparent",
      text: "text-green-300",
    },
    pink: {
      gradient: "from-pink-500/20 to-transparent",
      text: "text-pink-300",
    },
    amber: {
      gradient: "from-amber-500/20 to-transparent",
      text: "text-amber-300",
    },
  };
  const { gradient, text } = accentMap[accent];
  return (
    <div className="relative group">
      <div
        className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${gradient} opacity-40 blur-sm transition-opacity duration-300 group-hover:opacity-70`}
      />
      <div className="relative bg-[#0a0a12]/70 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6">
        <p className="text-xs font-medium text-gray-400 tracking-wider uppercase mb-3">
          {label}
        </p>
        <p className={`text-4xl font-bold ${text}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-2">{hint}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-gray-500 tracking-wider uppercase mb-1">
        {label}
      </p>
      <p className="text-sm text-gray-200 truncate">{value}</p>
    </div>
  );
}
