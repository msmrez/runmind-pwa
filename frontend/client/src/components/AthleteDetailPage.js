// In frontend/src/components/AthleteDetailPage.js

import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import apiClient from "../api";

// --- Helper Functions ---
const formatDate = (dateString, includeTime = true) => {
  if (!dateString) return "N/A";
  try {
    const options = {
      dateStyle: "medium",
      timeStyle: includeTime ? "short" : undefined,
    };
    return new Date(dateString).toLocaleString(undefined, options);
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return "Invalid Date";
  }
};

// --- Styles (Keep existing styles, maybe add styles for diary section) ---
// --- COMPLETE Styles Object ---
const styles = {
  // --- Page Level Styles ---
  pageContainer: {
    padding: "20px",
    maxWidth: "950px",
    margin: "20px auto",
    fontFamily: "Arial, sans-serif", // Example font - adjust to your app's font
    backgroundColor: "#f4f7f6",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  backLink: {
    marginBottom: "20px",
    display: "inline-block",
    color: "#007bff", // Example link color
    textDecoration: "none",
  },
  pageTitle: {
    marginTop: 0,
    marginBottom: "25px",
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
    color: "#D8000C", // Error red color
    backgroundColor: "#FFD2D2", // Light red background
    border: "1px solid #D8000C",
    padding: "15px",
    borderRadius: "5px",
    marginTop: "10px", // Added margin top for spacing
    marginBottom: "15px", // Added margin bottom for spacing
  },

  // --- Activity Section Styles ---
  activityList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  activityListItem: {
    backgroundColor: "#ffffff",
    border: "1px solid #e0e0e0",
    padding: "15px 20px",
    marginBottom: "15px",
    borderRadius: "6px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
  },
  activityTitle: {
    marginTop: 0,
    marginBottom: "8px",
    color: "#2c3e50",
    fontSize: "1.2em",
  },
  activityDate: {
    margin: "0 0 15px 0",
    fontSize: "0.9em",
    color: "#7f8c8d",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "12px 18px",
    marginTop: "10px",
    fontSize: "0.95em",
    paddingTop: "10px",
    borderTop: "1px solid #f0f0f0",
  },
  statItem: {
    padding: "5px 0",
  },
  statLabel: {
    fontWeight: "bold",
    color: "#34495e",
    marginRight: "5px",
  },
  mentalStateSection: {
    marginTop: "18px",
    padding: "12px 15px",
    borderTop: "1px dashed #ccc",
    fontSize: "0.9em",
    backgroundColor: "#f8f9fa",
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
    display: "inline-block",
  },
  mentalNotes: {
    marginTop: "8px",
    marginBottom: 0,
    whiteSpace: "pre-wrap",
    fontStyle: "italic",
    borderLeft: "3px solid #bdc3c7",
    paddingLeft: "10px",
    lineHeight: "1.4",
  },

  // --- Diary Section Styles ---
  diarySection: {
    marginTop: "30px", // Space above the diary section
    paddingTop: "20px",
    borderTop: "2px solid #e0e0e0", // More prominent separator
  },
  diaryList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  diaryListItem: {
    backgroundColor: "#fdfdfd", // Slightly different background for diary
    border: "1px solid #e8e8e8",
    padding: "15px",
    marginBottom: "15px",
    borderRadius: "5px",
  },
  diaryDate: {
    fontWeight: "bold",
    marginBottom: "8px",
    color: "#555",
  },
  diaryNotes: {
    margin: 0,
    whiteSpace: "pre-wrap", // Preserve formatting
    lineHeight: "1.5",
    color: "#333",
  },

  // --- Diet Section Styles ---
  dietSection: {
    marginTop: "30px", // Style similar to diary section
    paddingTop: "20px",
    borderTop: "2px solid #e0e0e0",
  },
  dietList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  dietListItem: {
    backgroundColor: "#fdfdfd", // Style similar to diary item
    border: "1px solid #e8e8e8",
    padding: "15px",
    marginBottom: "15px",
    borderRadius: "5px",
  },
  dietHeader: {
    display: "flex", // For Date and Meal Type
    justifyContent: "space-between",
    marginBottom: "8px",
    fontWeight: "bold",
    color: "#555",
  },
  dietDescription: {
    margin: "5px 0 10px 0",
    lineHeight: "1.5",
    color: "#333",
  },
  dietMacros: {
    fontSize: "0.85em",
    color: "#777",
    borderTop: "1px dashed #eee",
    paddingTop: "8px",
    marginTop: "10px",
    display: "flex", // Arrange macros inline
    gap: "15px", // Space between macro items
    flexWrap: "wrap", // Allow macros to wrap on smaller screens
  },
  trainingNotesSection: {
    // Style similar to diary/diet sections
    marginTop: "30px",
    paddingTop: "20px",
    borderTop: "2px solid #e0e0e0",
  },
  addNoteForm: {
    backgroundColor: "#f0f8ff", // Light blue background for form area
    padding: "15px",
    borderRadius: "5px",
    marginBottom: "20px",
    border: "1px solid #cce4ff",
  },
  formGroup: {
    marginBottom: "15px",
  },
  label: {
    display: "block",
    marginBottom: "5px",
    fontWeight: "bold",
    color: "#333",
  },
  input: {
    width: "150px", // Fixed width for date input
    padding: "8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "1em",
  },
  textarea: {
    width: "100%", // Full width
    padding: "8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    minHeight: "80px", // Minimum height
    fontSize: "1em",
    boxSizing: "border-box", // Include padding/border in width
  },
  submitButton: {
    padding: "10px 15px",
    backgroundColor: "#28a745", // Green color
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "1em",
    opacity: 1, // For disabled state
    transition: "background-color 0.2s ease",
  },
  submitButtonDisabled: {
    backgroundColor: "#cccccc",
    cursor: "not-allowed",
  },
  submitStatus: {
    marginTop: "10px",
    fontStyle: "italic",
  },
  notesList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  noteListItem: {
    // Style similar to diary/diet items
    backgroundColor: "#ffffff",
    border: "1px solid #e8e8e8",
    padding: "15px",
    marginBottom: "15px",
    borderRadius: "5px",
  },
  noteDateHeader: {
    fontWeight: "bold",
    marginBottom: "8px",
    color: "#555",
    fontSize: "1.05em",
  },
  noteInstructions: {
    margin: 0,
    whiteSpace: "pre-wrap", // Preserve formatting
    lineHeight: "1.5",
    color: "#333",
  },
  noteTimestamp: {
    // For created_at/updated_at
    display: "block",
    textAlign: "right",
    fontSize: "0.8em",
    color: "#999",
    marginTop: "10px",
  },
};

const AthleteDetailPage = () => {
  const { athleteId } = useParams();
  const location = useLocation();
  const athleteName = location.state?.athleteName || `Athlete ID: ${athleteId}`;

  // State for individual data sources + loading/error
  const [activities, setActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [activitiesError, setActivitiesError] = useState("");
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [isLoadingDiary, setIsLoadingDiary] = useState(true);
  const [diaryError, setDiaryError] = useState("");
  const [dietLogs, setDietLogs] = useState([]);
  const [isLoadingDiet, setIsLoadingDiet] = useState(true);
  const [dietError, setDietError] = useState("");
  // --- <<< NEW State for Training Notes >>> ---
  const [trainingNotes, setTrainingNotes] = useState([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [notesError, setNotesError] = useState("");

  // State for the 'Add Note' form
  const [newNoteDate, setNewNoteDate] = useState(""); // Default to empty or today's date string?
  const [newNoteInstructions, setNewNoteInstructions] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  // State for the combined and sorted timeline data
  const [timelineData, setTimelineData] = useState([]);

  // --- Fetch Logic (keep separate fetch functions) ---
  const fetchActivities = useCallback(async () => {
    if (!athleteId) {
      setIsLoadingActivities(false);
      return;
    }
    console.log(`[AthleteDetail] Fetching activities...`);
    setIsLoadingActivities(true);
    setActivitiesError("");
    try {
      const response = await apiClient.get(
        `/api/coaches/athletes/${athleteId}/activities`
      );
      setActivities(response.data || []);
    } catch (err) {
      console.error("Activity fetch error:", err);
      setActivitiesError("Failed to load activities.");
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [athleteId]);

  const fetchDiaryEntries = useCallback(async () => {
    if (!athleteId) {
      setIsLoadingDiary(false);
      return;
    }
    console.log(`[AthleteDetail] Fetching diary...`);
    setIsLoadingDiary(true);
    setDiaryError("");
    try {
      const response = await apiClient.get(
        `/api/coaches/athletes/${athleteId}/diary`
      );
      setDiaryEntries(response.data || []);
    } catch (err) {
      console.error("Diary fetch error:", err);
      setDiaryError("Failed to load diary entries.");
      setDiaryEntries([]);
    } finally {
      setIsLoadingDiary(false);
    }
  }, [athleteId]);

  const fetchDietLogs = useCallback(async () => {
    if (!athleteId) {
      setIsLoadingDiet(false);
      return;
    }
    console.log(`[AthleteDetail] Fetching diet logs...`);
    setIsLoadingDiet(true);
    setDietError("");
    try {
      const response = await apiClient.get(
        `/api/coaches/athletes/${athleteId}/diet`
      );
      setDietLogs(response.data || []);
    } catch (err) {
      console.error("Diet fetch error:", err);
      setDietError("Failed to load diet logs.");
      setDietLogs([]);
    } finally {
      setIsLoadingDiet(false);
    }
  }, [athleteId]);
  const fetchTrainingNotes = useCallback(async () => {
    if (!athleteId) {
      setIsLoadingNotes(false);
      return;
    }
    console.log(`[AthleteDetail] Fetching training notes for ${athleteId}...`);
    setIsLoadingNotes(true);
    setNotesError("");
    try {
      // Use the endpoint for coach viewing notes for specific athlete
      const response = await apiClient.get(
        `/api/coaches/athletes/${athleteId}/training_notes`
      );
      setTrainingNotes(response.data || []);
    } catch (err) {
      console.error("Training notes fetch error:", err);
      setNotesError("Failed to load training notes.");
      setTrainingNotes([]);
    } finally {
      setIsLoadingNotes(false);
    }
  }, [athleteId]);

  // --- <<< NEW Handler for Submitting Training Note >>> ---
  const handleAddNoteSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission
    if (!newNoteDate || !newNoteInstructions.trim()) {
      setSubmitStatus("Please provide both a date and instructions.");
      return;
    }
    setIsSubmittingNote(true);
    setSubmitStatus("Sending note...");
    setNotesError(""); // Clear previous errors

    try {
      const response = await apiClient.post(
        `/api/coaches/athletes/${athleteId}/training_notes`,
        { noteDate: newNoteDate, instructions: newNoteInstructions }
      );
      setSubmitStatus(response.data.message || "Note sent successfully!");
      setNewNoteDate(""); // Clear form
      setNewNoteInstructions("");
      // Refresh the notes list to show the new note
      fetchTrainingNotes();
      // Clear status message after a delay
      setTimeout(() => setSubmitStatus(""), 3000);
    } catch (err) {
      console.error("Submit note error:", err);
      const errorMsg = `Failed to send note: ${
        err.response?.data?.message || err.message
      }`;
      setSubmitStatus(errorMsg);
      setNotesError(errorMsg); // Also set main error state maybe
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // --- useEffect to trigger all fetches ---
  useEffect(() => {
    console.log("[AthleteDetail] Initial fetch triggered.");
    fetchActivities();
    fetchDiaryEntries();
    fetchDietLogs();
    fetchTrainingNotes(); // <-- Fetch notes too
  }, [fetchActivities, fetchDiaryEntries, fetchDietLogs, fetchTrainingNotes]); // Depend on the fetch functions

  // --- useEffect to process and combine data AFTER fetches complete ---
  useEffect(() => {
    // Only run if *all* loading states are false
    if (!isLoadingActivities && !isLoadingDiary && !isLoadingDiet) {
      console.log("[Processing] Combining data...");

      const getSafeDate = (dateStr) => {
        // Attempts to create a valid Date object, handles potential issues
        try {
          // If it's just a date string (YYYY-MM-DD), append time to avoid timezone issues during sort
          if (typeof dateStr === "string" && dateStr.length === 10) {
            return new Date(`${dateStr}T00:00:00`);
          }
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? null : d; // Return null if invalid
        } catch {
          return null;
        }
      };

      const combined = [
        ...activities.map((act) => ({
          id: `act-${act.activity_id}`,
          dateObj: getSafeDate(act.start_date_local), // Store Date object for sorting
          sortKey: getSafeDate(act.start_date_local)?.getTime() || 0, // Timestamp for reliable sort
          type: "activity",
          data: act,
        })),
        ...diaryEntries.map((entry) => ({
          id: `diary-${entry.entry_id}`,
          dateObj: getSafeDate(entry.entry_date),
          sortKey: getSafeDate(entry.entry_date)?.getTime() || 0,
          type: "diary",
          data: entry,
        })),
        ...dietLogs.map((log) => ({
          id: `diet-${log.log_id}`,
          dateObj: getSafeDate(log.log_date),
          sortKey: getSafeDate(log.log_date)?.getTime() || 0,
          type: "diet",
          data: log,
        })),
      ];

      // Filter out items with invalid dates before sorting
      const validCombined = combined.filter((item) => item.dateObj !== null);

      // Sort by timestamp, descending (most recent first)
      // If timestamps are equal (e.g., multiple entries on same day), maybe add secondary sort? (e.g., by type or created_at)
      validCombined.sort((a, b) => b.sortKey - a.sortKey);

      console.log("[Processing] Combined and sorted data:", validCombined);
      setTimelineData(validCombined);
    }
  }, [
    activities,
    diaryEntries,
    dietLogs,
    isLoadingActivities,
    isLoadingDiary,
    isLoadingDiet,
  ]);

  // --- Rendering ---
  const isLoading =
    isLoadingActivities || isLoadingDiary || isLoadingDiet || isLoadingNotes;
  let currentDate = null; // Track date changes for headers

  return (
    <div style={styles.pageContainer}>
      <Link to="/coach/dashboard" style={styles.backLink}>
        ← Back to Coach Dashboard
      </Link>
      <h2 style={styles.pageTitle}>{athleteName}'s Details & Plan</h2>

      {isLoading && (
        <p style={styles.loadingText}>Loading athlete details...</p>
      )}

      {/* Display combined errors */}
      {!isLoading &&
        (activitiesError || diaryError || dietError || notesError) && (
          <div style={styles.errorText}>
            {activitiesError && <p>{activitiesError}</p>}
            {diaryError && <p>{diaryError}</p>}
            {dietError && <p>{dietError}</p>}
            {notesError && <p>{notesError}</p>}
          </div>
        )}

      {!isLoading &&
        !(activitiesError || diaryError || dietError || notesError) && (
          <>
            {/* --- <<< START: Training Notes Section COMPLETE >>> --- */}
            <section style={styles.trainingNotesSection}>
              <h3>Training Notes & Instructions</h3>

              {/* Add Note Form */}
              <form onSubmit={handleAddNoteSubmit} style={styles.addNoteForm}>
                {" "}
                {/* <<< USE handleAddNoteSubmit */}
                <h4>Add New Note</h4>
                <div style={styles.formGroup}>
                  <label htmlFor="noteDate" style={styles.label}>
                    Date:
                  </label>
                  <input
                    type="date"
                    id="noteDate"
                    value={newNoteDate}
                    onChange={(e) => setNewNoteDate(e.target.value)}
                    required
                    disabled={isSubmittingNote}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label htmlFor="noteInstructions" style={styles.label}>
                    Instructions:
                  </label>
                  <textarea
                    id="noteInstructions"
                    value={newNoteInstructions}
                    onChange={(e) => setNewNoteInstructions(e.target.value)}
                    required
                    disabled={isSubmittingNote}
                    style={styles.textarea}
                    placeholder="Enter workout details, focus points, or recovery instructions..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingNote}
                  style={{
                    ...styles.submitButton,
                    ...(isSubmittingNote ? styles.submitButtonDisabled : {}),
                  }}
                >
                  {isSubmittingNote ? "Sending..." : "Add Note"}{" "}
                  {/* <<< USE isSubmittingNote */}
                </button>
                {submitStatus && (
                  <p style={styles.submitStatus}>{submitStatus}</p>
                )}{" "}
                {/* <<< USE submitStatus */}
              </form>

              {/* Display Existing Notes */}
              <h4>Sent Notes</h4>
              {isLoadingNotes && <p>Loading notes...</p>}
              {!isLoadingNotes && notesError && (
                <p style={{ color: "red" }}>{notesError}</p>
              )}
              {!isLoadingNotes &&
                !notesError &&
                trainingNotes.length === 0 && ( // <<< USE trainingNotes */}
                  <p>No training notes sent to this athlete yet.</p>
                )}
              {!isLoadingNotes && !notesError && trainingNotes.length > 0 && (
                <ul style={styles.notesList}>
                  {trainingNotes.map(
                    (
                      note // <<< USE trainingNotes */}
                    ) => (
                      <li key={note.note_id} style={styles.noteListItem}>
                        <div style={styles.noteDateHeader}>
                          {formatDate(note.note_date, false)} {/* Date only */}
                        </div>
                        <p style={styles.noteInstructions}>
                          {note.instructions}
                        </p>
                        <span style={styles.noteTimestamp}>
                          Sent: {formatDate(note.created_at)}
                        </span>
                        {/* Add Edit/Delete buttons later if needed */}
                      </li>
                    )
                  )}
                </ul>
              )}
            </section>
            {/* --- <<< END: Training Notes Section COMPLETE >>> --- */}
            {/* --- <<< START: Chronological Timeline Section UPDATED >>> --- */}
            <section style={{ marginTop: "30px" }}>
              <h3>Chronological Timeline</h3>
              {/* Check if timelineData is empty AFTER processing */}
              {timelineData.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#666",
                    marginTop: "20px",
                  }}
                >
                  No activities, diary entries, or diet logs found.
                </p>
              ) : (
                timelineData.map((item) => {
                  // Get date string for header comparison (without time)
                  const itemDateStr = item.dateObj
                    ? formatDate(item.dateObj, false)
                    : "Invalid Date";
                  let dateHeader = null;
                  // Render header if date is valid and different from the previous one
                  if (
                    itemDateStr !== "Invalid Date" &&
                    itemDateStr !== currentDate
                  ) {
                    dateHeader = (
                      <h3 style={styles.timelineDateHeader}>{itemDateStr}</h3>
                    );
                    currentDate = itemDateStr; // Update the current date tracker
                  }

                  return (
                    <React.Fragment key={item.id}>
                      {dateHeader} {/* Render the date header if needed */}
                      <div style={styles.timelineItem}>
                        {" "}
                        {/* Common wrapper with left border */}
                        {/* --- Render Activity Item --- */}
                        {item.type === "activity" && (
                          <div style={styles.activityTimelineItem}>
                            {" "}
                            {/* Specific activity card style */}
                            <h4 style={styles.activityTitle}>
                              {item.data.name} ({item.data.type})
                            </h4>
                            <p style={styles.activityDateTime}>
                              {formatDate(item.data.start_date_local)}
                            </p>{" "}
                            {/* Full date/time */}
                            <div style={styles.statsGrid}>
                              <div
                                style={styles.statItem}
                                title={`Dist: ${item.data.distance}m`}
                              >
                                <span style={styles.statLabel}>Dist:</span>{" "}
                                {item.data.distance_km || "N/A"} km
                              </div>
                              <div
                                style={styles.statItem}
                                title={`Time: ${item.data.moving_time}s`}
                              >
                                <span style={styles.statLabel}>Time:</span>{" "}
                                {item.data.moving_time_formatted}
                              </div>
                              <div style={styles.statItem}>
                                <span style={styles.statLabel}>Pace:</span>{" "}
                                {item.data.pace_per_km}
                              </div>
                              <div
                                style={styles.statItem}
                                title={`Avg HR: ${item.data.average_heartrate}`}
                              >
                                <span style={styles.statLabel}>Avg HR:</span>{" "}
                                {item.data.average_heartrate_formatted}
                              </div>
                              <div
                                style={styles.statItem}
                                title={`Max HR: ${item.data.max_heartrate}`}
                              >
                                <span style={styles.statLabel}>Max HR:</span>{" "}
                                {item.data.max_heartrate
                                  ? `${item.data.max_heartrate.toFixed(0)} bpm`
                                  : "N/A"}
                              </div>
                              <div
                                style={styles.statItem}
                                title={`Elev Gain: ${item.data.total_elevation_gain}m`}
                              >
                                <span style={styles.statLabel}>Elev Gain:</span>{" "}
                                {item.data.total_elevation_gain !== null &&
                                !isNaN(item.data.total_elevation_gain)
                                  ? `${item.data.total_elevation_gain.toFixed(
                                      0
                                    )} m`
                                  : "N/A"}
                              </div>
                            </div>
                            {(item.data.mental_mood ||
                              item.data.mental_focus ||
                              item.data.mental_stress ||
                              item.data.mental_notes) && (
                              <div style={styles.mentalStateSection}>
                                <span style={styles.mentalStateTitle}>
                                  Athlete's Log:
                                </span>
                                <span style={styles.mentalStateItem}>
                                  {item.data.mental_mood
                                    ? `Mood: ${item.data.mental_mood}/5`
                                    : ""}
                                </span>
                                <span style={styles.mentalStateItem}>
                                  {item.data.mental_focus
                                    ? `Focus: ${item.data.mental_focus}/5`
                                    : ""}
                                </span>
                                <span style={styles.mentalStateItem}>
                                  {item.data.mental_stress
                                    ? `Stress: ${item.data.mental_stress}/5`
                                    : ""}
                                </span>
                                {item.data.mental_notes && (
                                  <p style={styles.mentalNotes}>
                                    "{item.data.mental_notes}"
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {/* --- Render Diary Item --- */}
                        {item.type === "diary" && (
                          <div style={styles.diaryTimelineItem}>
                            {" "}
                            {/* Specific diary card style */}
                            <p style={styles.diaryNotes}>
                              {item.data.notes || (
                                <i>(No diary notes for this day)</i>
                              )}
                            </p>
                          </div>
                        )}
                        {/* --- Render Diet Item --- */}
                        {item.type === "diet" && (
                          <div style={styles.dietTimelineItem}>
                            {" "}
                            {/* Specific diet card style */}
                            <div style={styles.dietHeader}>
                              <span>
                                {item.data.meal_type || "General Log"}
                              </span>
                            </div>
                            <p style={styles.dietDescription}>
                              {item.data.description || <i>(No description)</i>}
                            </p>
                            {(item.data.estimated_calories !== null ||
                              item.data.estimated_protein !== null ||
                              item.data.estimated_carbs !== null ||
                              item.data.estimated_fat !== null) && (
                              <div style={styles.dietMacros}>
                                {item.data.estimated_calories !== null && (
                                  <span>
                                    Cals: {item.data.estimated_calories}
                                  </span>
                                )}
                                {item.data.estimated_protein !== null && (
                                  <span>P: {item.data.estimated_protein}g</span>
                                )}
                                {item.data.estimated_carbs !== null && (
                                  <span>C: {item.data.estimated_carbs}g</span>
                                )}
                                {item.data.estimated_fat !== null && (
                                  <span>F: {item.data.estimated_fat}g</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>{" "}
                      {/* End timelineItem */}
                    </React.Fragment>
                  );
                }) // End timelineData.map
              )}{" "}
              {/* End ternary for timelineData.length */}
            </section>
            {/* --- <<< END: Chronological Timeline Section UPDATED >>> --- */}
          </>
        )}
    </div> // End pageContainer
  );
};

// --- Update Export ---
export default AthleteDetailPage;
