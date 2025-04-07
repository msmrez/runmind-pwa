// src/components/Dashboard.js
import React, { useState, useEffect } from "react";
import axios from "axios";

// --- Mental State Logger Component (with Debugging Logs) ---
const MentalStateLogger = ({ activity, onSave, userId }) => {
  const [isLogging, setIsLogging] = useState(false);
  const [mood, setMood] = useState(activity.mental_mood ?? "");
  const [focus, setFocus] = useState(activity.mental_focus ?? "");
  const [stress, setStress] = useState(activity.mental_stress ?? "");
  const [notes, setNotes] = useState(activity.mental_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // --- ADDED Log when state changes ---
  useEffect(() => {
    // Add activity_id to make logs specific if multiple loggers are open (unlikely here, but good practice)
    console.log(
      `%c[MSL Activity ${activity.activity_id}] isLogging state changed to: ${isLogging}`,
      "color: blue; font-weight: bold;"
    );
  }, [isLogging, activity.activity_id]); // Log when isLogging changes

  // Effect to update local form state if the activity data changes from the parent
  useEffect(() => {
    setMood(activity.mental_mood ?? "");
    setFocus(activity.mental_focus ?? "");
    setStress(activity.mental_stress ?? "");
    setNotes(activity.mental_notes ?? "");
    console.log(
      `%c[MSL Activity ${activity.activity_id}] Props updated, resetting form state.`,
      "color: purple;"
    );
  }, [
    activity.mental_mood,
    activity.mental_focus,
    activity.mental_stress,
    activity.mental_notes,
    activity.activity_id,
  ]); // Added activity_id dependency

  // Function to handle saving the mental state data
  const handleSave = async () => {
    setError("");
    setSaving(true);
    const dataToSend = {
      mood: mood === "" ? null : parseInt(mood, 10),
      focus: focus === "" ? null : parseInt(focus, 10),
      stress: stress === "" ? null : parseInt(stress, 10),
      notes: notes.trim() === "" ? null : notes.trim(),
    };
    const isValidScaleValue = (val) =>
      val === null || (Number.isInteger(val) && val >= 1 && val <= 5);
    if (
      !isValidScaleValue(dataToSend.mood) ||
      !isValidScaleValue(dataToSend.focus) ||
      !isValidScaleValue(dataToSend.stress)
    ) {
      setError("Mood, Focus, Stress must be 1-5 or blank.");
      setSaving(false);
      return;
    }
    console.log(
      `%c[MSL Activity ${activity.activity_id}] Saving data:`,
      "color: green;",
      dataToSend
    );
    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      const response = await axios.post(
        `${backendUrl}/api/activities/${activity.activity_id}/mental_state`,
        dataToSend,
        { headers: { "X-User-ID": userId } }
      );
      console.log(
        `%c[MSL Activity ${activity.activity_id}] Save response:`,
        "color: green;",
        response.data
      );
      onSave(activity.activity_id, response.data.updatedState);
      setIsLogging(false);
    } catch (err) {
      console.error(
        `[MSL Activity ${activity.activity_id}] Error saving:`,
        err.response?.data || err.message
      );
      setError(`Save failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // --- ADDED Log before rendering button/form check ---
  console.log(
    `%c[MSL Activity ${activity.activity_id}] Rendering. isLogging: ${isLogging}`,
    "color: gray;"
  );

  if (!isLogging) {
    // --- ADDED Log inside the IF block (Rendering Button) ---
    console.log(
      `%c[MSL Activity ${activity.activity_id}] Rendering Button.`,
      "color: gray;"
    );
    return (
      <button
        onClick={() => {
          // --- ADDED Log inside onClick ---
          console.log(
            `%c[MSL Activity ${activity.activity_id}] Button clicked. Setting isLogging to true.`,
            "color: orange; font-weight: bold;"
          );
          setIsLogging(true); // Update state to show the form
        }}
        style={{ fontSize: "0.8em", padding: "2px 5px" }}
      >
        {activity.mental_mood ||
        activity.mental_focus ||
        activity.mental_stress ||
        activity.mental_notes
          ? "Edit State"
          : "Log State"}
      </button>
    );
  }

  // If isLogging is true, render the form
  // --- ADDED Log just before rendering FORM ---
  console.log(
    `%c[MSL Activity ${activity.activity_id}] Rendering Form.`,
    "color: teal; font-weight: bold;"
  );
  // --- ADDED Log for current form state values ---
  console.log(
    `%c[MSL Activity ${
      activity.activity_id
    }] Current form state: mood=${mood}, focus=${focus}, stress=${stress}, notes=${
      notes === "" ? '""' : `"${notes}"`
    }`,
    "color: teal;"
  );

  return (
    <div
      style={{
        padding: "10px",
        border: "1px solid #ddd",
        margin: "5px 0",
        backgroundColor: "#f9f9f9",
        fontSize: "0.9em",
      }}
    >
      <div>
        <label
          style={{ marginRight: "5px", display: "inline-block", width: "50px" }}
        >
          Mood:
        </label>
        <input
          type="number"
          placeholder="(1-5)"
          min="1"
          max="5"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          style={{ width: "55px" }}
        />
      </div>
      <div style={{ marginTop: "5px" }}>
        <label
          style={{ marginRight: "5px", display: "inline-block", width: "50px" }}
        >
          Focus:
        </label>
        <input
          type="number"
          placeholder="(1-5)"
          min="1"
          max="5"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          style={{ width: "55px" }}
        />
      </div>
      <div style={{ marginTop: "5px" }}>
        <label
          style={{ marginRight: "5px", display: "inline-block", width: "50px" }}
        >
          Stress:
        </label>
        <input
          type="number"
          placeholder="(1-5)"
          min="1"
          max="5"
          value={stress}
          onChange={(e) => setStress(e.target.value)}
          style={{ width: "55px" }}
        />
      </div>
      <div style={{ marginTop: "5px" }}>
        <label>Notes:</label>
        <br />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows="2"
          placeholder="Optional notes..."
          style={{ width: "95%", marginTop: "2px", fontSize: "1em" }}
        />
      </div>
      {error && (
        <p style={{ color: "red", fontSize: "0.9em", margin: "5px 0 0 0" }}>
          {error}
        </p>
      )}
      <div style={{ marginTop: "8px" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ marginRight: "5px" }}
        >
          {saving ? "Saving..." : "Save State"}
        </button>
        <button
          onClick={() => {
            console.log(
              `%c[MSL Activity ${activity.activity_id}] Cancel clicked. Setting isLogging to false.`,
              "color: orange;"
            );
            setIsLogging(false);
            setError("");
          }}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
// --- End Mental State Logger Component ---

// --- Main Dashboard Component ---
const Dashboard = () => {
  // --- State Variables (same as before) ---
  const [syncStatus, setSyncStatus] = useState("");
  const [isLoadingSync, setIsLoadingSync] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [activities, setActivities] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [activitiesError, setActivitiesError] = useState("");
  const [insights, setInsights] = useState([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState("");

  // --- Handlers & Fetch Functions (same as before) ---
  const handleMentalStateUpdate = (activityId, updatedState) => {
    console.log(
      `%c[Dashboard] handleMentalStateUpdate called for activity ${activityId}`,
      "color: green;",
      updatedState
    );
    setActivities((currentActivities) =>
      currentActivities.map((act) =>
        act.activity_id === activityId ? { ...act, ...updatedState } : act
      )
    );
    if (userInfo?.appUserId) {
      fetchInsights(userInfo.appUserId);
    }
  };

  const fetchStoredActivities = async (userId) => {
    if (!userId) return;
    console.log(`[Dashboard] fetchStoredActivities for user: ${userId}`);
    setIsLoadingActivities(true);
    setActivitiesError("");
    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      const response = await axios.get(`${backendUrl}/api/activities`, {
        headers: { "X-User-ID": userId },
      });
      setActivities(response.data || []);
      console.log(
        `[Dashboard] fetchStoredActivities Success for user: ${userId}. Count: ${
          response.data?.length || 0
        }`
      );
    } catch (error) {
      console.error(
        "[Dashboard] fetchStoredActivities Error:",
        error.response?.data || error.message
      );
      setActivitiesError(
        `Failed load activities: ${
          error.response?.data?.message || error.message
        }`
      );
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const fetchInsights = async (userId) => {
    if (!userId) return;
    console.log(`[Dashboard] fetchInsights for user: ${userId}`);
    setIsLoadingInsights(true);
    setInsightsError("");
    setInsights([]);
    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      const response = await axios.get(`${backendUrl}/api/insights`, {
        headers: { "X-User-ID": userId },
      });
      setInsights(response.data.insights || []);
      console.log(
        `[Dashboard] fetchInsights Success for user: ${userId}. Count: ${
          response.data?.insights?.length || 0
        }`
      );
    } catch (error) {
      console.error(
        "[Dashboard] fetchInsights Error:",
        error.response?.data || error.message
      );
      setInsightsError(
        `Failed load insights: ${
          error.response?.data?.message || error.message
        }`
      );
      setInsights([]);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const handleSyncActivities = async () => {
    if (!userInfo || !userInfo.appUserId) {
      setSyncStatus("User info missing.");
      return;
    }
    console.log(
      `[Dashboard] handleSyncActivities triggered for user: ${userInfo.appUserId}`
    );
    setIsLoadingSync(true);
    setSyncStatus("Syncing...");
    setActivitiesError("");
    setInsightsError("");
    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      const response = await axios.post(
        `${backendUrl}/api/strava/sync`,
        {},
        { headers: { "X-User-ID": userInfo.appUserId } }
      );
      setSyncStatus(
        `Sync successful! ${response.data.activitiesStored} activities processed.`
      );
      // Fetch updated data after sync
      fetchStoredActivities(userInfo.appUserId);
      fetchInsights(userInfo.appUserId);
    } catch (error) {
      console.error(
        "[Dashboard] handleSyncActivities Error:",
        error.response?.data || error.message
      );
      setSyncStatus(
        `Sync failed: ${error.response?.data?.message || error.message}`
      );
    } finally {
      setIsLoadingSync(false);
    }
  };

  // --- useEffect (same as before) ---
  useEffect(() => {
    console.log("[Dashboard] Mount effect running.");
    const storedUser = localStorage.getItem("stravaAthlete");
    let userIdToFetch = null;
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed?.appUserId) {
          setUserInfo(parsed);
          userIdToFetch = parsed.appUserId;
        } else {
          console.error(
            "[Dashboard Mount] appUserId missing in stored user data."
          );
          localStorage.removeItem("stravaAthlete");
        }
      } catch (e) {
        console.error("[Dashboard Mount] Error parsing stored user data.", e);
        localStorage.removeItem("stravaAthlete");
      }
    } else {
      console.log("[Dashboard Mount] No stored user found.");
    }
    if (userIdToFetch) {
      fetchStoredActivities(userIdToFetch);
      fetchInsights(userIdToFetch);
    }
  }, []); // Runs once on mount

  // Format date helper (same as before)
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "Invalid Date";
    }
  };

  // Render loading state
  if (!userInfo) {
    return <p>Loading user information...</p>;
  }

  // --- Main JSX Rendering for Dashboard ---
  return (
    <div>
      <h2>Dashboard</h2>
      <p>Welcome, {userInfo.firstname}!</p>
      <button onClick={handleSyncActivities} disabled={isLoadingSync}>
        {isLoadingSync ? "Syncing..." : "Sync Strava Activities"}
      </button>
      {syncStatus && <p style={{ fontStyle: "italic" }}>{syncStatus}</p>}

      {/* Insights Section (same as before) */}
      <div
        style={{
          border: "1px solid #eee",
          padding: "15px",
          margin: "20px 0",
          backgroundColor: "#f8f9fa",
        }}
      >
        <h4>Quick Insights</h4>
        {isLoadingInsights && <p>Generating insights...</p>}
        {insightsError && <p style={{ color: "red" }}>{insightsError}</p>}
        {!isLoadingInsights && !insightsError && insights.length > 0 && (
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {insights.map((insight, index) => (
              <li key={index} style={{ marginBottom: "8px" }}>
                {insight}
              </li>
            ))}
          </ul>
        )}
        {!isLoadingInsights && !insightsError && insights.length === 0 && (
          <p>Not enough data for insights yet.</p>
        )}
      </div>

      <h3>Your Recent Activities</h3>
      {isLoadingActivities && <p>Loading activities...</p>}
      {activitiesError && <p style={{ color: "red" }}>{activitiesError}</p>}
      {!isLoadingActivities && activities.length === 0 && !activitiesError && (
        <p>No activities found.</p>
      )}

      {/* Activity Table */}
      {!isLoadingActivities && activities.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9em",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>
              <th>Date</th>
              <th>Name</th>
              <th>Type</th>
              <th>Distance (km)</th>
              <th>Time</th>
              <th>Pace (/km)</th>
              <th>Mental State</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr
                key={activity.activity_id}
                style={{ borderBottom: "1px solid #eee", verticalAlign: "top" }}
              >
                <td>{formatDate(activity.start_date_local)}</td>
                <td>{activity.name}</td>
                <td>{activity.type}</td>
                <td>{activity.distance_km}</td>
                <td>{activity.moving_time_formatted}</td>
                <td>{activity.pace_per_km || "N/A"}</td>
                <td>
                  {" "}
                  {/* Mental State Display */}
                  {activity.mental_mood && (
                    <div style={{ whiteSpace: "nowrap" }}>
                      Mood: {activity.mental_mood}/5
                    </div>
                  )}
                  {activity.mental_focus && (
                    <div style={{ whiteSpace: "nowrap" }}>
                      Focus: {activity.mental_focus}/5
                    </div>
                  )}
                  {activity.mental_stress && (
                    <div style={{ whiteSpace: "nowrap" }}>
                      Stress: {activity.mental_stress}/5
                    </div>
                  )}
                  {activity.mental_notes && (
                    <div
                      style={{
                        fontSize: "0.9em",
                        color: "#555",
                        marginTop: "3px",
                        wordBreak: "break-word",
                      }}
                    >
                      Notes: {activity.mental_notes}
                    </div>
                  )}
                  {!activity.mental_mood &&
                    !activity.mental_focus &&
                    !activity.mental_stress &&
                    !activity.mental_notes && (
                      <span style={{ color: "#888", fontSize: "0.9em" }}>
                        (Not logged)
                      </span>
                    )}
                </td>
                <td>
                  {" "}
                  {/* Action Cell */}
                  <MentalStateLogger
                    activity={activity}
                    onSave={handleMentalStateUpdate}
                    userId={userInfo.appUserId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Dashboard;
