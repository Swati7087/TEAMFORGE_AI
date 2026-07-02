import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Wait for the mount-time session check before deciding to redirect.
  // Without this, a hard refresh flashes /login for a frame before /me resolves.
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-green-400 animate-spin shadow-[0_0_16px_rgba(74,222,128,0.4)]" />
          <p className="text-xs text-gray-500 tracking-wider uppercase">Loading</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
