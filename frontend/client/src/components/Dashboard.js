// src/components/Dashboard.js
import React, { useState, useEffect } from "react";
import apiClient from "../api"; // Use apiClient for protected routes
import { useNavigate, Link } from "react-router-dom";
import MentalStateLogger from "./MentalStateLogger"; // Import from separate file
import TrendsChart from "./TrendsChart";
import "./Dashboard.css";

// Define goalTypes locally if not imported
const goalTypes = [
  { value: "weekly_distance", label: "Weekly Distance", unit: "km" },
  { value: "weekly_runs", label: "Weekly Runs", unit: "runs" },
  { value: "monthly_distance", label: "Monthly Distance", unit: "km" },
  { value: "monthly_runs", label: "Monthly Runs", unit: "runs" },
];

// --- CoachLinkRequest Component (Now uses apiClient) ---
const CoachLinkRequest = ({ userId }) => { // userId might not be strictly needed if apiClient handles auth
    const [coachEmail, setCoachEmail] = useState('');
    const [requestStatus, setRequestStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleRequest = async () => {
         if (!coachEmail) { setRequestStatus('Please enter coach email.'); return; }
         setIsLoading(true); setRequestStatus('Sending request...');
         try {
             // Use apiClient - token added automatically
             const response = await apiClient.post('/api/coaches/link/request', { coachEmail });
             setRequestStatus(response.data.message || 'Request sent!');
             setCoachEmail('');
         } catch (err) { console.error("Link request error:", err); setRequestStatus(`Error: ${err.response?.data?.message || 'Failed request.'}`); }
         finally { setIsLoading(false); }
    };

    return ( /* ... JSX for the coach link form ... */
        <div className="dashboard-card">
            <h4>Link with a Coach</h4>
            <div style={{display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap'}}>
                <input type="email" value={coachEmail} onChange={(e) => setCoachEmail(e.target.value)} placeholder="Coach's email address" disabled={isLoading} style={{flexGrow:1, padding:'8px'}} />
                <button onClick={handleRequest} disabled={isLoading} style={{padding:'8px 12px'}}> {isLoading ? 'Sending...' : 'Request Link'} </button>
            </div>
             {requestStatus && <p style={{marginTop:'10px', fontStyle:'italic'}}>{requestStatus}</p>}
        </div>
     );
};
// --- End CoachLinkRequest ---

// --- Main Dashboard Component ---
const Dashboard = () => {
  const navigate = useNavigate();

  // --- State Variables ---
  const [syncStatus, setSyncStatus] = useState("");
  const [isLoadingSync, setIsLoadingSync] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [activities, setActivities] = useState([]);
  const [userInfo, setUserInfo] = useState(null); // Holds user data from localStorage
  const [activitiesError, setActivitiesError] = useState("");
  const [insights, setInsights] = useState([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [activeGoals, setActiveGoals] = useState([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);
  const [goalsError, setGoalsError] = useState("");
  // --- State for Strava connection status ---
  const [isStravaConnected, setIsStravaConnected] = useState(false); // Initialize false

  // --- Handlers & Fetch Functions (Using apiClient) ---
  const handleMentalStateUpdate = (activityId, updatedState) => {
    setActivities((current) =>
      current.map((act) =>
        act.activity_id === activityId ? { ...act, ...updatedState } : act
      )
    );
    if (userInfo?.appUserId) {
      fetchInsights();
      fetchActiveGoals();
    }
  };

  const fetchStoredActivities = async () => {
    if (!userInfo) return; // Need userInfo check here or rely on useEffect guard
    setIsLoadingActivities(true);
    setActivitiesError("");
    try {
      const response = await apiClient.get("/api/activities");
      setActivities(response.data || []);
    } catch (error) {
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        setActivitiesError(
          `Failed load activities: ${
            error.response?.data?.message || error.message
          }`
        );
      }
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const fetchInsights = async () => {
    if (!userInfo) return;
    setIsLoadingInsights(true);
    setInsightsError("");
    setInsights([]);
    try {
      const response = await apiClient.get("/api/insights");
      setInsights(
        Array.isArray(response.data.insights) ? response.data.insights : []
      );
    } catch (error) {
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        setInsightsError(
          `Failed load insights: ${
            error.response?.data?.message || error.message
          }`
        );
      }
      setInsights([]);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const fetchActiveGoals = async () => {
    if (!userInfo) return;
    setIsLoadingGoals(true);
    setGoalsError("");
    setActiveGoals([]);
    try {
      const response = await apiClient.get("/api/goals", {
        params: { status: "active" },
      });
      setActiveGoals(response.data || []);
    } catch (error) {
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        setGoalsError(
          `Failed load active goals: ${
            error.response?.data?.message || error.message
          }`
        );
      }
      setActiveGoals([]);
    } finally {
      setIsLoadingGoals(false);
    }
  };

  const handleSyncActivities = async () => {
    // No need to check userInfo here as button won't render if !userInfo
    setIsLoadingSync(true);
    setSyncStatus("Syncing...");
    setActivitiesError("");
    setInsightsError("");
    setGoalsError("");
    try {
      const response = await apiClient.post("/api/strava/sync", {});
      setSyncStatus(
        `Sync successful! ${response.data.activitiesStored} processed.`
      );
      fetchStoredActivities();
      fetchInsights();
      fetchActiveGoals();
    } catch (error) {
      // Handle specific "Strava not connected" error differently if needed
      if (error.response?.data?.code === "STRAVA_NOT_CONNECTED") {
        setSyncStatus(
          error.response.data.message || "Cannot sync: Strava not connected."
        );
        // Update connection status state? Maybe not needed here as it's checked on load.
        // setIsStravaConnected(false);
      } else if (
        error.response?.status !== 401 &&
        error.response?.status !== 403
      ) {
        console.error("[Dashboard] Sync Error:", error);
        setSyncStatus(
          `Sync failed: ${error.response?.data?.message || error.message}`
        );
      }
      // 401/403 handled by interceptor
    } finally {
      setIsLoadingSync(false);
    }
  };

  const CoachLinkRequest = () => {
    const [coachEmail, setCoachEmail] = useState("");
    const [requestStatus, setRequestStatus] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleRequest = async () => {
      if (!coachEmail) {
        setRequestStatus("Please enter coach email.");
        return;
      }
      setIsLoading(true);
      setRequestStatus("Sending request...");
      try {
        const response = await apiClient.post("/api/coaches/link/request", {
          coachEmail,
        });
        setRequestStatus(response.data.message || "Request sent!");
        setCoachEmail(""); // Clear input on success
      } catch (err) {
        setRequestStatus(
          `Error: ${err.response?.data?.message || "Failed to send request."}`
        );
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="dashboard-card">
        {" "}
        {/* Reuse card style */}
        <h4>Link with a Coach</h4>
        <input
          type="email"
          value={coachEmail}
          onChange={(e) => setCoachEmail(e.target.value)}
          placeholder="Coach's email address"
          disabled={isLoading}
        />
        <button
          onClick={handleRequest}
          disabled={isLoading}
          style={{ marginLeft: "10px" }}
        >
          {isLoading ? "Sending..." : "Request Link"}
        </button>
        {requestStatus && (
          <p style={{ marginTop: "10px", fontStyle: "italic" }}>
            {requestStatus}
          </p>
        )}
      </div>
    );
  };
  // --- useEffect for Loading User Info and Initial Data ---
  useEffect(() => {
    console.log("[Dashboard] Mount effect running.");
    const storedUserStr = localStorage.getItem("stravaAthlete"); // Key from login/callback
    let userIdToFetch = null;
    let userHasStravaId = false; // Reset flag

    if (storedUserStr) {
      try {
        const parsedUser = JSON.parse(storedUserStr);
        if (parsedUser?.appUserId && parsedUser?.firstname) {
          setUserInfo(parsedUser);
          userIdToFetch = parsedUser.appUserId;
          // --- Check for Strava ID ---
          // Adjust 'strava_id' or 'id' based on what your backend actually puts
          // in the 'user' object stored in localStorage['stravaAthlete']
          // Let's check for 'strava_id' specifically if backend adds it on link
          const stravaIdKey = "strava_id";
          if (parsedUser[stravaIdKey]) {
            // Check for the explicit Strava ID field if backend adds it
            console.log("[Dashboard Mount] User has Strava ID.");
            userHasStravaId = true;
          } else {
            console.log("[Dashboard Mount] User loaded, no Strava ID found.");
          }
          // --- End Strava Check ---
        } else {
          /* ... handle invalid stored data ... */
        }
      } catch (e) {
        /* ... handle parsing error ... */
      }
    } else {
      /* ... handle no stored user ... */
    }

    setIsStravaConnected(userHasStravaId); // <<< Set state based on check

    if (userIdToFetch) {
      console.log(
        `[Dashboard Mount] Fetching initial data for user ${userIdToFetch}...`
      );
      // Only fetch activities/insights/goals if user is valid
      fetchStoredActivities(); // Uses token via apiClient
      fetchInsights();
      fetchActiveGoals();
    } else {
      /* ... skip fetch ... */
    }
  }, []); // Runs once

  // Format date helper
  const formatDate = (dateString) => {
    /* ... */
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
  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || "http://localhost:5001"; // For Strava connect link

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <p>Welcome, {userInfo.firstname}!</p>

        {/* --- Conditional Strava Sync Button / Connect Prompt --- */}
        {isStravaConnected ? (
          // Show Sync button if Strava is connected
          <>
            <button
              className="sync-button"
              onClick={handleSyncActivities}
              disabled={isLoadingSync}
            >
              {isLoadingSync ? "Syncing..." : "Sync Strava Activities"}
            </button>
            {syncStatus && <p className="sync-status">{syncStatus}</p>}
          </>
        ) : (
          // Show Connect prompt if Strava is NOT connected
          <div
            className="strava-connect-prompt"
            style={{
              border: "1px solid #f0ad4e",
              backgroundColor: "#fcf8e3",
              padding: "10px 15px",
              borderRadius: "4px",
              marginTop: "10px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: "0 0 8px 0",
                color: "#8a6d3b",
                fontWeight: "bold",
              }}
            >
              Connect Strava to sync activities!
            </p>
            {/* Link points to the backend authorization route */}
            <a
              href={`${backendUrl}/strava/authorize`}
              className="App-link sync-button"
              style={{ textDecoration: "none" }}
            >
              Connect with Strava
            </a>
          </div>
        )}
        {/* --- End Conditional Section --- */}
      </div>

      {/* Insights Section */}
      <div className="dashboard-card insights-card">
        <h4>Quick Insights</h4>
        {isLoadingInsights && <p>Loading...</p>}
        {insightsError && <p className="error-text">{insightsError}</p>}
        {!isLoadingInsights && !insightsError && insights.length > 0 && (
          <ul className="insights-list">
            {" "}
            {insights.map((insightString, index) => (
              <li key={index}>
                {insightString}{" "}
                {(insightString.includes("Factor:") ||
                  insightString.includes("Notes:")) && (
                  <span title="Premium">★</span>
                )}{" "}
              </li>
            ))}{" "}
          </ul>
        )}
        {!isLoadingInsights && !insightsError && insights.length === 0 && (
          <p>No insights yet.</p>
        )}
      </div>

      {/* Active Goals Summary Section */}
      <div className="dashboard-card goals-summary-card">
        <h4>
          Active Goals (
          <Link to="/goals" style={{ fontSize: "0.8em", fontWeight: "normal" }}>
            Manage
          </Link>
          )
        </h4>
        {isLoadingGoals && <p>Loading...</p>}
        {goalsError && <p className="error-text">{goalsError}</p>}
        {!isLoadingGoals && activeGoals.length === 0 && !goalsError && (
          <p>
            No active goals. <Link to="/goals">Set one!</Link>
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
                  <span style={{ fontSize: "0.9em", color: "#555" }}>
                    ({goal.start_date} to {goal.end_date})
                  </span>{" "}
                </div>{" "}
                {goal.current_progress !== null && goal.target_value > 0 && (
                  <progress
                    value={goal.current_progress}
                    max={goal.target_value}
                    style={{ width: "100%" }}
                    title={`${goal.progress_percent}%`}
                  >
                    {goal.progress_percent}%
                  </progress>
                )}{" "}
                <div style={{ fontSize: "0.85em", textAlign: "right" }}>
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
      {/* Only render chart if Strava is connected and data available */}
      {isStravaConnected &&
        !isLoadingActivities &&
        chartActivities.length > 1 && (
          <div className="dashboard-card chart-card">
            {" "}
            <h4>Recent Trend</h4>{" "}
            <div style={{ height: "250px" }}>
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
        {/* Show prompt if Strava isn't connected */}
        {!isStravaConnected && (
          <p style={{ color: "#666", fontStyle: "italic" }}>
            Connect Strava using the button above to see your activities.
          </p>
        )}
        {/* Show loading/error/table only if Strava IS connected */}
        {isStravaConnected && isLoadingActivities && (
          <p>Loading activities...</p>
        )}
        {isStravaConnected && activitiesError && (
          <p className="error-text">{activitiesError}</p>
        )}
        {isStravaConnected &&
          !isLoadingActivities &&
          activities.length === 0 &&
          !activitiesError && <p>No activities found. Try syncing!</p>}
        {isStravaConnected && !isLoadingActivities && activities.length > 0 && (
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
                      {/* ... mental state display ... */}{" "}
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
