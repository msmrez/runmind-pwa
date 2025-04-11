// src/components/Dashboard.js
import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
import apiClient from "../api"; // Use centralized API client
import { useNavigate, Link } from "react-router-dom";
import MentalStateLogger from "./MentalStateLogger"; // Import from separate file
import TrendsChart from "./TrendsChart"; // Import chart component
import "./Dashboard.css"; // Import CSS

// Define goalTypes locally if not imported from a shared constants file
const goalTypes = [
  { value: "weekly_distance", label: "Weekly Distance", unit: "km" },
  { value: "weekly_runs", label: "Weekly Runs", unit: "runs" },
  { value: "monthly_distance", label: "Monthly Distance", unit: "km" },
  { value: "monthly_runs", label: "Monthly Runs", unit: "runs" },
];

// --- CoachLinkRequest Component ---
// (Assuming this component exists and uses apiClient correctly as per previous steps)
const CoachLinkRequest = ({ userId }) => {
  // userId might not be needed if interceptor handles everything
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
      setCoachEmail("");
    } catch (err) {
      console.error("Link request error:", err);
      setRequestStatus(
        `Error: ${err.response?.data?.message || "Failed request."}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dashboard-card">
      <h4>Link with a Coach</h4>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <input
          type="email"
          value={coachEmail}
          onChange={(e) => setCoachEmail(e.target.value)}
          placeholder="Coach's email address"
          disabled={isLoading}
          style={{ flexGrow: 1, padding: "8px" }}
        />
        <button
          onClick={handleRequest}
          disabled={isLoading}
          style={{ padding: "8px 12px" }}
        >
          {" "}
          {isLoading ? "Sending..." : "Request Link"}{" "}
        </button>
      </div>
      {requestStatus && (
        <p style={{ marginTop: "10px", fontStyle: "italic" }}>
          {requestStatus}
        </p>
      )}
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
  const [isLoadingActivities, setIsLoadingActivities] = useState(true); // Start loading true
  const [activities, setActivities] = useState([]);
  const [userInfo, setUserInfo] = useState(null); // Start null
  const [activitiesError, setActivitiesError] = useState("");
  const [insights, setInsights] = useState([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(true); // Start loading true
  const [insightsError, setInsightsError] = useState("");
  const [activeGoals, setActiveGoals] = useState([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true); // Start loading true
  const [goalsError, setGoalsError] = useState("");
  const [isStravaConnected, setIsStravaConnected] = useState(false); // Start false
  const [myCoaches, setMyCoaches] = useState([]);
  const [isLoadingCoaches, setIsLoadingCoaches] = useState(false); // Optional loading state
  const [coachesError, setCoachesError] = useState("");
  const [myTrainingNotes, setMyTrainingNotes] = useState([]);
  const [isLoadingMyTrainingNotes, setIsLoadingMyTrainingNotes] =
    useState(true); // Start loading
  const [myTrainingNotesError, setMyTrainingNotesError] = useState("");

  // --- Use useCallback for Fetch Functions ---
  const fetchStoredActivities = useCallback(async () => {
    console.log("[Dashboard] fetchStoredActivities - Called");
    setIsLoadingActivities(true);
    setActivitiesError(""); // Set loading true here
    try {
      const response = await apiClient.get("/api/activities");
      setActivities(response.data || []);
      console.log("[Dashboard] fetchStoredActivities - Success");
    } catch (error) {
      console.error("[Dashboard] fetchStoredActivities - Error:", error);
      // Avoid setting error if it's an auth error handled by interceptor
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        setActivitiesError(
          `Failed load activities: ${
            error.response?.data?.message || error.message
          }`
        );
      }
      setActivities([]); // Clear on error
    } finally {
      setIsLoadingActivities(false); // Set loading false in finally
      console.log("[Dashboard] fetchStoredActivities - Finished");
    }
  }, []); // Empty dependency array - relies on token from apiClient

  const fetchInsights = useCallback(async () => {
    console.log("[Dashboard] fetchInsights - Called");
    setIsLoadingInsights(true);
    setInsightsError("");
    setInsights([]);
    try {
      const response = await apiClient.get("/api/insights");
      setInsights(
        Array.isArray(response.data.insights) ? response.data.insights : []
      );
      console.log("[Dashboard] fetchInsights - Success");
    } catch (error) {
      console.error("[Dashboard] fetchInsights - Error:", error);
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
      console.log("[Dashboard] fetchInsights - Finished");
    }
  }, []); // Empty dependency array

  const fetchActiveGoals = useCallback(async () => {
    console.log("[Dashboard] fetchActiveGoals - Called");
    setIsLoadingGoals(true);
    setGoalsError("");
    setActiveGoals([]);
    try {
      const response = await apiClient.get("/api/goals", {
        params: { status: "active" },
      });
      setActiveGoals(response.data || []);
      console.log("[Dashboard] fetchActiveGoals - Success");
    } catch (error) {
      console.error("[Dashboard] fetchActiveGoals - Error:", error);
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        setGoalsError(
          `Failed load goals: ${error.response?.data?.message || error.message}`
        );
      }
      setActiveGoals([]);
    } finally {
      setIsLoadingGoals(false);
      console.log("[Dashboard] fetchActiveGoals - Finished");
    }
  }, []); // Empty dependency array

  const fetchMyCoaches = useCallback(async () => {
    console.log("[Dashboard] fetchMyCoaches - Called");
    setIsLoadingCoaches(true); // Optional
    setCoachesError("");
    setMyCoaches([]); // Clear previous
    try {
      // Assuming the endpoint exists as defined in your coaches.js routes
      const response = await apiClient.get("/api/coaches/mycoaches", {
        params: { status: "accepted" }, // Ensure we only get accepted coaches
      });
      setMyCoaches(response.data || []);
      console.log("[Dashboard] fetchMyCoaches - Success");
    } catch (error) {
      console.error("[Dashboard] fetchMyCoaches - Error:", error);
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        setCoachesError(
          `Failed load coaches: ${
            error.response?.data?.message || error.message
          }`
        );
      }
      setMyCoaches([]);
    } finally {
      setIsLoadingCoaches(false); // Optional
      console.log("[Dashboard] fetchMyCoaches - Finished");
    }
  }, []); // Empty dependency array

  const fetchMyTrainingNotes = useCallback(async () => {
    console.log("[Dashboard] fetchMyTrainingNotes - Called");
    setIsLoadingMyTrainingNotes(true);
    setMyTrainingNotesError("");
    setMyTrainingNotes([]); // Clear previous
    try {
      // Use the endpoint created for athletes fetching their notes
      // Confirm path is correct based on your users.js route setup
      const response = await apiClient.get("/api/users/training_notes");
      setMyTrainingNotes(response.data || []);
      console.log("[Dashboard] fetchMyTrainingNotes - Success");
    } catch (error) {
      console.error("[Dashboard] fetchMyTrainingNotes - Error:", error);
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        setMyTrainingNotesError(
          `Failed load training notes: ${
            error.response?.data?.message || error.message
          }`
        );
      }
      // Note: 403 shouldn't happen if checkRole(['runner']) is correct on backend
      setMyTrainingNotes([]);
    } finally {
      setIsLoadingMyTrainingNotes(false);
      console.log("[Dashboard] fetchMyTrainingNotes - Finished");
    }
  }, []); // Empty dependency array

  // --- Handlers ---
  const handleMentalStateUpdate = (activityId, updatedState) => {
    console.log(
      `%c[Dashboard] handleMentalStateUpdate for activity ${activityId}`,
      "color: green;",
      updatedState
    );
    setActivities((currentActivities) =>
      currentActivities.map((act) =>
        act.activity_id === activityId ? { ...act, ...updatedState } : act
      )
    );
    // Re-fetch insights and goals as mental state might influence them
    if (userInfo?.appUserId) {
      fetchInsights();
      fetchActiveGoals();
    }
  };

  const handleSyncActivities = async () => {
    if (!userInfo) return; // Should be guarded by button visibility too
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
      // Refetch all data after successful sync
      fetchStoredActivities();
      fetchInsights();
      fetchActiveGoals();
    } catch (error) {
      console.error("[Dashboard] handleSyncActivities Error:", error);
      // Avoid setting error if it's an auth error handled by interceptor
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        setSyncStatus(
          `Sync failed: ${error.response?.data?.message || error.message}`
        );
      }
    } finally {
      setIsLoadingSync(false);
    }
  };

  // --- useEffect for Loading User Info (runs once) ---
  useEffect(() => {
    console.log("[Dashboard] Mount effect running - loading user info.");
    let initialUserInfo = null;
    let userHasStravaId = false;
    const storedUserStr = localStorage.getItem("stravaAthlete"); // Key used in login/callback
    if (storedUserStr) {
      try {
        const parsedUser = JSON.parse(storedUserStr);
        if (parsedUser?.appUserId) {
          // Check for essential ID
          initialUserInfo = parsedUser;
          // Check connection status (adjust key if needed)
          userHasStravaId =
            parsedUser.isStravaConnected ?? !!parsedUser.strava_id;
          console.log(
            "[Dashboard Mount] User info loaded:",
            initialUserInfo,
            "Strava Connected:",
            userHasStravaId
          );
        } else {
          console.warn("[Dashboard Mount] Parsed user missing appUserId.");
          localStorage.removeItem("stravaAthlete"); // Clean up invalid data
          // Potentially clear token too if user info invalid?
          // localStorage.removeItem("authToken");
        }
      } catch (e) {
        console.error("[Dashboard Mount] Error parsing stored user data.", e);
        localStorage.removeItem("stravaAthlete"); // Clean up corrupted data
      }
    } else {
      console.log("[Dashboard Mount] No stored user data found.");
      // If no user info, check if a token *does* exist (might indicate incomplete login)
      if (localStorage.getItem("authToken")) {
        console.warn(
          "[Dashboard Mount] Auth token exists but user info missing. Might need to fetch /auth/me or relogin."
        );
        // Consider calling a fetch /auth/me endpoint here if you implement one
      }
    }
    setUserInfo(initialUserInfo); // Set state for userInfo
    setIsStravaConnected(userHasStravaId); // Set state for connection
  }, []); // Runs only once on mount to load initial state

  // --- useEffect for Fetching Data (depends on userInfo) ---
  useEffect(() => {
    // Only fetch if we have successfully loaded userInfo
    if (userInfo && userInfo.appUserId) {
      console.log(
        `[Dashboard Data Fetch Effect] UserInfo ready (ID: ${userInfo.appUserId}). Fetching data...`
      );
      fetchStoredActivities();
      fetchInsights();
      fetchActiveGoals();
      // <<< --- Conditionally fetch coaches IF user is a runner --- >>>
      if (userInfo.role === "runner") {
        fetchMyCoaches();
        fetchMyTrainingNotes();
      }
      // <<< --- End conditional fetch --- >>>
    } else {
      console.log(
        "[Dashboard Data Fetch Effect] Skipping fetch - userInfo not available."
      );
      // Ensure loading states are false if we aren't fetching
      setIsLoadingActivities(false);
      setIsLoadingInsights(false);
      setIsLoadingGoals(false);
    }
    // Depend on userInfo. Re-running fetch functions doesn't add value here as they are stable references from useCallback([])
  }, [
    userInfo,
    fetchStoredActivities,
    fetchInsights,
    fetchActiveGoals,
    fetchMyCoaches,
    fetchMyTrainingNotes,
  ]); // Depend on userInfo and fetch functions

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
  // Show primary loading/error only if userInfo hasn't loaded yet
  if (userInfo === null) {
    // Check explicitly for null (initial state)
    // Use activitiesError as a general indicator for user loading issues for now
    return (
      <div>
        <h2>Dashboard</h2>
        <p>{activitiesError || "Loading user data..."}</p>
        {activitiesError && <Link to="/login">Please Login</Link>}
      </div>
    );
  }

  // Prepare data needed for rendering
  const chartActivities = activities.slice(0, 10);
  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";

  // --- Add these logs right BEFORE the return statement ---
  console.log("[Dashboard Render Check] UserInfo available:", !!userInfo);
  console.log("[Dashboard Render Check] isStravaConnected:", isStravaConnected);
  console.log(
    "[Dashboard Render Check] isLoadingActivities:",
    isLoadingActivities
  );
  console.log(
    "[Dashboard Render Check] chartActivities defined:",
    !!chartActivities
  );
  console.log(
    "[Dashboard Render Check] chartActivities.length:",
    chartActivities?.length
  ); // Use optional chaining just in case
  // --- End of added logs ---
  console.log("[Dashboard Render Check] userInfo.role:", userInfo?.role);
  console.log(
    "[Dashboard Render Check - Notes State]",
    "isLoading:",
    isLoadingMyTrainingNotes,
    "error:",
    myTrainingNotesError,
    "notesCount:",
    myTrainingNotes?.length
  );
  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <p>Welcome, {userInfo.firstname}!</p>
        {/* Conditional Strava Button */}
        {isStravaConnected ? (
          <button
            className="sync-button"
            onClick={handleSyncActivities}
            disabled={isLoadingSync}
          >
            {" "}
            {isLoadingSync ? "Syncing..." : "Sync Strava Activities"}{" "}
          </button>
        ) : (
          <div className="strava-connect-prompt">
            {" "}
            <p>Connect Strava to sync activities!</p>{" "}
            <a
              href={`${backendUrl}/strava/authorize`}
              className="App-link sync-button"
            >
              Connect with Strava
            </a>{" "}
          </div>
        )}
        {syncStatus && <p className="sync-status">{syncStatus}</p>}
      </div>

      {/* Insights Section */}
      <div className="dashboard-card insights-card">
        <h4>Quick Insights</h4>
        {isLoadingInsights && <p>Loading insights...</p>}
        {insightsError && <p className="error-text">{insightsError}</p>}
        {!isLoadingInsights && !insightsError && insights.length > 0 && (
          <ul className="insights-list">
            {" "}
            {insights.map((insightString, index) => (
              <li key={index}>
                {" "}
                {insightString} {/* Premium Star Placeholder */}{" "}
                {(insightString.includes("Factor:") ||
                  insightString.includes("Notes:")) && (
                  <span
                    title="Premium Insight"
                    style={{
                      fontSize: "0.7em",
                      marginLeft: "8px",
                      color: "gold",
                      fontWeight: "bold",
                    }}
                  >
                    ★
                  </span>
                )}{" "}
              </li>
            ))}{" "}
          </ul>
        )}
        {!isLoadingInsights && !insightsError && insights.length === 0 && (
          <p>No insights available yet.</p>
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
        {isLoadingGoals && <p>Loading goals...</p>}
        {goalsError && <p className="error-text">{goalsError}</p>}
        {!isLoadingGoals && activeGoals.length === 0 && !goalsError && (
          <p>
            No active goals. <Link to="/goals">Set one!</Link>
          </p>
        )}
        {!isLoadingGoals && activeGoals.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {" "}
            {activeGoals.map((goal) => {
              // Safely get progress values inside map
              const currentProgressValue =
                typeof goal.current_progress === "number" &&
                goal.current_progress !== null
                  ? goal.current_progress
                  : 0;
              const targetValue =
                typeof goal.target_value === "number" &&
                goal.target_value !== null
                  ? goal.target_value
                  : 0;
              const progressPercent =
                targetValue > 0
                  ? Math.min(
                      100,
                      Math.round((currentProgressValue / targetValue) * 100)
                    )
                  : 0;
              const progressIsCalculable =
                typeof goal.current_progress === "number" &&
                goal.current_progress !== null &&
                targetValue > 0;

              return (
                <li key={goal.goal_id} style={{ marginBottom: "12px" }}>
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
                  </div>
                  {progressIsCalculable ? (
                    <progress
                      value={currentProgressValue}
                      max={targetValue}
                      style={{ width: "100%", marginTop: "3px" }}
                      title={`${progressPercent}% complete`}
                    >
                      {progressPercent}%
                    </progress>
                  ) : (
                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "0.8em",
                        color: "#777",
                      }}
                    >
                      (Progress not available)
                    </div>
                  )}
                  {progressIsCalculable && (
                    <div
                      style={{
                        fontSize: "0.85em",
                        textAlign: "right",
                        color: "#333",
                      }}
                    >
                      {" "}
                      {currentProgressValue.toFixed(1)} / {targetValue}{" "}
                      {getGoalUnit(goal.type)} ({progressPercent}%){" "}
                    </div>
                  )}
                </li>
              );
            })}{" "}
          </ul>
        )}
      </div>

      {/* <<< --- NEW Training Notes Section for Athlete --- >>> */}
      <div className="dashboard-card training-notes-section">
        <h4>Training Notes from Coach</h4>
        {isLoadingMyTrainingNotes && <p>Loading notes...</p>}
        {myTrainingNotesError && (
          <p className="error-text">{myTrainingNotesError}</p>
        )}
        {!isLoadingMyTrainingNotes &&
          !myTrainingNotesError &&
          myTrainingNotes.length === 0 && (
            <p>No training notes received from your coach yet.</p>
          )}
        {!isLoadingMyTrainingNotes &&
          !myTrainingNotesError &&
          myTrainingNotes.length > 0 && (
            <ul className="training-notes-list">
              {myTrainingNotes.map((note) => (
                <li key={note.note_id} className="training-notes-item">
                  <div className="note-header">
                    <span className="note-date">
                      {formatDate(note.note_date, false)}
                    </span>{" "}
                    {/* Date only */}
                    <span className="note-coach">
                      From: {note.coach_first_name || "Coach"}{" "}
                      {note.coach_last_name || ""}
                    </span>
                  </div>
                  <p className="note-instructions">{note.instructions}</p>
                </li>
              ))}
            </ul>
          )}
      </div>
      {/* <<< --- End NEW Training Notes Section --- >>> */}

      {/* Coach Link Request Form (Only for runners) */}
      {userInfo && userInfo.role === "runner" && (
        <CoachLinkRequest userId={userInfo.appUserId} /> // Render if runner
      )}

      {/* <<< --- NEW My Coaches Section (Only for runners) --- >>> */}
      {userInfo && userInfo.role === "runner" && (
        <div className="dashboard-card my-coaches-section">
          <h4>My Coaches</h4>
          {isLoadingCoaches && <p>Loading coaches...</p>}
          {coachesError && <p className="error-text">{coachesError}</p>}
          {!isLoadingCoaches && !coachesError && myCoaches.length === 0 && (
            <p>You are not currently linked with any coaches.</p>
          )}
          {!isLoadingCoaches && !coachesError && myCoaches.length > 0 && (
            <ul className="my-coaches-list">
              {myCoaches.map((coach) => (
                <li key={coach.coach_user_id} className="my-coaches-item">
                  {" "}
                  {/* Use coach_user_id */}
                  {coach.first_name || "Coach"}{" "}
                  {coach.last_name || coach.coach_user_id} {/* Display name */}
                  {coach.email && (
                    <span className="coach-email"> ({coach.email})</span>
                  )}{" "}
                  {/* Display email */}
                  {/* Potential future action:
                  <button onClick={() => handleRevokeLink(coach.link_id)} className="revoke-button">
                    Revoke Link
                  </button>
                  */}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {/* <<< --- End NEW My Coaches Section --- >>> */}
      {/* Chart Section */}
      {isStravaConnected && !isLoadingActivities && activities.length > 0 && (
        <div className="dashboard-card chart-card">
          <h4>Activity Trends</h4> {/* Updated title */}
          <div style={{ height: "250px", position: "relative" }}>
            <TrendsChart
              activities={chartActivities} // Still pass original (sliced) activities
              // Props for first metric (Left Axis)
              dataKey1="distance_km"
              label1="Distance (km)"
              // Props for second metric (Right Axis)
              dataKey2="average_heartrate"
              label2="Avg HR (bpm)"
            />
          </div>
        </div>
      )}
      {/* Loading Indicator */}
      {isStravaConnected && isLoadingActivities && (
        <div className="dashboard-card chart-card">
          <p>Loading chart data...</p>
        </div>
      )}
      {/* Show loading indicator for chart if activities are loading */}
      {isStravaConnected && isLoadingActivities && (
        <div className="dashboard-card chart-card">
          <p>Loading chart data...</p>
        </div>
      )}

      {/* Activities Section */}
      <div className="dashboard-card activities-card">
        <h3>Your Recent Activities</h3>
        {!isStravaConnected && (
          <p className="info-text">Connect Strava to see activities.</p>
        )}
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
        {/* Activity Table */}
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
