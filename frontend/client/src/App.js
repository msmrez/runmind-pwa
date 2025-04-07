// src/App.js
import React from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom"; // Added Link
import StravaCallback from "./components/StravaCallback";
import Dashboard from "./components/Dashboard"; // Import Dashboard
import "./App.css";

function App() {
  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";

  // Basic check if user info exists in localStorage to adjust UI
  // Note: This check happens on every render. Consider moving to state if it gets complex.
  const isLoggedIn = !!localStorage.getItem("stravaAthlete");
  // --- ADDED LOG ---
  console.log("[App Render] isLoggedIn based on localStorage:", isLoggedIn);

  const handleLogout = () => {
    console.log(
      "[App Logout] Removing stravaAthlete from localStorage and redirecting."
    );
    localStorage.removeItem("stravaAthlete");
    // Force a hard reload to ensure state is cleared across components relying on localStorage
    window.location.href = "/";
  };

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>RunMind PWA</h1>
          <nav>
            <Link to="/" style={{ marginRight: "15px" }}>
              Home
            </Link>
            {isLoggedIn && (
              <Link to="/dashboard" style={{ marginRight: "15px" }}>
                Dashboard
              </Link>
            )}
            {!isLoggedIn && (
              <a href={`${backendUrl}/strava/authorize`} className="App-link">
                Connect with Strava
              </a>
            )}
            {/* Basic Logout Example */}
            {isLoggedIn && (
              <button onClick={handleLogout} style={{ marginLeft: "15px" }}>
                Logout
              </button>
            )}
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/strava/callback" element={<StravaCallback />} />
            {/* --- UPDATED Route Protection --- */}
            <Route
              path="/dashboard"
              element={
                isLoggedIn ? (
                  <Dashboard />
                ) : (
                  <HomePage message="Please connect with Strava to access the dashboard." />
                )
              }
            />
            <Route path="/" element={<HomePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

// Updated HomePage component
function HomePage({
  message = "Track your runs, gain insights, and connect mind & body.",
}) {
  // Check login status directly inside component if needed
  const athleteInfo = localStorage.getItem("stravaAthlete");
  // --- ADDED LOG ---
  console.log("[HomePage Render] athleteInfo from localStorage:", athleteInfo);

  return (
    <div>
      <h2>Welcome to RunMind</h2>
      <p>{message}</p>
      {athleteInfo ? (
        <p>
          You are connected. Go to the <Link to="/dashboard">Dashboard</Link>.
        </p>
      ) : (
        <p>Connect your Strava account to get started.</p>
      )}
    </div>
  );
}

export default App;
