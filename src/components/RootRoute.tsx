import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { Landing } from "@/pages/Landing";

// "/" is the public marketing homepage (hero, "Get Started Free", etc.).
// A tenant or landlord who already created an account should never land
// back on that signup pitch — e.g. tapping the logo, or opening a
// bookmarked/home-screen root URL. Send them straight to their own
// dashboard instead; only a signed-out visitor sees Landing.
export function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.role === "landlord" ? "/landlord" : "/home"} replace />;
  return <Landing />;
}
