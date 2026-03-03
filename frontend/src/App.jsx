import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import AnimatedRoutes from "./AnimatedRoutes";

import { dbHealth } from "./api";

export default function App() {
  useEffect(() => {
    dbHealth()
      .then((data) => console.log("Backend + DB:", data))
      .catch((err) => console.error("Backend/DB error:", err));
  }, []);

  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
