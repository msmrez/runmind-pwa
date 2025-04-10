// src/App.js
import React, { useState, useEffect } from "react"; // Use state/effect for login status
import { BrowserRouter, Route, Routes, Link, Navigate } from "react-router-dom";
import StravaCallback from "./components/StravaCallback";
import Dashboard from "./components/Dashboard";
import ActivityDetail from "./components/ActivityDetail";
import DiaryPage from "./components/DiaryPage";
import DietLogPage from "./components/DietLogPage";
import GoalsPage from "./components/GoalsPage";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import CoachDashboard from "./components/CoachDashboard";
// Removed HomePage import, defined below
import "./App.css";

// --- HomePage Component Definition ---
function HomePage({
  message = "Track runs, gain insights, connect mind & body.",
}) {
  const isLoggedIn = !!localStorage.getItem("authToken"); // Check token
  const userInfo = (() => {
    // IIFE to safely parse user info
    const stored = localStorage.getItem("stravaAthlete");
    try {
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  return (
    <div>
      <h2>Welcome to RunMind</h2>
      <p>{message}</p>
      {isLoggedIn ? (
        <p>
          {" "}
          Go to{" "}
          {userInfo?.role === "coach" ? (
            <Link to="/coach/dashboard">Coach View</Link>
          ) : (
            <Link to="/dashboard">Dashboard</Link>
          )}
          .{" "}
        </p>
      ) : (
        <div>
          <p>
            <Link to="/login">Log In</Link> or{" "}
            <Link to="/register">Register</Link>.
          </p>
          <p>
            Or{" "}
            <a
              href={
                (process.env.REACT_APP_BACKEND_URL || "http://localhost:5001") +
                "/strava/authorize"
              }
            >
              Connect with Strava
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
// --- End HomePage ---

function App() {
  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
  // --- State for login status ---
  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem("authToken")
  );
  const [userInfo, setUserInfo] = useState(null);

  // --- Effect to load user info and sync login state ---
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const storedUserStr = localStorage.getItem("stravaAthlete");
    let currentUserInfo = null;
    console.log("[App Effect] Checking auth status...");

    if (token) {
      setIsLoggedIn(true);
      if (storedUserStr) {
        try {
          currentUserInfo = JSON.parse(storedUserStr);
          setUserInfo(currentUserInfo);
          console.log("[App Effect] User info loaded:", currentUserInfo);
        } catch {
          localStorage.removeItem("stravaAthlete");
          setUserInfo(null);
          console.warn("[App Effect] Cleared invalid user info.");
        }
      } else {
        setUserInfo(null);
        console.log("[App Effect] Token exists but no user info found.");
      }
    } else {
      setIsLoggedIn(false);
      setUserInfo(null);
      console.log("[App Effect] No token found.");
    }

    // Simple listener for storage changes (e.g., login/logout in another tab)
    const handleStorageChange = (event) => {
      if (event.key === "authToken" || event.key === "stravaAthlete") {
        console.log(
          "[App Storage Listener] Auth related item changed. Reloading state."
        );
        const currentToken = localStorage.getItem("authToken");
        const currentUserStr = localStorage.getItem("stravaAthlete");
        setIsLoggedIn(!!currentToken);
        try {
          setUserInfo(currentUserStr ? JSON.parse(currentUserStr) : null);
        } catch {
          setUserInfo(null);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange); // Cleanup listener
  }, []); // Runs once on initial load

  const handleLogout = () => {
    console.log("[App Logout] Clearing storage and state.");
    localStorage.removeItem("authToken");
    localStorage.removeItem("stravaAthlete");
    setIsLoggedIn(false); // Update state
    setUserInfo(null);
    // Redirect to login after logout - window.location forces clean state
    window.location.href = "/login";
  };

  // --- Protected Route Wrapper ---
  const ProtectedRoute = ({ children, allowedRoles }) => {
    // Use the state variable for checking login status for immediate UI feedback
    if (!isLoggedIn) {
      console.log(
        "[ProtectedRoute] Not logged in (state check), redirecting to /login"
      );
      // Redirect to login page if not authenticated
      return <Navigate to="/login" replace />;
    }
    // Optional Role check (using state userInfo)
    if (allowedRoles && userInfo && !allowedRoles.includes(userInfo.role)) {
      console.warn(
        `[ProtectedRoute] Role mismatch. User: ${userInfo.role}, Allowed: ${allowedRoles}`
      );
      // Redirect to appropriate dashboard or a specific unauthorized page
      return (
        <Navigate
          to={userInfo.role === "coach" ? "/coach/dashboard" : "/dashboard"}
          replace
        />
      );
    }
    // Render the child component if checks pass
    return children;
  };

  return (
    // Using BrowserRouter here
    <BrowserRouter>
      <div className="App">
        <header className="App-header">
          <h1>RunMind PWA</h1>
          <nav>
            <Link to="/" style={{ marginRight: "15px" }}>
              Home
            </Link>
            {/* Links based on state */}
            {isLoggedIn && userInfo?.role === "runner" && (
              <Link to="/dashboard" style={{ marginRight: "15px" }}>
                Dashboard
              </Link>
            )}
            {isLoggedIn && userInfo?.role === "coach" && (
              <Link to="/coach/dashboard" style={{ marginRight: "15px" }}>
                Coach View
              </Link>
            )}
            {isLoggedIn && (
              <Link to="/diary" style={{ marginRight: "15px" }}>
                Diary
              </Link>
            )}
            {isLoggedIn && (
              <Link to="/diet" style={{ marginRight: "15px" }}>
                Diet Log
              </Link>
            )}
            {isLoggedIn && (
              <Link to="/goals" style={{ marginRight: "15px" }}>
                Goals
              </Link>
            )}

            {!isLoggedIn && (
              <>
                {" "}
                <Link to="/login" style={{ marginRight: "15px" }}>
                  Login
                </Link>{" "}
                <Link to="/register" style={{ marginRight: "15px" }}>
                  Register
                </Link>{" "}
                <a href={`${backendUrl}/strava/authorize`} className="App-link">
                  {" "}
                  Connect Strava{" "}
                </a>{" "}
              </>
            )}
            {isLoggedIn && (
              <button onClick={handleLogout} style={{ marginLeft: "15px" }}>
                {" "}
                Logout{" "}
              </button>
            )}
          </nav>
        </header>
        <main>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            {/* Pass a function to update App's state IF LoginPage doesn't force reload */}
            {/* Currently LoginPage forces reload, so prop isn't strictly needed but good pattern */}
            <Route
              path="/login"
              element={<LoginPage /* onLoginSuccess={handleSetLoggedIn} */ />}
            />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/strava/callback"
              element={
                <StravaCallback /* onAuthSuccess={handleSetLoggedIn} */ />
              }
            />
            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={["runner", "coach"]}>
                  {" "}
                  <Dashboard />{" "}
                </ProtectedRoute>
              }
            />{" "}
            {/* Allow coach to see runner dash? */}
            <Route
              path="/activity/:activityId"
              element={
                <ProtectedRoute allowedRoles={["runner", "coach"]}>
                  {" "}
                  <ActivityDetail />{" "}
                </ProtectedRoute>
              }
            />
            <Route
              path="/diary"
              element={
                <ProtectedRoute allowedRoles={["runner", "coach"]}>
                  {" "}
                  <DiaryPage />{" "}
                </ProtectedRoute>
              }
            />
            <Route
              path="/diet"
              element={
                <ProtectedRoute allowedRoles={["runner", "coach"]}>
                  {" "}
                  <DietLogPage />{" "}
                </ProtectedRoute>
              }
            />
            <Route
              path="/goals"
              element={
                <ProtectedRoute allowedRoles={["runner", "coach"]}>
                  {" "}
                  <GoalsPage />{" "}
                </ProtectedRoute>
              }
            />
            <Route
              path="/coach/dashboard"
              element={
                <ProtectedRoute allowedRoles={["coach"]}>
                  {" "}
                  <CoachDashboard />{" "}
                </ProtectedRoute>
              }
            />
            {/* 404 Catch-all */}
            <Route
              path="*"
              element={
                <div>
                  <h2>404 Not Found</h2>
                  <Link to="/">Go Home</Link>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
