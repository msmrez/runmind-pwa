// src/App.js
import React from "react";
import { BrowserRouter, Route, Routes, Link } from "react-router-dom";
import StravaCallback from "./components/StravaCallback";
import Dashboard from "./components/Dashboard";
import ActivityDetail from "./components/ActivityDetail";
import DiaryPage from "./components/DiaryPage";
import DietLogPage from "./components/DietLogPage";
import GoalsPage from "./components/GoalsPage"; // <<< Import GoalsPage
import "./App.css";

function HomePage({ message = "..." }) {
  /* ... */
}

function App() {
  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
  const isLoggedIn = !!localStorage.getItem("stravaAthlete");
  const handleLogout = () => {
    /* ... */
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
            {/* --- NEW GOALS LINK --- */}
            {isLoggedIn && (
              <Link to="/goals" style={{ marginRight: "15px" }}>
                Goals
              </Link>
            )}
            {/* --- END NEW LINK --- */}
            {!isLoggedIn && (
              <a href={`${backendUrl}/strava/authorize`} className="App-link">
                Connect
              </a>
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
            <Route path="/strava/callback" element={<StravaCallback />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                isLoggedIn ? (
                  <Dashboard />
                ) : (
                  <HomePage message="Login required." />
                )
              }
            />
            <Route
              path="/activity/:activityId"
              element={
                isLoggedIn ? (
                  <ActivityDetail />
                ) : (
                  <HomePage message="Login required." />
                )
              }
            />
            <Route
              path="/diary"
              element={
                isLoggedIn ? (
                  <DiaryPage />
                ) : (
                  <HomePage message="Login required." />
                )
              }
            />
            <Route
              path="/diet"
              element={
                isLoggedIn ? (
                  <DietLogPage />
                ) : (
                  <HomePage message="Login required." />
                )
              }
            />
            {/* --- NEW GOALS ROUTE --- */}
            <Route
              path="/goals"
              element={
                isLoggedIn ? (
                  <GoalsPage />
                ) : (
                  <HomePage message="Login required." />
                )
              }
            />
            {/* --- END NEW ROUTE --- */}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
