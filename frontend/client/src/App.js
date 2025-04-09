// src/App.js
import React, { useState, useEffect } from "react"; // Added useState, useEffect for dynamic login state
import { BrowserRouter, Route, Routes, Link, Navigate } from "react-router-dom"; // Added Navigate for redirects
import StravaCallback from "./components/StravaCallback";
import Dashboard from "./components/Dashboard";
import ActivityDetail from "./components/ActivityDetail";
import DiaryPage from "./components/DiaryPage";
import DietLogPage from "./components/DietLogPage";
import GoalsPage from "./components/GoalsPage";
import LoginPage from "./components/LoginPage"; // <<< Import LoginPage
import RegisterPage from "./components/RegisterPage"; // <<< Import RegisterPage
import "./App.css";

// --- HomePage Component Definition (defined in App.js) ---
function HomePage({
  message = "Track your runs, gain insights, and connect mind & body.",
}) {
  const isLoggedIn = !!localStorage.getItem("authToken"); // Check token now
  return (
    <div>
      <h2>Welcome to RunMind</h2>
      <p>{message}</p>
      {isLoggedIn ? (
        <p>
          Go to the <Link to="/dashboard">Dashboard</Link>.
        </p>
      ) : (
        <div>
          <p>
            {" "}
            <Link to="/login">Log In</Link> or{" "}
            <Link to="/register">Register</Link> to get started.
          </p>
          <p>
            {" "}
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

function App() {
  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
  // --- Use state for login status for dynamic UI updates ---
  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem("authToken")
  );

  // Function to update login state (could be passed via Context later)
  const handleSetLoggedIn = (status) => {
    setIsLoggedIn(status);
  };

  // Check token validity on app load? Optional advanced feature.

  const handleLogout = () => {
    console.log("[App Logout] Clearing tokens and state, redirecting.");
    localStorage.removeItem("authToken");
    localStorage.removeItem("stravaAthlete"); // Keep clearing this for now
    setIsLoggedIn(false); // Update state
    // Use Navigate component or navigate() hook if needed, window.location is simple
    window.location.href = "/login"; // Redirect to login after logout
  };

  // --- Protected Route Wrapper ---
  // Redirects to login if no auth token is found
  const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      console.log("[ProtectedRoute] No token found, redirecting to /login");
      // Use Navigate component for redirection within React Router
      return <Navigate to="/login" replace />;
    }
    // If token exists, render the requested component
    // The API calls within the component will validate the token further
    return children;
  };

  return (
    <BrowserRouter>
      <div className="App">
        <header className="App-header">
          <h1>RunMind PWA</h1>
          <nav>
            <Link to="/" style={{ marginRight: "15px" }}>
              Home
            </Link>
            {/* Show links based on state */}
            {isLoggedIn && (
              <Link to="/dashboard" style={{ marginRight: "15px" }}>
                Dashboard
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

            {/* Show Login/Register OR Logout */}
            {!isLoggedIn && (
              <>
                <Link to="/login" style={{ marginRight: "15px" }}>
                  Login
                </Link>
                <Link to="/register" style={{ marginRight: "15px" }}>
                  Register
                </Link>
                <a href={`${backendUrl}/strava/authorize`} className="App-link">
                  Connect with Strava
                </a>
              </>
            )}
            {isLoggedIn && (
              <button onClick={handleLogout} style={{ marginLeft: "15px" }}>
                Logout
              </button>
            )}
          </nav>
        </header>
        <main>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            {/* Pass handleSetLoggedIn or use context if Callback needs to trigger login state update */}
            <Route
              path="/strava/callback"
              element={
                <StravaCallback /* onAuthSuccess={() => handleSetLoggedIn(true)} */
                />
              }
            />
            <Route
              path="/login"
              element={
                <LoginPage /* onLoginSuccess={() => handleSetLoggedIn(true)} */
                />
              }
            />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Routes */}
            {/* Wrap protected components with the ProtectedRoute component */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  {" "}
                  <Dashboard />{" "}
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity/:activityId"
              element={
                <ProtectedRoute>
                  {" "}
                  <ActivityDetail />{" "}
                </ProtectedRoute>
              }
            />
            <Route
              path="/diary"
              element={
                <ProtectedRoute>
                  {" "}
                  <DiaryPage />{" "}
                </ProtectedRoute>
              }
            />
            <Route
              path="/diet"
              element={
                <ProtectedRoute>
                  {" "}
                  <DietLogPage />{" "}
                </ProtectedRoute>
              }
            />
            <Route
              path="/goals"
              element={
                <ProtectedRoute>
                  {" "}
                  <GoalsPage />{" "}
                </ProtectedRoute>
              }
            />

            {/* Optional: 404 */}
            {/* <Route path="*" element={ <NotFoundComponent /> } /> */}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
