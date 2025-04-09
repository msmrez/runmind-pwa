// src/components/GoalsPage.js
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

// Helper to get dates for default start/end
const getWeekStartDate = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split("T")[0];
};
const getWeekEndDate = (date = new Date()) => {
  const d = new Date(date);
  const startOfWeek = new Date(getWeekStartDate(d));
  startOfWeek.setDate(startOfWeek.getDate() + 6);
  return startOfWeek.toISOString().split("T")[0];
};
const getMonthStartDate = (date = new Date()) => {
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .split("T")[0];
};
const getMonthEndDate = (date = new Date()) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
};

// --- Define goalTypes Array (used by Form and Item) ---
// Moved near top for better visibility
const goalTypes = [
  { value: "weekly_distance", label: "Weekly Distance", unit: "km" },
  { value: "weekly_runs", label: "Weekly Runs", unit: "runs" },
  { value: "monthly_distance", label: "Monthly Distance", unit: "km" },
  { value: "monthly_runs", label: "Monthly Runs", unit: "runs" },
];

// --- GoalForm Sub-Component ---
const GoalForm = ({ userId, onGoalAdded }) => {
  const [type, setType] = useState("weekly_distance");
  const [targetValue, setTargetValue] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(getWeekStartDate());
  const [endDate, setEndDate] = useState(getWeekEndDate());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Update dates based on type
    const today = new Date();
    if (type.startsWith("weekly")) {
      setStartDate(getWeekStartDate(today));
      setEndDate(getWeekEndDate(today));
    } else if (type.startsWith("monthly")) {
      setStartDate(getMonthStartDate(today));
      setEndDate(getMonthEndDate(today));
    }
  }, [type]);

  const resetForm = () => {
    /* ... resets form fields ... */ setType("weekly_distance");
    setTargetValue("");
    setName("");
    setError("");
    setIsSaving(false);
    setStartDate(getWeekStartDate());
    setEndDate(getWeekEndDate());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetValue || parseFloat(targetValue) <= 0) {
      setError("Target must be > 0.");
      return;
    }
    if (!startDate || !endDate || new Date(endDate) < new Date(startDate)) {
      setError("End date issue.");
      return;
    }
    setIsSaving(true);
    setError("");
    const goalData = {
      type,
      target_value: parseFloat(targetValue),
      start_date: startDate,
      end_date: endDate,
      name: name.trim() || null,
    };
    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      const response = await axios.post(`${backendUrl}/api/goals`, goalData, {
        headers: { "X-User-ID": userId },
      });
      onGoalAdded(response.data);
      resetForm();
    } catch (err) {
      console.error("[GoalForm] Error saving:", err);
      setError(`Save failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedGoalInfo = goalTypes.find((gt) => gt.value === type) || {};

  return (
    // Goal Form JSX (no changes here)
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid #ccc",
        padding: "15px",
        borderRadius: "5px",
        marginBottom: "20px",
      }}
    >
      <h4>Set New Goal</h4>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ marginBottom: "10px" }}>
        {" "}
        <label>Type: </label>{" "}
        <select value={type} onChange={(e) => setType(e.target.value)} required>
          {" "}
          {goalTypes.map((gt) => (
            <option key={gt.value} value={gt.value}>
              {gt.label}
            </option>
          ))}{" "}
        </select>{" "}
      </div>
      <div style={{ marginBottom: "10px" }}>
        {" "}
        <label>Target ({selectedGoalInfo.unit || ""}): </label>{" "}
        <input
          type="number"
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          required
          min="0.1"
          step="any"
          placeholder={`e.g., ${type.includes("distance") ? "50" : "5"}`}
        />{" "}
      </div>
      <div style={{ marginBottom: "10px" }}>
        {" "}
        <label>Name (Optional): </label>{" "}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Spring Training Block"
        />{" "}
      </div>
      <div style={{ marginBottom: "10px", display: "flex", gap: "15px" }}>
        {" "}
        <div>
          <label>Start Date: </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>{" "}
        <div>
          <label>End Date: </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            min={startDate}
          />
        </div>{" "}
      </div>
      <button type="submit" disabled={isSaving}>
        {" "}
        {isSaving ? "Saving..." : "Add Goal"}{" "}
      </button>
    </form>
  );
};
// --- End GoalForm ---

// --- GoalItem Sub-Component (Corrected Progress Display) ---
const GoalItem = ({ goal, userId, onGoalDeleted, onGoalStatusChanged }) => {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getGoalLabel = (type) =>
    goalTypes.find((gt) => gt.value === type)?.label || type;
  const getUnit = (type) =>
    goalTypes.find((gt) => gt.value === type)?.unit || "";

  // Handlers for status change and delete (no changes here)
  const handleStatusChange = async (newStatus) => {
    if (
      !window.confirm(
        `Mark goal "${goal.name || getGoalLabel(goal.type)}" as ${newStatus}?`
      )
    )
      return;
    setIsUpdatingStatus(true);
    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      const response = await axios.put(
        `${backendUrl}/api/goals/${goal.goal_id}/status`,
        { status: newStatus },
        { headers: { "X-User-ID": userId } }
      );
      onGoalStatusChanged(response.data);
    } catch (err) {
      console.error("Failed status update:", err);
      alert("Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };
  const handleDelete = async () => {
    if (
      !window.confirm(`Delete goal "${goal.name || getGoalLabel(goal.type)}"?`)
    )
      return;
    setIsDeleting(true);
    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      await axios.delete(`${backendUrl}/api/goals/${goal.goal_id}`, {
        headers: { "X-User-ID": userId },
      });
      onGoalDeleted(goal.goal_id);
    } catch (err) {
      console.error("Failed delete:", err);
      alert("Failed to delete goal.");
    } finally {
      setIsDeleting(false);
    }
  };

  const goalLabel = goal.name
    ? `${goal.name} (${getGoalLabel(goal.type)})`
    : getGoalLabel(goal.type);
  const unit = getUnit(goal.type);

  // --- Prepare progress values safely BEFORE using them ---
  const currentProgressValue =
    typeof goal.current_progress === "number" && goal.current_progress !== null
      ? goal.current_progress
      : 0;
  const targetValue =
    typeof goal.target_value === "number" && goal.target_value !== null
      ? goal.target_value
      : 0; // Use target_value passed in props
  const progressPercent =
    targetValue > 0
      ? Math.min(100, Math.round((currentProgressValue / targetValue) * 100))
      : 0;
  // Check if progress is calculable (is a number and target is positive)
  const progressIsCalculable =
    typeof goal.current_progress === "number" &&
    goal.current_progress !== null &&
    targetValue > 0;
  // --- End safe preparation ---

  return (
    <li
      style={{
        border: "1px solid #eee",
        padding: "10px",
        marginBottom: "10px",
        borderRadius: "4px",
        backgroundColor:
          goal.status === "completed"
            ? "#e8f5e9"
            : goal.status === "abandoned"
            ? "#fbe9e7"
            : "white",
      }}
    >
      <strong>{goalLabel}</strong>: {targetValue} {unit} {/* Display target */}
      <br />
      <span style={{ fontSize: "0.9em", color: "#555" }}>
        ({goal.start_date} to {goal.end_date}) - Status: {goal.status}
      </span>
      {/* Progress Bar and Text Display */}
      {goal.status === "active" && ( // Only show progress section for active goals
        <div style={{ marginTop: "5px" }}>
          {progressIsCalculable ? ( // If progress can be shown...
            <>
              <progress
                value={currentProgressValue}
                max={targetValue}
                style={{ width: "100%" }}
                title={`${progressPercent}%`}
              />
              {/* --- CORRECTED Progress Text Display --- */}
              <div style={{ fontSize: "0.8em", textAlign: "right" }}>
                {/* Use the safely prepared currentProgressValue before calling toFixed */}
                {currentProgressValue.toFixed(1)} / {targetValue} {unit} (
                {progressPercent}%)
              </div>
              {/* --- END CORRECTED --- */}
            </>
          ) : (
            // Otherwise, show placeholder text
            <div style={{ fontSize: "0.8em", color: "#777" }}>
              (Progress not available or target is zero)
            </div>
          )}
        </div>
      )}
      {/* Action Buttons */}
      <div style={{ marginTop: "8px", fontSize: "0.9em" }}>
        {goal.status === "active" && (
          <>
            <button
              onClick={() => handleStatusChange("completed")}
              disabled={isUpdatingStatus || isDeleting}
              style={{
                marginRight: "5px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                padding: "3px 6px",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              Mark Complete
            </button>
            <button
              onClick={() => handleStatusChange("abandoned")}
              disabled={isUpdatingStatus || isDeleting}
              style={{
                marginRight: "5px",
                backgroundColor: "#ff9800",
                color: "white",
                border: "none",
                padding: "3px 6px",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              Abandon
            </button>
          </>
        )}
        {goal.status !== "active" && (
          <button
            onClick={() => handleStatusChange("active")}
            disabled={isUpdatingStatus || isDeleting}
            style={{
              marginRight: "5px",
              border: "none",
              padding: "3px 6px",
              borderRadius: "3px",
              cursor: "pointer",
            }}
          >
            Reactivate
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={isUpdatingStatus || isDeleting}
          style={{
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            padding: "3px 6px",
            borderRadius: "3px",
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>
    </li>
  );
};
// --- End GoalItem ---

// --- GoalsPage Main Component ---
const GoalsPage = () => {
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Start true for initial load
  const [error, setError] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [filter, setFilter] = useState("active");

  // Load user info
  useEffect(() => {
    console.log("[GoalsPage User Effect] Running.");
    const storedUser = localStorage.getItem("stravaAthlete");
    if (storedUser) {
      try {
        const p = JSON.parse(storedUser);
        if (p?.appUserId) setUserInfo(p);
        else setError("Invalid session.");
      } catch {
        setError("Corrupted session.");
      }
    } else {
      setError("User not logged in.");
    }
  }, []); // Empty dependency array - runs once

  // Fetch goals function
  const fetchGoals = useCallback(async () => {
    // Ensure userInfo is loaded before fetching
    if (!userInfo) {
      console.log("[fetchGoals] Skipping fetch - userInfo not loaded yet.");
      // Don't set isLoading here, wait for userInfo effect
      return;
    }
    console.log(
      `[fetchGoals] STARTING. Filter: ${filter}, User: ${userInfo.appUserId}. Setting isLoading=true.`
    );
    setIsLoading(true); // <<< Set loading TRUE
    setError("");
    // Do NOT reset goals here immediately, only on success/error inside try/catch

    try {
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      const params = filter === "all" ? {} : { status: filter };
      const response = await axios.get(`${backendUrl}/api/goals`, {
        headers: { "X-User-ID": userInfo.appUserId },
        params: params,
      });
      console.log("[fetchGoals] SUCCESS. Received data:", response.data);
      setGoals(response.data || []); // <<< Set goals on SUCCESS
    } catch (err) {
      console.error("[fetchGoals] ERROR:", err.response?.data || err.message);
      setError(
        `Failed load goals: ${err.response?.data?.message || err.message}`
      );
      setGoals([]); // <<< Clear goals on ERROR
    } finally {
      console.log("[fetchGoals] FINALLY block. Setting isLoading=false.");
      setIsLoading(false); // <<< Set loading FALSE in FINALLY
    }
  }, [filter, userInfo]); // Dependencies: filter and userInfo

  // Trigger fetchGoals only when fetchGoals function itself changes (due to deps changing)
  useEffect(() => {
    console.log(
      "[GoalsPage fetchGoals Effect] Dependencies changed. Calling fetchGoals."
    );
    fetchGoals();
  }, [fetchGoals]); // Trigger only when the memoized fetchGoals changes

  // Callback for GoalForm
  const handleGoalAdded = (newGoal) => {
    console.log(
      `[handleGoalAdded] Goal ${newGoal.goal_id} added by form. Calling fetchGoals to refresh.`
    );
    // Refetch the list to get calculated progress
    fetchGoals(); // <<< This should now correctly set/unset isLoading
  };

  // Callback for GoalItem Delete
  const handleGoalDeleted = (deletedGoalId) => {
    console.log(
      `[handleGoalDeleted] Goal ${deletedGoalId} deleted. Removing locally and refetching.`
    );
    // Remove immediately for better UI response
    setGoals((currentGoals) =>
      currentGoals.filter((g) => g.goal_id !== deletedGoalId)
    );
    // Optional: Refetch to ensure consistency, though maybe not essential on delete
    // fetchGoals();
  };

  // Callback for GoalItem Status Change
  const handleGoalStatusChanged = (updatedGoal) => {
    console.log(
      `[handleGoalStatusChanged] Goal ${updatedGoal.goal_id} status changed. Calling fetchGoals to refresh.`
    );
    // Refetch is recommended here as backend calculation depends on status
    fetchGoals();
  };

  // Render logic
  if (!userInfo && !error) {
    return <p>Loading user info...</p>;
  } // Handle initial user loading
  if (error && !userInfo) {
    return (
      <div>
        <p style={{ color: "red" }}>Error: {error}</p>
        <a href="/">Login</a>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "auto" }}>
      <h2>Goals</h2>
      {/* Only render form if userInfo is loaded */}
      {userInfo && (
        <GoalForm userId={userInfo.appUserId} onGoalAdded={handleGoalAdded} />
      )}

      <h3>Your Goals</h3>
      {/* Filter Controls */}
      <div style={{ marginBottom: "15px" }}>
        Filter by status:{" "}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: "5px" }}
          disabled={isLoading}
        >
          {" "}
          {/* Disable filter while loading */}
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="abandoned">Abandoned</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Use isLoading state to show loading message */}
      {isLoading && <p>Loading goals...</p>}
      {/* Show error only if NOT loading */}
      {error && !isLoading && <p style={{ color: "red" }}>{error}</p>}
      {/* Show "No goals" message only if NOT loading, NO error, and goals array is empty */}
      {!isLoading && goals.length === 0 && !error && (
        <p>No goals found matching the filter.</p>
      )}

      {/* Render list only if NOT loading and goals array has items */}
      {!isLoading && goals.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {goals.map((goal) => (
            <GoalItem
              key={goal.goal_id}
              goal={goal}
              userId={userInfo.appUserId}
              onGoalDeleted={handleGoalDeleted}
              onGoalStatusChanged={handleGoalStatusChanged}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
// --- End GoalsPage ---

export default GoalsPage; // Export the main page component
