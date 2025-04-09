// src/components/LoginPage.js
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiClient from "../api";

const LoginPage = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem("authToken"); // Check if already logged in

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) {
      console.log(
        "[LoginPage] User already logged in, redirecting to dashboard."
      );
      navigate("/dashboard");
    }
  }, [isLoggedIn, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(""); // Clear error on change
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.password) {
      setError("Email and Password are required.");
      return;
    }

    setIsLoading(true);
    try {
      console.log("[LoginPage] Attempting login for:", formData.email);
      // Make POST request to backend login route
      const response = await apiClient.post("/auth/login", {
        email: formData.email,
        password: formData.password,
      });

      console.log("[LoginPage] Login successful:", response.data);

      // --- CRITICAL STEP: Store Token and User Info ---
      if (response.data && response.data.token && response.data.user) {
        // Store the JWT using the key the interceptor expects
        localStorage.setItem("authToken", response.data.token);
        // Store user info (excluding token, password) for easy display access
        // Ensure this matches the structure expected by Dashboard/other components
        localStorage.setItem(
          "stravaAthlete",
          JSON.stringify(response.data.user)
        ); // Re-using 'stravaAthlete' key, might rename later
        console.log("[LoginPage] Token and user info stored in localStorage.");

        // Redirect to the dashboard upon successful login
        navigate("/dashboard");
      } else {
        // This shouldn't happen if backend sends correct response, but good to check
        console.error("[LoginPage] Login response missing token or user data.");
        setError("Login failed: Invalid response from server.");
      }
      // --- END CRITICAL STEP ---
    } catch (err) {
      console.error(
        "[LoginPage] Login error:",
        err.response?.data || err.message
      );
      setError(
        `Login failed: ${err.response?.data?.message || "Server error"}`
      );
      // Clear potential stale tokens if login fails
      localStorage.removeItem("authToken");
      localStorage.removeItem("stravaAthlete");
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render form if redirecting
  if (isLoggedIn) return <p>Redirecting...</p>;

  return (
    <div
      style={{
        maxWidth: "400px",
        margin: "40px auto",
        padding: "20px",
        border: "1px solid #ccc",
        borderRadius: "5px",
      }}
    >
      <h2>Login to RunMind</h2>
      <form onSubmit={handleSubmit}>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <div style={{ marginBottom: "10px" }}>
          <label htmlFor="email">Email:</label>
          <br />
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={{ width: "95%" }}
          />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="password">Password:</label>
          <br />
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            style={{ width: "95%" }}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          style={{ padding: "10px 15px" }}
        >
          {isLoading ? "Logging In..." : "Login"}
        </button>
      </form>
      <p style={{ marginTop: "15px" }}>
        Don't have an account? <Link to="/register">Register</Link>
      </p>
      {/* Add link for Strava login if you keep that separate */}
      <p style={{ marginTop: "10px" }}>
        Or{" "}
        <a
          href={
            (process.env.REACT_APP_BACKEND_URL || "http://localhost:5001") +
            "/strava/authorize"
          }
        >
          Connect with Strava
        </a>
        {/* Note: Need to handle linking Strava-only users to email/pass later */}
      </p>
    </div>
  );
};

export default LoginPage;
