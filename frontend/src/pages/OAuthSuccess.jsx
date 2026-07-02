import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// Catches the redirect from backend googleCallback:
//   GET ${FRONTEND_URL}/oauth-success?token=<jwt>
// Not wrapped in ProtectedRoute — the user isn't authenticated yet when this loads.
export default function OAuthSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    setSession(token)
      .then(() => navigate("/dashboard", { replace: true }))
      .catch(() => navigate("/login", { replace: true }));
  }, [params, navigate, setSession]);

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-green-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-green-400 animate-spin shadow-[0_0_20px_rgba(74,222,128,0.4)]" />
        <p className="text-sm text-gray-400 tracking-wide">Signing you in...</p>
      </div>
    </div>
  );
}
