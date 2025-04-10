// src/components/MentalStateLogger.js
import React, { useState, useEffect } from "react";
import apiClient from "../api";
const MentalStateLogger = ({ activity, onSave, userId }) => {
  const [isLogging, setIsLogging] = useState(false);
  // State for the form inputs, initialized from the activity prop or empty string
  const [mood, setMood] = useState(activity.mental_mood ?? "");
  const [focus, setFocus] = useState(activity.mental_focus ?? "");
  const [stress, setStress] = useState(activity.mental_stress ?? "");
  const [notes, setNotes] = useState(activity.mental_notes ?? "");
  // State for loading/error handling within this specific form
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Log when isLogging state changes (for debugging)
  useEffect(() => {}, [isLogging, activity.activity_id]);

  // Effect to update local form state if the activity data changes from the parent
  useEffect(() => {
    // Only reset if the form is NOT currently being shown,
    // otherwise, user's input would be overwritten on background data refresh.
    if (!isLogging) {
      setMood(activity.mental_mood ?? "");
      setFocus(activity.mental_focus ?? "");
      setStress(activity.mental_stress ?? "");
      setNotes(activity.mental_notes ?? "");
      // console.log(
      //   `%c[MSL Activity ${activity.activity_id}] Props updated while form closed, resetting state.`,
      //   "color: purple;"
      // );
    } else {
      console.log(
        `%c[MSL Activity ${activity.activity_id}] Props updated while form open, NOT resetting state.`,
        "color: purple;"
      );
    }
    // Clear error when activity context changes
    setError("");
  }, [
    activity.mental_mood,
    activity.mental_focus,
    activity.mental_stress,
    activity.mental_notes,
    activity.activity_id,
    isLogging,
  ]); // Added isLogging dependency

  // Function to handle saving the mental state data (RESTORED)
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
      const response = await apiClient.post(
        `/api/activities/${activity.activity_id}/mental_state`,
        dataToSend
      );
      console.log(
        `%c[MSL Activity ${activity.activity_id}] Save response:`,
        "color: green;",
        response.data
      );
      onSave(activity.activity_id, response.data.updatedState); // Call parent handler
      setIsLogging(false); // Close form on success
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

  // --- Rendering Logic ---
  // console.log(
  //   `%c[MSL Activity ${activity.activity_id}] Rendering. isLogging: ${isLogging}`,
  //   "color: gray;"
  // );

  if (!isLogging) {
    // console.log(
    //   `%c[MSL Activity ${activity.activity_id}] Rendering Button.`,
    //   "color: gray;"
    // );
    return (
      <button
        onClick={() => {
          console.log(/*...*/);
          setIsLogging(true);
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

  // --- Render the ORIGINAL form when isLogging is true ---
  console.log(
    `%c[MSL Activity ${activity.activity_id}] Rendering Form.`,
    "color: teal; font-weight: bold;"
  );
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
          disabled={saving}
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
          disabled={saving}
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
          disabled={saving}
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
          disabled={saving}
        />
      </div>
      {error && (
        <p style={{ color: "red", fontSize: "0.9em", margin: "5px 0 0 0" }}>
          {error}
        </p>
      )}
      <div style={{ marginTop: "8px" }}>
        {/* Button calls handleSave */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ marginRight: "5px" }}
        >
          {saving ? "Saving..." : "Save State"}
        </button>
        {/* Cancel button */}
        <button
          onClick={() => {
            console.log(/*...*/);
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
  // --- NO second return statement here ---
};

export default MentalStateLogger;
