// src/components/ActivityDetail.js
import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom"; // Import Link for back navigation
import axios from "axios";
import MentalStateLogger from "./MentalStateLogger";
// Import the MentalStateLogger - assuming it might be slightly adjusted or reused
// If MentalStateLogger is tightly coupled to the Dashboard table, you might need
// to extract it into its own file or duplicate/modify its logic here.
// Let's assume we can reuse it for now.
const ActivityDetail = () => {
  // Get the activityId from the URL parameter (defined in App.js route)
  const { activityId } = useParams();
  const [activity, setActivity] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [userInfo, setUserInfo] = useState(null); // Need user info for logger

  // Fetch user info from localStorage (needed for MentalStateLogger's userId prop)
  useEffect(() => {
    const storedUser = localStorage.getItem("stravaAthlete");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed.appUserId) {
          setUserInfo(parsed);
        } else {
          setError("User session invalid. Please log in again.");
        }
      } catch (e) {
        setError("Error reading user session.");
        localStorage.removeItem("stravaAthlete");
      }
    } else {
      setError("User not logged in.");
      // Redirect? Or just show error. For now, show error.
    }
  }, []);

  // Fetch the specific activity data when the component mounts or activityId changes
  useEffect(() => {
    // Don't fetch if user info failed to load
    if (!userInfo || !activityId) {
      setIsLoading(false); // Stop loading if we can't fetch
      return;
    }

    const fetchActivity = async () => {
      setIsLoading(true);
      setError("");
      console.log(
        `[ActivityDetail] Fetching activity ${activityId} for user ${userInfo.appUserId}`
      );
      try {
        const backendUrl =
          process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
        const response = await axios.get(
          `${backendUrl}/api/activities/${activityId}`,
          {
            headers: { "X-User-ID": userInfo.appUserId }, // Send auth
          }
        );
        setActivity(response.data);
      } catch (err) {
        console.error(
          "[ActivityDetail] Error fetching activity:",
          err.response?.data || err.message
        );
        setError(
          `Failed to load activity: ${
            err.response?.data?.message || err.message
          }`
        );
        setActivity(null); // Clear activity data on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [activityId, userInfo]); // Re-fetch if activityId or userInfo changes

  // Handler to update the local activity state after mental state is saved
  // This is simpler than the Dashboard one as we only have one activity in state
  const handleMentalStateUpdate = (id, updatedState) => {
    console.log(
      `[ActivityDetail] handleMentalStateUpdate called for activity ${id}`,
      updatedState
    );
    // Update the single activity in state
    setActivity((currentActivity) => ({
      ...currentActivity,
      ...updatedState, // Merge the updated fields
    }));
    // Optionally show a success message or refetch insights if they were displayed here
  };

  // --- Helper Functions for Display ---
  const formatStat = (value, unit = "") => {
    if (value === null || value === undefined) return "N/A";
    return `${value}${unit}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch (e) {
      return "Invalid Date";
    }
  };
  // --- End Helper Functions ---

  // --- Rendering Logic ---
  if (isLoading) {
    return <p>Loading activity details...</p>;
  }

  if (error) {
    return (
      <div style={{ padding: "20px" }}>
        <p style={{ color: "red" }}>Error: {error}</p>
        <Link to="/dashboard">Back to Dashboard</Link>
      </div>
    );
  }

  if (!activity) {
    // This case might occur briefly or if fetch failed without specific error message
    return (
      <div style={{ padding: "20px" }}>
        <p>Activity data not available.</p>
        <Link to="/dashboard">Back to Dashboard</Link>
      </div>
    );
  }

  // Display activity details once loaded
  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "auto" }}>
      <Link
        to="/dashboard"
        style={{ marginBottom: "15px", display: "inline-block" }}
      >
        ← Back to Dashboard
      </Link>

      <h2>{activity.name}</h2>
      <p>
        <strong>Date:</strong> {formatDate(activity.start_date_local)} (
        {activity.timezone})
      </p>
      <p>
        <strong>Type:</strong> {activity.type}
      </p>

      {/* Basic Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "15px",
          margin: "20px 0",
        }}
      >
        <div className="stat-card">
          {" "}
          {/* Use CSS classes later */}
          <div>
            <strong>Distance</strong>
          </div>
          <div>{formatStat(activity.distance_km, " km")}</div>
        </div>
        <div className="stat-card">
          <div>
            <strong>Moving Time</strong>
          </div>
          <div>{activity.moving_time_formatted}</div>
        </div>
        <div className="stat-card">
          <div>
            <strong>Pace</strong>
          </div>
          <div>{activity.pace_per_km || "N/A"}</div>
        </div>
        <div className="stat-card">
          <div>
            <strong>Elevation Gain</strong>
          </div>
          <div>
            {formatStat(activity.total_elevation_gain?.toFixed(0), " m")}
          </div>
        </div>
        <div className="stat-card">
          <div>
            <strong>Avg Heart Rate</strong>
          </div>
          <div>
            {formatStat(activity.average_heartrate?.toFixed(0), " bpm")}
          </div>
        </div>
        <div className="stat-card">
          <div>
            <strong>Max Heart Rate</strong>
          </div>
          <div>{formatStat(activity.max_heartrate?.toFixed(0), " bpm")}</div>
        </div>
        {/* Add more stats if needed: avg speed, max speed, elapsed time */}
      </div>

      {/* Map Placeholder */}
      <div
        style={{
          border: "1px dashed #ccc",
          height: "200px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#aaa",
          marginBottom: "20px",
        }}
      >
        Map Placeholder
      </div>

      {/* Mental State Section */}
      <div
        style={{
          border: "1px solid #eee",
          padding: "15px",
          backgroundColor: "#fdfdfd",
        }}
      >
        <h4>Mental State Log</h4>
        {/* Display currently saved state */}
        {!activity.mental_mood &&
          !activity.mental_focus &&
          !activity.mental_stress &&
          !activity.mental_notes && (
            <p style={{ color: "#888", fontStyle: "italic" }}>
              (Not logged yet)
            </p>
          )}
        {activity.mental_mood && (
          <p>
            <strong>Mood:</strong> {activity.mental_mood}/5
          </p>
        )}
        {activity.mental_focus && (
          <p>
            <strong>Focus:</strong> {activity.mental_focus}/5
          </p>
        )}
        {activity.mental_stress && (
          <p>
            <strong>Stress:</strong> {activity.mental_stress}/5
          </p>
        )}
        {activity.mental_notes && (
          <p>
            <strong>Notes:</strong>
            <br />
            {activity.mental_notes}
          </p>
        )}

        {/* Render the logger, passing this activity and the local update handler */}
        {userInfo && (
          <MentalStateLogger
            activity={activity}
            onSave={handleMentalStateUpdate}
            userId={userInfo.appUserId}
          />
        )}
      </div>
    </div>
  );
};

export default ActivityDetail;
