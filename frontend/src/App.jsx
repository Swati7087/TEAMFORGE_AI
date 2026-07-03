import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        {/* Terminal Punk sonner: dark theme, bottom-right, rich colors so
            success = neon green and error = hot pink read as our accents. */}
        <Toaster
          theme="dark"
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "rgba(10, 10, 18, 0.9)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(8px)",
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
