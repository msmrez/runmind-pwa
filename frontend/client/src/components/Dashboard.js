// src/components/Dashboard.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
// Assuming MentalStateLogger is in its own file now
import MentalStateLogger from "./MentalStateLogger";
import TrendsChart from "./TrendsChart";
import "./Dashboard.css";

const goalTypes = [
  { value: "weekly_distance", label: "Weekly Distance", unit: "km" },
  { value: "weekly_runs", label: "Weekly Runs", unit: "runs" },
  { value: "monthly_distance", label: "Monthly Distance", unit: "km" },
  { value: "monthly_runs", label: "Monthly Runs", unit: "runs" },
];

const Dashboard = () => {
  const navigate = useNavigate();

  // --- State Variables ---
  const [syncStatus, setSyncStatus] = useState("");
  const [isLoadingSync, setIsLoadingSync] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [activities, setActivities] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [activitiesError, setActivitiesError] = useState("");
  const [insights, setInsights] = useState([]); // Expecting array of strings
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [activeGoals, setActiveGoals] = useState([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);
  const [goalsError, setGoalsError] = useState("");

  // --- Handlers & Fetch Functions ---
  const handleMentalStateUpdate = (activityId, updatedState) => {
    setActivities((currentActivities) =>
      currentActivities.map((act) =>
        act.activity_id === activityId ? { ...act, ...updatedState } : act
      )
    );
    if (userInfo?.appUserId) {
      fetchInsights(userInfo.appUserId);
      fetchActiveGoals(userInfo.appUserId);
    }
  };

  const fetchStoredActivities = async (userId) => {
    if (!userId) {
      setActivitiesError("User ID missing.");
      return;
    }
    setIsLoadingActivities(true);
    setActivitiesError("");
    const backendUrl =
      process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
    const apiUrl = `${backendUrl}/api/activities`;
    try {
      const response = await axios.get(apiUrl, {
        headers: { "X-User-ID": userId },
      });
      setActivities(response.data || []);
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
    setIsLoadingInsights(true);
    setInsightsError("");
    setInsights([]);
    const backendUrl =
      process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
    const apiUrl = `${backendUrl}/api/insights`;
    try {
      const response = await axios.get(apiUrl, {
        headers: { "X-User-ID": userId },
      });
      // --- Ensure we store the array of strings ---
      setInsights(
        Array.isArray(response.data.insights) ? response.data.insights : []
      ); // Store the array directly
      console.log(
        `[Dashboard] fetchInsights Success user: ${userId}. Count: ${
          response.data?.insights?.length || 0
        }`
      );
    } catch (error) {
      console.error("[Dashboard] fetchInsights Error:", error);
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

  const fetchActiveGoals = async (userId) => {
    if (!userId) return;
    setIsLoadingGoals(true);
    setGoalsError("");
    setActiveGoals([]);
    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      const response = await axios.get(`${backendUrl}/api/goals`, {
        headers: { "X-User-ID": userId },
        params: { status: "active" },
      });
      setActiveGoals(response.data || []);
    } catch (error) {
      console.error("[Dashboard] Error fetching active goals:", error);
      setGoalsError(
        `Failed load active goals: ${
          error.response?.data?.message || error.message
        }`
      );
      setActiveGoals([]);
    } finally {
      setIsLoadingGoals(false);
    }
  };

  const handleSyncActivities = async () => {
    if (!userInfo || !userInfo.appUserId) {
      setSyncStatus("User info missing.");
      return;
    }
    setIsLoadingSync(true);
    setSyncStatus("Syncing...");
    setActivitiesError("");
    setInsightsError("");
    setGoalsError("");
    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      const apiUrl = `${backendUrl}/api/strava/sync`;
      const response = await axios.post(
        apiUrl,
        {},
        { headers: { "X-User-ID": userInfo.appUserId } }
      );
      setSyncStatus(
        `Sync successful! ${response.data.activitiesStored} processed.`
      );
      fetchStoredActivities(userInfo.appUserId);
      fetchInsights(userInfo.appUserId);
      fetchActiveGoals(userInfo.appUserId);
    } catch (error) {
      console.error("[Dashboard] Sync Error:", error);
      setSyncStatus(
        `Sync failed: ${error.response?.data?.message || error.message}`
      );
    } finally {
      setIsLoadingSync(false);
    }
  };

  // --- useEffect for Loading User Info and Initial Data ---
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
          localStorage.removeItem("stravaAthlete");
          setActivitiesError("Invalid session (Missing ID). Login again.");
        }
      } catch (e) {
        localStorage.removeItem("stravaAthlete");
        setActivitiesError("Corrupted session. Login again.");
      }
    } else {
      setActivitiesError("You need to log in.");
    }
    if (userIdToFetch) {
      fetchStoredActivities(userIdToFetch);
      fetchInsights(userIdToFetch);
      fetchActiveGoals(userIdToFetch);
    }
  }, []);

  // Format date helper
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

  // Helper to get unit for goal display
  const getGoalUnit = (type) =>
    goalTypes.find((gt) => gt.value === type)?.unit || "";

  // --- Render Logic ---
  if (!userInfo) {
    return (
      <div>
        <h2>Dashboard</h2>
        <p>{activitiesError || "Loading user info..."}</p>
        {activitiesError && <Link to="/">(Return Home / Login)</Link>}
      </div>
    );
  }

  const chartActivities = activities.slice(0, 10);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <p>Welcome, {userInfo.firstname}!</p>
        <button
          className="sync-button"
          onClick={handleSyncActivities}
          disabled={isLoadingSync}
        >
          {" "}
          {isLoadingSync ? "Syncing..." : "Sync Strava Activities"}{" "}
        </button>
        {syncStatus && <p className="sync-status">{syncStatus}</p>}
      </div>

      {/* --- Insights Section - Corrected Mapping --- */}
      <div className="dashboard-card insights-card">
        <h4>Quick Insights</h4>
        {isLoadingInsights && <p>Generating insights...</p>}
        {insightsError && <p className="error-text">{insightsError}</p>}
        {!isLoadingInsights && !insightsError && insights.length > 0 && (
          <ul className="insights-list">
            {/* Map directly over the array of insight strings */}
            {insights.map((insightString, index) => (
              <li key={index} style={{ marginBottom: "8px" }}>
                {insightString} {/* <<< Display the string directly */}
                {/* Keep premium logic simple for now, based on keywords */}
                {(insightString.includes("Fuel Factor:") ||
                  insightString.includes("Mind Notes:")) && (
                  <span
                    title="Premium Insight"
                    style={{
                      fontSize: "0.7em",
                      marginLeft: "8px",
                      color: "gold",
                      fontWeight: "bold",
                      cursor: "default",
                    }}
                  >
                    ★
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {!isLoadingInsights && !insightsError && insights.length === 0 && (
          <p>Not enough data for insights yet.</p>
        )}
      </div>
      {/* --- End Insights Section --- */}

      {/* Active Goals Summary Section */}
      <div className="dashboard-card goals-summary-card">
        <h4>
          Active Goals (
          <Link to="/goals" style={{ fontSize: "0.8em", fontWeight: "normal" }}>
            Manage
          </Link>
          )
        </h4>
        {isLoadingGoals && <p>Loading goals...</p>}
        {goalsError && <p className="error-text">{goalsError}</p>}
        {!isLoadingGoals && activeGoals.length === 0 && !goalsError && (
          <p>
            No active goals. <Link to="/goals">Set one now!</Link>
          </p>
        )}
        {!isLoadingGoals && activeGoals.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {" "}
            {activeGoals.map((goal) => (
              <li key={goal.goal_id} style={{ marginBottom: "12px" }}>
                {" "}
                <div>
                  {" "}
                  <strong>
                    {goal.name ||
                      goalTypes.find((gt) => gt.value === goal.type)?.label}
                    :
                  </strong>{" "}
                  <span
                    style={{
                      fontSize: "0.9em",
                      color: "#555",
                      marginLeft: "5px",
                    }}
                  >
                    ({goal.start_date} to {goal.end_date})
                  </span>{" "}
                </div>{" "}
                {goal.current_progress !== null && goal.target_value > 0 && (
                  <progress
                    value={goal.current_progress}
                    max={goal.target_value}
                    style={{ width: "100%", marginTop: "3px" }}
                    title={`${goal.progress_percent}% complete`}
                  >
                    {goal.progress_percent}%
                  </progress>
                )}{" "}
                <div
                  style={{
                    fontSize: "0.85em",
                    textAlign: "right",
                    color: "#333",
                  }}
                >
                  {" "}
                  {goal.current_progress !== null
                    ? `${goal.current_progress.toFixed(1)} / ${
                        goal.target_value
                      }`
                    : "0"}{" "}
                  {getGoalUnit(goal.type)}{" "}
                  {goal.target_value > 0 &&
                    goal.current_progress !== null &&
                    ` (${goal.progress_percent}%)`}{" "}
                </div>{" "}
              </li>
            ))}{" "}
          </ul>
        )}
      </div>

      {/* Chart Section */}
      {!isLoadingActivities && chartActivities.length > 1 && (
        <div className="dashboard-card chart-card">
          {" "}
          <h4>Recent Activity Trend</h4>{" "}
          <div style={{ height: "250px", position: "relative" }}>
            {" "}
            <TrendsChart
              activities={chartActivities}
              dataKey="distance_km"
              label="Distance (km)"
            />{" "}
          </div>{" "}
        </div>
      )}

      {/* Activities Section */}
      <div className="dashboard-card activities-card">
        <h3>Your Recent Activities</h3>
        {isLoadingActivities && <p>Loading activities...</p>}
        {activitiesError && <p className="error-text">{activitiesError}</p>}
        {!isLoadingActivities &&
          activities.length === 0 &&
          !activitiesError && <p>No activities found.</p>}
        {/* Activity Table */}
        {!isLoadingActivities && activities.length > 0 && (
          <div className="activity-table-container">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Distance</th>
                  <th>Time</th>
                  <th>Pace</th>
                  <th>Mental State</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr
                    key={activity.activity_id}
                    style={{ cursor: "pointer" }}
                    onClick={() =>
                      navigate(`/activity/${activity.activity_id}`)
                    }
                  >
                    <td>{formatDate(activity.start_date_local)}</td>
                    <td>{activity.name}</td>
                    <td>{activity.type}</td>
                    <td>{activity.distance_km} km</td>
                    <td>{activity.moving_time_formatted}</td>
                    <td>{activity.pace_per_km || "N/A"}</td>
                    <td
                      className="mental-state-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {" "}
                      {activity.mental_mood && (
                        <div>Mood: {activity.mental_mood}/5</div>
                      )}{" "}
                      {activity.mental_focus && (
                        <div>Focus: {activity.mental_focus}/5</div>
                      )}{" "}
                      {activity.mental_stress && (
                        <div>Stress: {activity.mental_stress}/5</div>
                      )}{" "}
                      {activity.mental_notes && (
                        <div className="notes-text">
                          {" "}
                          Notes: {activity.mental_notes}{" "}
                        </div>
                      )}{" "}
                      {!activity.mental_mood &&
                        !activity.mental_focus &&
                        !activity.mental_stress &&
                        !activity.mental_notes && (
                          <span className="no-log-text">(Not logged)</span>
                        )}{" "}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {" "}
                      <MentalStateLogger
                        activity={activity}
                        onSave={handleMentalStateUpdate}
                        userId={userInfo.appUserId}
                      />{" "}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div> // End dashboard-container
  );
};

export default Dashboard;
