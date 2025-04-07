// src/components/Dashboard.js
import React, { useState, useEffect } from "react";
import axios from "axios";

const Dashboard = () => {
  const [syncStatus, setSyncStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activities, setActivities] = useState([]); // To store fetched activities later
  const [userInfo, setUserInfo] = useState(null);

  // Load user info from localStorage on component mount
  useEffect(() => {
    console.log("[Dashboard useEffect] Running effect to load user info."); // Log effect start
    const storedUser = localStorage.getItem("stravaAthlete");
    console.log("[Dashboard useEffect] Stored user string:", storedUser);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log("[Dashboard useEffect] Parsed user info:", parsedUser);
        setUserInfo(parsedUser);
      } catch (e) {
        console.error(
          "[Dashboard useEffect] Error parsing user info from localStorage",
          e
        );
        localStorage.removeItem("stravaAthlete");
        setSyncStatus("Error: Corrupted user data. Please log in again.");
      }
    } else {
      console.log("[Dashboard useEffect] No user info found in localStorage.");
    }
  }, []); // Empty dependency array means this runs once on mount

  // --- Function Definition ---
  const handleSyncActivities = async () => {
    // --- ADDED LOG ---
    console.log("[handleSyncActivities] Function started.");

    // --- ADDED LOG ---
    console.log("[handleSyncActivities] Checking userInfo:", userInfo);
    console.log(
      "[handleSyncActivities] Checking userInfo.appUserId:",
      userInfo?.appUserId // Use optional chaining just in case userInfo is null/undefined
    );

    // Check if user info or the specific ID needed for the backend is missing
    if (!userInfo || !userInfo.appUserId) {
      // --- ADDED LOG ---
      console.log(
        "[handleSyncActivities] Exiting early: userInfo or appUserId is missing."
      );
      setSyncStatus(
        "Error: User information (including App User ID) not found. Please log in again."
      );
      return; // Exit the function
    }

    // --- ADDED LOG ---
    console.log("[handleSyncActivities] Proceeding with sync...");
    setIsLoading(true);
    setSyncStatus("Syncing activities with Strava...");
    setActivities([]);

    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";

      // --- ADDED LOG ---
      console.log(
        `[handleSyncActivities] Sending POST to ${backendUrl}/api/strava/sync with User ID: ${userInfo.appUserId}`
      );

      const response = await axios.post(
        `${backendUrl}/api/strava/sync`,
        {}, // Sending empty body, User ID is in header
        {
          headers: {
            "X-User-ID": userInfo.appUserId, // Pass the internal app user ID
          },
        }
      );

      // --- ADDED LOG ---
      console.log("[handleSyncActivities] Sync API Response:", response.data);
      setSyncStatus(
        `Sync successful! ${response.data.activitiesStored} activities synced.`
      );
      // Optional: Fetch and display the activities immediately after sync
      // fetchStoredActivities();
    } catch (error) {
      // --- ADDED LOG ---
      console.error(
        "[handleSyncActivities] Error syncing Strava activities:",
        error.response?.data || error.message,
        error // Log the full error object
      );
      setSyncStatus(
        `Sync failed: ${error.response?.data?.message || error.message}`
      );
    } finally {
      // --- ADDED LOG ---
      console.log("[handleSyncActivities] Setting isLoading to false.");
      setIsLoading(false);
    }
  };
  // --- End of Function Definition ---

  // Log current state right before rendering return statement
  console.log("[Dashboard Render] Current userInfo state:", userInfo);
  console.log("[Dashboard Render] Current isLoading state:", isLoading);

  if (!userInfo) {
    console.log(
      "[Dashboard Render] Rendering loading message because userInfo is null/falsy."
    );
    return <p>Loading user information or user not logged in...</p>;
  }

  // The return statement uses the function defined above
  return (
    <div>
      <h2>Dashboard</h2>
      <p>Welcome, {userInfo.firstname}!</p>
      {/* --- ADDED LOG TO onClick --- */}
      <button
        onClick={(e) => {
          console.log("[Dashboard Button] Click event fired!");
          handleSyncActivities(); // Call the actual handler
        }}
        disabled={isLoading}
      >
        {isLoading ? "Syncing..." : "Sync Strava Activities"}
      </button>
      {syncStatus && <p>{syncStatus}</p>}

      {/* TODO: Add section to display activities fetched from your DB */}
      {/* <h3>Your Recent Activities</h3> */}
      {/* {activities.length > 0 ? (<ul>...map activities...</ul>) : (<p>No activities loaded yet.</p>)} */}
    </div>
  );
};

export default Dashboard;
