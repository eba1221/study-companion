import { Routes, Route, useLocation, Navigate } from "react-router-dom"; // Routes : holds all the page routes, Route : defines a specific page,
// useLocation : tracks the current page, Navigate : redirects the user to another page
import { AnimatePresence, motion } from "framer-motion"; // page fade animations

// Importing all the page components and the ProtectedRoute component
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Analytics from "./pages/Analytics";
import FlashcardsPage from "./pages/FlashcardsPage";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";
import SettingsPage from "./pages/Settings";

//
const pageVariants = {
  initial: { opacity: 0, y: 6, filter: "blur(2px)" }, // slightly transparent, blurred, and shifted down
  //fade in, sharpen, and move to normal position
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.22, ease: "easeOut" },
  },
  //fade out, blur, and shift up when leaving the page 
  exit: {
    opacity: 0,
    y: -6,
    filter: "blur(2px)",
    transition: { duration: 0.16, ease: "easeIn" },
  },
};

// Wrapper component to apply the page transition animations to each page
function Page({ children }) {
  return (
    //motion.div component from framer-motion applies the defined animations to the page transitions
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

export default function AnimatedRoutes() { // main component that defines the routing and page transitions for the app
  const location = useLocation(); // gets current URL location 

  return (
    <AnimatePresence mode="wait"> // wit emsures exit animation completes before new page enters
      <Routes location={location} key={location.pathname}>

        {/* Public route */} // anyone can access the auth page 
        <Route path="/auth" element={<Page><Auth /></Page>} />

        {/* Protected routes */} // to access these pages the user must be authenticated
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

        <Route path="/settings" element={
          <ProtectedRoute><Page><SettingsPage /></Page></ProtectedRoute>
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
