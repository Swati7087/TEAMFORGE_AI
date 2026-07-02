export default function Profile() {
  return (
    <div className="min-h-screen bg-[#050508] relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-green-500/[0.08] rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-pink-500/[0.08] rounded-full blur-[160px] pointer-events-none" />

      <main className="relative max-w-4xl mx-auto px-6 py-12">
        <p className="text-xs font-medium text-green-400 tracking-[0.2em] uppercase mb-2">
          Profile
        </p>
        <h1 className="text-4xl font-bold text-white">Your profile</h1>

        <div className="mt-8 relative">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-green-500/20 via-transparent to-pink-500/20 opacity-50 blur-sm" />
          <div className="relative bg-[#0a0a12]/70 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8">
            <p className="text-gray-400">Profile editor coming soon.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
