import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const user = localStorage.getItem("sc_user");
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}