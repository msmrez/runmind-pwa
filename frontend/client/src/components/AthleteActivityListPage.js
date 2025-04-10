// Create this file: frontend/src/components/AthleteActivityListPage.js

import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useLocation } from "react-router-dom"; // Import hooks/components
import apiClient from "../api"; // Use your centralized API client

// Helper function to format Date (can be moved to utils if needed)
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    // Using undefined for locale uses the browser's default
    return new Date(dateString).toLocaleString(undefined, {
      dateStyle: "medium", // e.g., "Jan 1, 2024"
      timeStyle: "short", // e.g., "10:30 AM"
    });
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return "Invalid Date";
  }
};

const AthleteActivityListPage = () => {
  const { athleteId } = useParams(); // Get athleteId from the URL parameter (e.g., /coach/athlete/123)
  const location = useLocation(); // Get location object, contains state passed from Link
  // Get athlete's name from state passed via Link, fallback to ID
  const athleteName = location.state?.athleteName || `Athlete ID: ${athleteId}`;

  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch activities for this specific athlete using useCallback for stable dependency
  const fetchActivities = useCallback(async () => {
    if (!athleteId) {
      setError("Athlete ID missing from URL.");
      setIsLoading(false);
      return;
    }
    console.log(
      `[AthleteActivityList] Attempting to fetch activities for athlete ${athleteId}...`
    );
    setIsLoading(true);
    setError(""); // Clear previous errors
    try {
      // Call the backend endpoint using the configured apiClient
      const response = await apiClient.get(
        `/api/coaches/athletes/${athleteId}/activities` // Endpoint we defined in backend
      );
      setActivities(response.data || []); // Set state with fetched data, default to empty array
      console.log(
        `[AthleteActivityList] Successfully received ${
          response.data?.length || 0
        } activities.`
      );
    } catch (err) {
      // Error handling - interceptor might handle 401/403 redirect already
      console.error(
        "[AthleteActivityList] Error fetching activities:",
        err.response?.data || err.message
      );
      // Set local error state unless it's a 401/403 handled by interceptor
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError(
          `Failed to load activities: ${
            err.response?.data?.message || err.message
          }`
        );
      } else if (err.response?.status === 403) {
        // Specific message for permission denied if interceptor doesn't redirect
        setError("Permission denied to view these activities.");
      }
      setActivities([]); // Clear activities on error
    } finally {
      setIsLoading(false); // Ensure loading indicator stops
    }
  }, [athleteId]); // Re-run effect if athleteId changes

  // useEffect hook to trigger the fetch when the component mounts or athleteId changes
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]); // Dependency array includes the memoized fetch function

  // --- Rendering Logic ---
  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "auto" }}>
      {/* Navigation link back to the Coach Dashboard */}
      <Link
        to="/coach/dashboard" // The route defined in App.js for CoachDashboard
        style={{ marginBottom: "15px", display: "inline-block" }}
      >
        ← Back to Coach Dashboard
      </Link>

      {/* Display Athlete Name passed via route state */}
      <h2>{athleteName}'s Activities</h2>

      {/* Loading State Indicator */}
      {isLoading && <p>Loading activities...</p>}

      {/* Error Message Display */}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {/* Display the list of activities if not loading and no error */}
      {!isLoading && !error && (
        <div>
          {activities.length === 0 ? (
            <p>No activities found for this athlete.</p> // Message for empty list
          ) : (
            // Use an unordered list for semantic structure
            <ul style={{ listStyle: "none", padding: 0 }}>
              {activities.map((act) => (
                // List item for each activity
                <li
                  key={act.activity_id} // Use the unique activity_id from DB as key
                  style={{
                    border: "1px solid #ddd", // Slightly softer border
                    padding: "15px",
                    marginBottom: "10px",
                    borderRadius: "5px",
                    backgroundColor: "#fff", // White background
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)", // Subtle shadow
                  }}
                >
                  {/* Activity Title and Type */}
                  <h4
                    style={{
                      marginTop: 0,
                      marginBottom: "10px",
                      color: "#333",
                    }}
                  >
                    {act.name || `Activity ${act.activity_id}`} (
                    {act.type || "Unknown Type"})
                  </h4>
                  {/* Activity Date */}
                  <p
                    style={{
                      margin: "5px 0",
                      fontSize: "0.9em",
                      color: "#555",
                    }}
                  >
                    <strong>Date:</strong> {formatDate(act.start_date_local)}
                  </p>
                  {/* Grid for Key Metrics */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(130px, 1fr))", // Adjust min width as needed
                      gap: "10px 15px", // Row and column gap
                      marginTop: "10px",
                      fontSize: "0.95em",
                    }}
                  >
                    {/* Display key metrics using formatted values from backend */}
                    <div title={`Distance: ${act.distance} meters`}>
                      {" "}
                      {/* Add title for raw data */}
                      <strong>Dist:</strong> {act.distance_km || "N/A"} km
                    </div>
                    <div title={`Moving Time: ${act.moving_time} seconds`}>
                      <strong>Time:</strong> {act.moving_time_formatted}
                    </div>
                    <div>
                      <strong>Pace:</strong> {act.pace_per_km}
                    </div>
                    <div title={`Avg HR: ${act.average_heartrate}`}>
                      <strong>Avg HR:</strong> {act.average_heartrate_formatted}
                    </div>
                    <div
                      title={`Elevation Gain: ${act.total_elevation_gain} meters`}
                    >
                      <strong>Elev Gain:</strong>{" "}
                      {act.total_elevation_gain !== null &&
                      !isNaN(act.total_elevation_gain)
                        ? `${act.total_elevation_gain.toFixed(0)} m`
                        : "N/A"}
                    </div>
                    {/* Add max HR, calories etc. if desired and available */}
                    <div title={`Max HR: ${act.max_heartrate}`}>
                      <strong>Max HR:</strong>{" "}
                      {act.max_heartrate
                        ? `${act.max_heartrate.toFixed(0)} bpm`
                        : "N/A"}
                    </div>
                    <div>
                      <strong>Calories:</strong> {act.calories || "N/A"}
                    </div>
                  </div>
                  {/* Display Mental State (Read-only for coach) */}
                  {(act.mental_mood ||
                    act.mental_focus ||
                    act.mental_stress ||
                    act.mental_notes) && (
                    <div
                      style={{
                        marginTop: "15px",
                        paddingTop: "10px",
                        borderTop: "1px dashed #ccc",
                        fontSize: "0.9em",
                        color: "#666", // Slightly darker than default text
                        backgroundColor: "#fafafa", // Subtle background
                        padding: "8px",
                        borderRadius: "3px",
                      }}
                    >
                      <strong
                        style={{
                          color: "#444",
                          display: "block",
                          marginBottom: "5px",
                        }}
                      >
                        Athlete's Mental State Log:
                      </strong>
                      <span style={{ marginRight: "10px" }}>
                        {act.mental_mood ? `Mood: ${act.mental_mood}/5` : ""}
                      </span>
                      <span style={{ marginRight: "10px" }}>
                        {act.mental_focus ? `Focus: ${act.mental_focus}/5` : ""}
                      </span>
                      <span>
                        {act.mental_stress
                          ? `Stress: ${act.mental_stress}/5`
                          : ""}
                      </span>
                      {act.mental_notes && (
                        <p
                          style={{
                            marginTop: "8px",
                            marginBottom: 0,
                            whiteSpace: "pre-wrap", // Preserve line breaks/spacing
                            fontStyle: "italic",
                            borderLeft: "3px solid #eee",
                            paddingLeft: "8px",
                          }}
                        >
                          "{act.mental_notes}"
                        </p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default AthleteActivityListPage; // Ensure default export
