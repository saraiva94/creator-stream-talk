import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

const RETURN_TO_KEY = "auth_return_to";

export const saveReturnTo = (path: string) => {
  // Don't save auth-related paths
  const excludedPaths = ["/auth", "/subscribe", "/reset-password", "/update-password", "/invite", "/access-denied"];
  if (!excludedPaths.some(excluded => path.startsWith(excluded))) {
    sessionStorage.setItem(RETURN_TO_KEY, path);
  }
};

export const getReturnTo = (): string | null => {
  return sessionStorage.getItem(RETURN_TO_KEY);
};

export const clearReturnTo = () => {
  sessionStorage.removeItem(RETURN_TO_KEY);
};

export const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, isLoading, isAdmin, isAdminLoading } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated - save current path and redirect to login
  if (!user) {
    saveReturnTo(location.pathname + location.search);
    return <Navigate to="/auth" replace />;
  }

  // Wait for admin status to be checked before redirecting
  if (requireAdmin && isAdminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Requires admin but user is not admin - redirect to access denied page
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
