import { Navigate } from "react-router-dom";

// send the user to the authentication page if they are not logged in.
export default function ProtectedRoute({ children }) {
  const user = localStorage.getItem("sc_user"); // checks if the user is logged in by looking for the user data in local storage
  if (!user) return <Navigate to="/auth" replace />;
  return children; // if the user is logged in, render the child components (the protected page)
}