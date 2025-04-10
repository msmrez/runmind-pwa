// src/components/LoginPage.js
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
// --- Use apiClient ---
import apiClient from "../api"; // Adjust path if needed

const LoginPage = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem("authToken");

  useEffect(() => {
    if (isLoggedIn) navigate("/dashboard");
  }, [isLoggedIn, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
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
      console.log("[LoginPage] Attempting login:", formData.email);
      // --- Use apiClient ---
      // No token needed for login request itself
      const response = await apiClient.post("/auth/login", formData);
      console.log("[LoginPage] Success:", response.data);

      if (response.data?.token && response.data?.user) {
        localStorage.setItem("authToken", response.data.token);
        // Store user info (make sure key matches what Dashboard reads)
        localStorage.setItem(
          "stravaAthlete",
          JSON.stringify(response.data.user)
        );
        console.log("[LoginPage] Token/User stored.");

        // --- Force App Reload to update global state ---
        // This is simpler than context/props drilling for now
        window.location.href =
          response.data.user.role === "coach"
            ? "/coach/dashboard"
            : "/dashboard";
        // navigate(response.data.user.role === 'coach' ? '/coach/dashboard' : '/dashboard'); // navigate might not refresh App state
      } else {
        throw new Error("Login response missing token or user data.");
      }
    } catch (err) {
      console.error("[LoginPage] Error:", err.response?.data || err.message);
      setError(
        `Login failed: ${err.response?.data?.message || "Server error"}`
      );
      localStorage.removeItem("authToken");
      localStorage.removeItem("stravaAthlete");
    } finally {
      setIsLoading(false);
    }
  };

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
          {" "}
          <label htmlFor="email">Email:</label>
          <br />{" "}
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={{ width: "95%", padding: "8px" }}
          />{" "}
        </div>
        <div style={{ marginBottom: "15px" }}>
          {" "}
          <label htmlFor="password">Password:</label>
          <br />{" "}
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            style={{ width: "95%", padding: "8px" }}
          />{" "}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          style={{ padding: "10px 15px" }}
        >
          {" "}
          {isLoading ? "Logging In..." : "Login"}{" "}
        </button>
      </form>
      <p style={{ marginTop: "15px" }}>
        {" "}
        Don't have an account? <Link to="/register">Register</Link>{" "}
      </p>
      <p style={{ marginTop: "10px" }}>
        {" "}
        Or{" "}
        <a
          href={
            (process.env.REACT_APP_BACKEND_URL || "http://localhost:5001") +
            "/strava/authorize"
          }
        >
          {" "}
          Connect with Strava{" "}
        </a>{" "}
      </p>
    </div>
  );
};
export default LoginPage;
