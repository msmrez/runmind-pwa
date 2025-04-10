// src/components/RegisterPage.js
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
// --- Use apiClient ---
import apiClient from "../api"; // Adjust path if apiClient is elsewhere

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "runner", // <<< Default role added to state
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
    setSuccess("");
    if (!formData.email || !formData.password || !formData.firstName) {
      setError("First Name, Email, Password required.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      console.log(
        "[RegisterPage] Attempting registration:",
        formData.email,
        "Role:",
        formData.role
      );
      // --- Use apiClient ---
      // No token needed, just call post on the instance
      const response = await apiClient.post("/auth/register", {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        role: formData.role, // <<< Send selected role
      });
      console.log("[RegisterPage] Success:", response.data);
      setSuccess("Registration successful! Redirecting to login...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error("[RegisterPage] Error:", err.response?.data || err.message);
      setError(
        `Registration failed: ${err.response?.data?.message || err.message}`
      );
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
      <h2>Register for RunMind</h2>
      <form onSubmit={handleSubmit}>
        {error && <p style={{ color: "red" }}>{error}</p>}
        {success && <p style={{ color: "green" }}>{success}</p>}
        <div style={{ marginBottom: "10px" }}>
          {" "}
          <label htmlFor="firstName">First Name:</label>
          <br />{" "}
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            required
            style={{ width: "95%", padding: "8px" }}
          />{" "}
        </div>
        <div style={{ marginBottom: "10px" }}>
          {" "}
          <label htmlFor="lastName">Last Name:</label>
          <br />{" "}
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            style={{ width: "95%", padding: "8px" }}
          />{" "}
        </div>
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
        <div style={{ marginBottom: "10px" }}>
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
        <div style={{ marginBottom: "15px" }}>
          {" "}
          <label htmlFor="confirmPassword">Confirm Password:</label>
          <br />{" "}
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            style={{ width: "95%", padding: "8px" }}
          />{" "}
        </div>
        {/* Role Selector */}
        <div style={{ marginBottom: "15px" }}>
          <label htmlFor="role">Register as: </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            style={{ padding: "8px" }}
          >
            <option value="runner">Runner</option>
            <option value="coach">Coach</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          style={{ padding: "10px 15px" }}
        >
          {" "}
          {isLoading ? "Registering..." : "Register"}{" "}
        </button>
      </form>
      <p style={{ marginTop: "15px" }}>
        {" "}
        Already have an account? <Link to="/login">Log In</Link>{" "}
      </p>
    </div>
  );
};
export default RegisterPage;
