import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Analytics from "./pages/Analytics";
import FlashcardsPage from "./pages/FlashcardsPage";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";

const pageVariants = {
  initial: { opacity: 0, y: 6, filter: "blur(2px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.22, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -6,
    filter: "blur(2px)",
    transition: { duration: 0.16, ease: "easeIn" },
  },
};

function Page({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ height: "100%" }}
    >
      {children}
    </motion.div>
  );
}

export default function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>

        {/* Public route */}
        <Route path="/auth" element={<Page><Auth /></Page>} />

        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedRoute><Page><Home /></Page></ProtectedRoute>
        } />

        <Route path="/flashcards" element={
          <ProtectedRoute><Page><FlashcardsPage /></Page></ProtectedRoute>
        } />

        <Route path="/quiz" element={
          <ProtectedRoute><Page><Quiz /></Page></ProtectedRoute>
        } />

        <Route path="/analytics" element={
          <ProtectedRoute><Page><Analytics /></Page></ProtectedRoute>
        } />

        {/* Redirects */}
        <Route path="/learn" element={<Navigate to="/flashcards" replace />} />
        <Route path="/learn/flashcards" element={<Navigate to="/flashcards" replace />} />
        <Route path="/learn/notes" element={<Navigate to="/flashcards" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </AnimatePresence>
  );
}
