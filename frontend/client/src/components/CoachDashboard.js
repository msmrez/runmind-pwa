// src/components/CoachDashboard.js
import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../api"; // Use centralized API client
// Removed Navigate as not used currently
// Removed useAuth as using localStorage directly

const CoachDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [error, setError] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  // No need to store token here, apiClient uses it from localStorage

  // Load user info from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("stravaAthlete");
    const token = localStorage.getItem("authToken"); // Check if token exists for auth check
    let parsedUser = null;
    console.log("[CoachDashboard] Checking user info and token...");

    if (storedUser) {
      try {
        parsedUser = JSON.parse(storedUser);
      } catch {
        parsedUser = null;
      }
    }

    if (token && parsedUser && parsedUser.appUserId) {
      setUserInfo(parsedUser);
      // Verify role immediately
      if (parsedUser.role !== "coach") {
        console.warn("[CoachDashboard] User is not a coach.");
        setError("Access denied. Coach role required.");
      } else {
        console.log("[CoachDashboard] User is a coach.");
      }
    } else {
      console.warn("[CoachDashboard] Auth token or user info missing.");
      // Interceptor in apiClient should handle redirect if token is missing/invalid on API call
      // Set local error for immediate feedback if needed
      setError("Authentication details missing. Please log in.");
    }
  }, []);

  // Fetch pending requests
  const fetchRequests = useCallback(async () => {
    if (!userInfo || userInfo.role !== "coach") return; // Guard clause
    console.log("[CoachDashboard] Fetching pending requests...");
    setLoadingRequests(true);
    setError("");
    try {
      // Use apiClient - token handled by interceptor
      const response = await apiClient.get("/api/coaches/link/requests", {
        params: { status: "pending" },
      });
      setRequests(response.data || []);
    } catch (err) {
      if (err.response?.status !== 401)
        setError(
          `Failed to load requests: ${
            err.response?.data?.message || err.message
          }`
        );
    } finally {
      // Avoid showing error if interceptor handles 401 redirect
      setLoadingRequests(false);
    }
  }, [userInfo]); // Depend on userInfo

  // Fetch accepted athletes
  const fetchAthletes = useCallback(async () => {
    if (!userInfo || userInfo.role !== "coach") return; // Guard clause
    console.log("[CoachDashboard] Fetching accepted athletes...");
    setLoadingAthletes(true);
    setError("");
    try {
      // Use apiClient
      const response = await apiClient.get("/api/coaches/athletes", {
        params: { status: "accepted" },
      });
      setAthletes(response.data || []);
    } catch (err) {
      if (err.response?.status !== 401)
        setError(
          `Failed to load athletes: ${
            err.response?.data?.message || err.message
          }`
        );
    } finally {
      setLoadingAthletes(false);
    }
  }, [userInfo]); // Depend on userInfo

  // Handle accepting/declining requests
  const handleRequestUpdate = async (linkId, newStatus) => {
    if (!linkId) return;
    console.log(`[CoachDashboard] Updating link ${linkId} to ${newStatus}`);
    // Add local loading state per item if desired
    try {
      // Use apiClient
      await apiClient.put(`/api/coaches/link/requests/${linkId}`, {
        status: newStatus,
      });
      // Refetch both lists after update for simplicity
      fetchRequests();
      fetchAthletes();
    } catch (err) {
      console.error(`[CoachDashboard] Error updating request ${linkId}:`, err);
      // Don't set general error if it's just one item failing maybe
      alert(
        `Failed to update request: ${
          err.response?.data?.message || err.message
        }`
      );
      fetchRequests(); // Refetch requests even on error?
    }
  };

  // Fetch initial data if user is confirmed as a coach
  useEffect(() => {
    if (userInfo && userInfo.role === "coach") {
      console.log("[CoachDashboard] User is coach, fetching initial data.");
      fetchRequests();
      fetchAthletes();
    }
  }, [userInfo, fetchRequests, fetchAthletes]); // Depend on memoized functions and userInfo

  // --- Render Logic ---
  // Show error if role check failed or auth failed
  if (error)
    return (
      <p style={{ color: "red", padding: "20px" }}>
        {error} <Link to="/login">Login?</Link>
      </p>
    );
  // Show loading while user info is checked
  if (!userInfo) return <p>Loading...</p>;
  // This check is redundant if error state is set correctly, but safe
  if (userInfo.role !== "coach")
    return <p style={{ color: "red", padding: "20px" }}>Access Denied.</p>;

  // Render basic coach dashboard structure
  return (
    <div style={{ padding: "20px" }}>
      <h2>Coach Dashboard</h2>
      <p>Welcome, Coach {userInfo?.firstname}!</p>

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <h3>Pending Athlete Requests</h3>
        {loadingRequests && <p>Loading requests...</p>}
        {!loadingRequests && requests.length === 0 && (
          <p>No pending requests.</p>
        )}
        {!loadingRequests && requests.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {requests.map((req) => (
              <li
                key={req.link_id}
                style={{
                  border: "1px solid #eee",
                  padding: "10px",
                  marginBottom: "5px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>
                  {req.athlete_first_name} {req.athlete_last_name} (
                  {req.athlete_email})
                </span>
                <div>
                  {" "}
                  {/* Button group */}
                  <button
                    onClick={() => handleRequestUpdate(req.link_id, "accepted")}
                    style={{
                      marginLeft: "10px",
                      backgroundColor: "green",
                      color: "white",
                      border: "none",
                      padding: "5px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRequestUpdate(req.link_id, "declined")}
                    style={{
                      marginLeft: "5px",
                      backgroundColor: "red",
                      color: "white",
                      border: "none",
                      padding: "5px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: "20px" }}>
        <h3>Your Athletes</h3>
        {loadingAthletes && <p>Loading athletes...</p>}
        {!loadingAthletes && athletes.length === 0 && (
          <p>No athletes linked yet.</p>
        )}
        {!loadingAthletes && athletes.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {athletes.map((ath) => (
              <li
                key={ath.user_id}
                style={{
                  border: "1px solid #eee",
                  padding: "10px",
                  marginBottom: "5px",
                }}
              >
                {ath.first_name} {ath.last_name} ({ath.email})
                {/* Add Revoke button/link later */}
                {/* Add link to athlete's data view later */}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
export default CoachDashboard;
