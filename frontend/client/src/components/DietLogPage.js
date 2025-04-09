// src/components/DietLogPage.js
import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../api";

// Helper to format date as YYYY-MM-DD
const getIsoDate = (date = new Date()) => {
  return date.toISOString().split("T")[0];
};

// Basic form component for adding/editing (initially just adding)
const DietLogForm = ({ userId, selectedDate, onLogAdded }) => {
  const [mealType, setMealType] = useState("Breakfast");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack", "Other"];

  const resetForm = () => {
    // Keep meal type potentially, or reset: setMealType('Breakfast');
    setDescription("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setError("");
    setIsSaving(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!mealType) {
      setError("Meal type is required.");
      return;
    }

    setIsSaving(true);
    setError("");

    const logData = {
      log_date: selectedDate,
      meal_type: mealType,
      description: description,
      estimated_calories: calories || null, // Send null if empty
      estimated_protein: protein || null,
      estimated_carbs: carbs || null,
      estimated_fat: fat || null,
    };

    try {
      const response = await apiClient.post("/api/diet", logData);
      console.log("[DietLogForm] Save successful:", response.data);
      onLogAdded(response.data); // Notify parent component
      resetForm(); // Clear form on success
    } catch (err) {
      console.error(
        "[DietLogForm] Error saving log:",
        err.response?.data || err.message
      );
      setError(`Failed to save: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid #ccc",
        padding: "15px",
        borderRadius: "5px",
        marginTop: "10px",
        marginBottom: "20px",
      }}
    >
      <h4>Add New Entry for {selectedDate}</h4>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div style={{ marginBottom: "10px" }}>
        <label htmlFor="mealType" style={{ marginRight: "10px" }}>
          Meal Type:
        </label>
        <select
          id="mealType"
          value={mealType}
          onChange={(e) => setMealType(e.target.value)}
          required
        >
          {mealTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: "10px" }}>
        <label htmlFor="description">Description:</label>
        <br />
        <input
          type="text"
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          style={{ width: "95%" }}
          placeholder="e.g., Chicken salad sandwich"
        />
      </div>
      {/* Optional Fields */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "10px",
        }}
      >
        <div>
          <label htmlFor="calories">Calories (est):</label>
          <br />
          <input
            type="number"
            id="calories"
            min="0"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="kcal"
            style={{ width: "80px" }}
          />
        </div>
        <div>
          <label htmlFor="protein">Protein (est):</label>
          <br />
          <input
            type="number"
            id="protein"
            min="0"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="g"
            style={{ width: "60px" }}
          />
        </div>
        <div>
          <label htmlFor="carbs">Carbs (est):</label>
          <br />
          <input
            type="number"
            id="carbs"
            min="0"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            placeholder="g"
            style={{ width: "60px" }}
          />
        </div>
        <div>
          <label htmlFor="fat">Fat (est):</label>
          <br />
          <input
            type="number"
            id="fat"
            min="0"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            placeholder="g"
            style={{ width: "60px" }}
          />
        </div>
      </div>
      <button type="submit" disabled={isSaving}>
        {isSaving ? "Saving..." : "Add Log Entry"}
      </button>
    </form>
  );
};

// Main page component
const DietLogPage = () => {
  const [selectedDate, setSelectedDate] = useState(getIsoDate());
  const [logs, setLogs] = useState([]); // Array of logs for the selected date
  const [dailyTotals, setDailyTotals] = useState({
    cals: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [userInfo, setUserInfo] = useState(null);

  // Load user info
  useEffect(() => {
    const storedUser = localStorage.getItem("stravaAthlete");
    if (storedUser) {
      /* ... set user info or error ... */
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
  }, []);

  // --- Fetch logs when selectedDate or userInfo changes ---
  const fetchDietLogs = useCallback(async () => {
    if (!userInfo || !selectedDate) return;
    console.log(
      `[DietLogPage] Fetching logs for date: ${selectedDate}, User: ${userInfo.appUserId}`
    );
    setIsLoading(true);
    setError("");
    setLogs([]); // Reset

    try {
      const response = await apiClient.get("/api/diet", {
        params: { date: selectedDate }, // Auth header added by interceptor
      });
      setLogs(response.data || []);
      console.log("[DietLogPage] Logs fetched:", response.data);
    } catch (err) {
      console.error(
        "[DietLogPage] Error fetching logs:",
        err.response?.data || err.message
      );
      setError(
        `Failed to load logs: ${err.response?.data?.message || err.message}`
      );
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, userInfo]);

  // Trigger fetch on load and date/user change
  useEffect(() => {
    fetchDietLogs();
  }, [fetchDietLogs]);

  // --- Calculate Totals whenever logs change ---
  useEffect(() => {
    let totals = { cals: 0, protein: 0, carbs: 0, fat: 0 };
    logs.forEach((log) => {
      totals.cals += log.estimated_calories || 0;
      totals.protein += log.estimated_protein || 0;
      totals.carbs += log.estimated_carbs || 0;
      totals.fat += log.estimated_fat || 0;
    });
    setDailyTotals(totals);
    console.log("[DietLogPage] Daily totals updated:", totals);
  }, [logs]); // Recalculate when logs state changes

  // Handle date change
  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  // Callback function for the form to add the new log to the list instantly
  const handleLogAdded = (newLog) => {
    setLogs((currentLogs) =>
      [...currentLogs, newLog].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      )
    ); // Add and sort
  };

  // --- Render Logic ---
  if (!userInfo && !error) {
    return <p>Loading user info...</p>;
  }
  if (error && !userInfo) {
    return (
      <div style={{ padding: "20px" }}>
        <p style={{ color: "red" }}>Error: {error}</p>{" "}
        <a href="/">Return Home</a>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "auto" }}>
      <h2>Daily Diet Log</h2>

      {/* Date Selector */}
      <div>
        <label htmlFor="diet-date" style={{ marginRight: "10px" }}>
          Log Date:
        </label>
        <input
          type="date"
          id="diet-date"
          value={selectedDate}
          onChange={handleDateChange}
          max={getIsoDate()}
          style={{ padding: "5px" }}
          disabled={isLoading}
        />
      </div>

      {/* Add New Entry Form */}
      {userInfo && (
        <DietLogForm
          userId={userInfo.appUserId}
          selectedDate={selectedDate}
          onLogAdded={handleLogAdded}
        />
      )}

      {/* Display Logs for Selected Date */}
      <h3>Entries for {selectedDate}</h3>
      {isLoading && <p>Loading entries...</p>}
      {error && !isLoading && <p style={{ color: "red" }}>{error}</p>}
      {!isLoading && logs.length === 0 && !error && (
        <p>No diet entries logged for this date.</p>
      )}

      {!isLoading && logs.length > 0 && (
        <>
          {/* Daily Totals Summary */}
          <div
            style={{
              border: "1px dashed #aaa",
              padding: "10px",
              marginBottom: "15px",
              backgroundColor: "#f9f9f9",
            }}
          >
            <strong>Daily Totals (Est.): </strong>
            Calories: {dailyTotals.cals} kcal | Protein: {dailyTotals.protein}g
            | Carbs: {dailyTotals.carbs}g | Fat: {dailyTotals.fat}g
          </div>

          {/* Log List/Table */}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {logs.map((log) => (
              <li
                key={log.log_id}
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "10px 0",
                  marginBottom: "5px",
                }}
              >
                <strong>{log.meal_type}:</strong> {log.description}
                <div
                  style={{ fontSize: "0.9em", color: "#555", marginTop: "3px" }}
                >
                  {log.estimated_calories && `~${log.estimated_calories} kcal`}
                  {log.estimated_protein && ` / ${log.estimated_protein}g P`}
                  {log.estimated_carbs && ` / ${log.estimated_carbs}g C`}
                  {log.estimated_fat && ` / ${log.estimated_fat}g F`}
                  {/* Add Edit/Delete buttons here later if needed */}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default DietLogPage;
