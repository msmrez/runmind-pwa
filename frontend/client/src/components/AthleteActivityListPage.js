// In frontend/src/components/AthleteActivityListPage.js

import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import apiClient from "../api";

// --- Helper Functions (Keep or move to utils) ---
const formatDate = (dateString) => {
  // ... (same as before)
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return "Invalid Date";
  }
};

// --- Style Objects (or use CSS classes) ---
const styles = {
  pageContainer: {
    padding: "20px",
    maxWidth: "950px", // Slightly wider max width
    margin: "20px auto", // Add top/bottom margin
    fontFamily: "Arial, sans-serif", // Example font
    backgroundColor: "#f4f7f6", // Light background for the page area
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  backLink: {
    marginBottom: "20px", // More space below link
    display: "inline-block",
    color: "#007bff",
    textDecoration: "none",
  },
  pageTitle: {
    marginTop: 0,
    marginBottom: "25px", // More space below title
    color: "#333",
    borderBottom: "1px solid #eee",
    paddingBottom: "10px",
  },
  loadingText: {
    textAlign: "center",
    padding: "40px",
    fontSize: "1.1em",
    color: "#666",
  },
  errorText: {
    color: "red",
    backgroundColor: "#ffebee",
    border: "1px solid red",
    padding: "15px",
    borderRadius: "5px",
    marginTop: "20px",
  },
  activityList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  activityListItem: {
    backgroundColor: "#ffffff", // White card background
    border: "1px solid #e0e0e0",
    padding: "15px 20px", // Adjust padding
    marginBottom: "15px", // More space between items
    borderRadius: "6px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    transition: "box-shadow 0.2s ease-in-out", // Subtle hover effect
  },
  // Add hover style example (if not using CSS classes)
  // activityListItemHover: { // Would need onMouseEnter/Leave to apply
  //   boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
  // },
  activityTitle: {
    marginTop: 0,
    marginBottom: "8px", // Less space below title
    color: "#2c3e50", // Darker title color
    fontSize: "1.2em",
  },
  activityDate: {
    margin: "0 0 15px 0", // Space below date
    fontSize: "0.9em",
    color: "#7f8c8d", // Muted color for date
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", // Adjust min width
    gap: "12px 18px",
    marginTop: "10px",
    fontSize: "0.95em",
    paddingTop: "10px",
    borderTop: "1px solid #f0f0f0", // Light separator line
  },
  statItem: {
    padding: "5px 0", // Add some vertical padding
  },
  statLabel: {
    fontWeight: "bold",
    color: "#34495e", // Slightly darker label color
    marginRight: "5px",
  },
  mentalStateSection: {
    marginTop: "18px",
    padding: "12px 15px", // Adjust padding
    borderTop: "1px dashed #ccc",
    fontSize: "0.9em",
    backgroundColor: "#f8f9fa", // Slightly different background
    borderRadius: "4px",
    color: "#555",
  },
  mentalStateTitle: {
    color: "#333",
    fontWeight: "bold",
    display: "block",
    marginBottom: "8px",
    fontSize: "1.05em",
  },
  mentalStateItem: {
    marginRight: "15px",
    display: "inline-block", // Display items inline
  },
  mentalNotes: {
    marginTop: "8px",
    marginBottom: 0,
    whiteSpace: "pre-wrap",
    fontStyle: "italic",
    borderLeft: "3px solid #bdc3c7", // Muted color for border
    paddingLeft: "10px",
    lineHeight: "1.4",
  },
};
// --- End Style Objects ---

const AthleteActivityListPage = () => {
  const { athleteId } = useParams();
  const location = useLocation();
  const athleteName = location.state?.athleteName || `Athlete ID: ${athleteId}`;

  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchActivities = useCallback(async () => {
    // ... (fetch logic remains the same) ...
    if (!athleteId) {
      setError("Athlete ID missing.");
      setIsLoading(false);
      return;
    }
    console.log(`[AthleteActivityList] Fetching for ${athleteId}...`);
    setIsLoading(true);
    setError("");
    try {
      const response = await apiClient.get(
        `/api/coaches/athletes/${athleteId}/activities`
      );
      setActivities(response.data || []);
    } catch (err) {
      console.error("[AthleteActivityList] Error:", err);
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError(
          `Failed to load activities: ${
            err.response?.data?.message || err.message
          }`
        );
      } else if (err.response?.status === 403) {
        setError("Permission denied.");
      } // Note: 401 should be handled by interceptor redirect
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // --- Rendering with Styles ---
  return (
    <div style={styles.pageContainer}>
      <Link to="/coach/dashboard" style={styles.backLink}>
        ← Back to Coach Dashboard
      </Link>

      <h2 style={styles.pageTitle}>{athleteName}'s Activities</h2>

      {/* Loading State */}
      {isLoading && <p style={styles.loadingText}>Loading activities...</p>}

      {/* Error State */}
      {error && <div style={styles.errorText}>{error}</div>}

      {/* Activities List */}
      {!isLoading && !error && (
        <div>
          {activities.length === 0 ? (
            <p style={styles.loadingText}>
              No activities found for this athlete.
            </p> // Reuse loading style for empty message
          ) : (
            <ul style={styles.activityList}>
              {activities.map((act) => (
                <li key={act.activity_id} style={styles.activityListItem}>
                  <h4 style={styles.activityTitle}>
                    {act.name || `Activity ${act.activity_id}`} (
                    {act.type || "Unknown"})
                  </h4>
                  <p style={styles.activityDate}>
                    {formatDate(act.start_date_local)}
                  </p>
                  {/* Stats Grid */}
                  <div style={styles.statsGrid}>
                    <div
                      style={styles.statItem}
                      title={`Distance: ${act.distance} meters`}
                    >
                      <span style={styles.statLabel}>Dist:</span>{" "}
                      {act.distance_km || "N/A"} km
                    </div>
                    <div
                      style={styles.statItem}
                      title={`Moving Time: ${act.moving_time} seconds`}
                    >
                      <span style={styles.statLabel}>Time:</span>{" "}
                      {act.moving_time_formatted}
                    </div>
                    <div style={styles.statItem}>
                      <span style={styles.statLabel}>Pace:</span>{" "}
                      {act.pace_per_km}
                    </div>
                    <div
                      style={styles.statItem}
                      title={`Avg HR: ${act.average_heartrate}`}
                    >
                      <span style={styles.statLabel}>Avg HR:</span>{" "}
                      {act.average_heartrate_formatted}
                    </div>
                    <div
                      style={styles.statItem}
                      title={`Max HR: ${act.max_heartrate}`}
                    >
                      <span style={styles.statLabel}>Max HR:</span>{" "}
                      {act.max_heartrate
                        ? `${act.max_heartrate.toFixed(0)} bpm`
                        : "N/A"}
                    </div>
                    <div
                      style={styles.statItem}
                      title={`Elevation Gain: ${act.total_elevation_gain} meters`}
                    >
                      <span style={styles.statLabel}>Elev Gain:</span>{" "}
                      {act.total_elevation_gain !== null &&
                      !isNaN(act.total_elevation_gain)
                        ? `${act.total_elevation_gain.toFixed(0)} m`
                        : "N/A"}
                    </div>
                    {/* Add calories back if you add the column to DB later */}
                    {/* <div style={styles.statItem}>
                       <span style={styles.statLabel}>Calories:</span> {act.calories || 'N/A'}
                     </div> */}
                  </div>
                  {/* Mental State Section */}
                  {(act.mental_mood ||
                    act.mental_focus ||
                    act.mental_stress ||
                    act.mental_notes) && (
                    <div style={styles.mentalStateSection}>
                      <span style={styles.mentalStateTitle}>
                        Athlete's Log:
                      </span>
                      <span style={styles.mentalStateItem}>
                        {act.mental_mood ? `Mood: ${act.mental_mood}/5` : ""}
                      </span>
                      <span style={styles.mentalStateItem}>
                        {act.mental_focus ? `Focus: ${act.mental_focus}/5` : ""}
                      </span>
                      <span style={styles.mentalStateItem}>
                        {act.mental_stress
                          ? `Stress: ${act.mental_stress}/5`
                          : ""}
                      </span>
                      {act.mental_notes && (
                        <p style={styles.mentalNotes}>"{act.mental_notes}"</p>
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

export default AthleteActivityListPage;
