import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Analytics from "./pages/Analytics";
import FlashcardsPage from "./pages/FlashcardsPage";
import Auth from "./pages/Auth";

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
    filter: "blur(2px)" },
    transition: { duration: 0.16, ease: "easeIn" },
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
        <Route path="/" element={<Page><Home /></Page>} />

        {/* ✅ LOGIN / REGISTER */}
        <Route path="/auth" element={<Page><Auth /></Page>} />

        {/* ✅ Learn now goes directly to Flashcards */}
        <Route path="/learn" element={<Navigate to="/flashcards" replace />} />

        {/* ✅ Flashcards main route */}
        <Route path="/flashcards" element={<Page><FlashcardsPage /></Page>} />

        {/* ✅ Old routes kept as redirects so nothing breaks */}
        <Route path="/learn/flashcards" element={<Navigate to="/flashcards" replace />} />
        <Route path="/learn/notes" element={<Navigate to="/flashcards" replace />} />

        <Route path="/quiz" element={<Page><Quiz /></Page>} />
        <Route path="/analytics" element={<Page><Analytics /></Page>} />

        {/* ✅ optional fallback so no "No routes matched" errors */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}