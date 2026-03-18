import { useEffect } from "react"; // checking backend health on app load
import { BrowserRouter } from "react-router-dom";  // for page transitions and routing
import AnimatedRoutes from "./AnimatedRoutes";  // what URL paths map to which components

import { dbHealth } from "./api"; // function to check backend and database health

export default function App() { // created main App 

  // On app load, check if backend and database are healthy
  useEffect(() => {
    dbHealth()
      .then((data) => console.log("Backend + DB:", data))
      .catch((err) => console.error("Backend/DB error:", err));
  }, []);

  return ( // sets up the routing system for the app 
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
