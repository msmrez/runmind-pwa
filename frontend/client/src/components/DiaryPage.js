// src/components/DiaryPage.js
import React, { useState, useEffect, useCallback } from "react";
import apiClient from "../api";

// --- Helper Functions ---
const getIsoDate = (date = new Date()) => date.toISOString().split("T")[0];

const formatDate = (dateString, includeTime = true) => {
  if (!dateString) return "N/A";
  try {
    const options = { year: "numeric", month: "short", day: "numeric" };
    if (includeTime) {
      options.hour = "2-digit";
      options.minute = "2-digit";
    }
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) return "Invalid Date";
    return dateObj.toLocaleString(undefined, options);
  } catch (e) {
    console.error("Date format error:", dateString, e);
    return "Invalid Date";
  }
};

// --- Styles ---
const styles = {
  pageContainer: { padding: "20px", maxWidth: "700px", margin: "auto" },
  dateSelector: {
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  formArea: { marginTop: "20px" },
  notesTextarea: {
    width: "100%",
    marginTop: "5px",
    padding: "8px",
    boxSizing: "border-box",
    minHeight: "100px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "1em",
  },
  buttonContainer: {
    marginTop: "10px",
    display: "flex",
    justifyContent: "space-between",
  },
  deleteButton: {
    backgroundColor: "#e74c3c",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "4px",
    cursor: "pointer",
  },
  saveButton: {
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "4px",
    cursor: "pointer",
  },
  saveButtonDisabled: { backgroundColor: "#cccccc", cursor: "not-allowed" },
  loadingText: {
    fontStyle: "italic",
    color: "#555",
    textAlign: "center",
    padding: "20px 0",
  },
  errorText: {
    color: "#D8000C",
    backgroundColor: "#FFD2D2",
    border: "1px solid #D8000C",
    padding: "10px",
    borderRadius: "4px",
    margin: "10px 0",
  },
  successText: {
    color: "green",
    backgroundColor: "#DFF2BF",
    border: "1px solid #4F8A10",
    padding: "10px",
    borderRadius: "4px",
    margin: "10px 0",
  },
  // --- Comment Styles ---
  commentsSection: {
    marginTop: "30px",
    paddingTop: "20px",
    borderTop: "2px solid #eee",
  },
  noCommentsText: {
    fontStyle: "italic",
    color: "#888",
    fontSize: "0.9em",
    textAlign: "center",
  },
  commentsList: { listStyle: "none", padding: 0, margin: "10px 0 0 0" },
  commentItem: {
    marginBottom: "12px",
    paddingBottom: "12px",
    borderBottom: "1px dotted #ddd",
    fontSize: "0.95em",
    backgroundColor: "#f9f9f9",
    padding: "10px",
    borderRadius: "4px",
  },
  commentAuthor: { fontWeight: "bold", color: "#333", marginRight: "5px" },
  commentRoleRunner: { color: "#007bff" }, // Blue for runner
  commentRoleCoach: { color: "#28a745" }, // Green for coach
  commentText: {
    lineHeight: "1.4",
    display: "block",
    margin: "4px 0 6px 0",
    color: "#444",
  },
  commentTimestamp: {
    display: "block",
    textAlign: "right",
    fontSize: "0.8em",
    color: "#aaa",
  },
  addCommentForm: {
    marginTop: "20px",
    paddingTop: "15px",
    borderTop: "1px solid #eee",
  },
  commentTextarea: {
    width: "100%",
    padding: "8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    minHeight: "60px",
    boxSizing: "border-box",
    marginBottom: "8px",
    fontSize: "1em",
  },
  commentSubmitButton: {
    padding: "8px 15px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  commentSubmitButtonDisabled: {
    backgroundColor: "#cccccc",
    cursor: "not-allowed",
  },
  commentSubmitStatus: {
    fontSize: "0.9em",
    fontStyle: "italic",
    marginTop: "8px",
  },
};
// --- End Styles ---

const DiaryPage = () => {
  // --- State ---
  const [selectedDate, setSelectedDate] = useState(getIsoDate());
  const [notes, setNotes] = useState("");
  const [currentEntryId, setCurrentEntryId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [diaryComments, setDiaryComments] = useState([]);
  const [isLoadingDiaryComments, setIsLoadingDiaryComments] = useState(false);
  const [diaryCommentsError, setDiaryCommentsError] = useState("");
  const [newDiaryCommentText, setNewDiaryCommentText] = useState("");
  const [isSubmittingDiaryComment, setIsSubmittingDiaryComment] =
    useState(false);
  const [submitDiaryCommentStatus, setSubmitDiaryCommentStatus] = useState("");
  // --- End State ---

  // Load user info
  useEffect(() => {
    const storedUser = localStorage.getItem("stravaAthlete");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed?.appUserId) setUserInfo(parsed);
        else setError("Invalid user session.");
      } catch {
        setError("Corrupted user session.");
        localStorage.removeItem("stravaAthlete");
      }
    } else {
      setError("User not logged in.");
    }
  }, []);

  // Fetch Diary Comments
  const fetchDiaryComments = useCallback(async (entryId) => {
    if (!entryId) {
      setDiaryComments([]);
      setIsLoadingDiaryComments(false);
      return;
    }
    console.log(`[DiaryPage] Fetching comments for entry ID: ${entryId}`);
    setIsLoadingDiaryComments(true);
    setDiaryCommentsError("");
    setDiaryComments([]);
    try {
      const response = await apiClient.get(`/api/diary/${entryId}/comments`);
      setDiaryComments(response.data || []);
    } catch (err) {
      console.error("Error fetching diary comments:", err);
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setDiaryCommentsError(
          `Failed to load comments: ${
            err.response?.data?.message || err.message
          }`
        );
      }
      setDiaryComments([]);
    } finally {
      setIsLoadingDiaryComments(false);
    }
  }, []); // No changing dependencies

  // Fetch Diary Entry (and trigger comment fetch)
  const fetchDiaryEntry = useCallback(async () => {
    if (!userInfo || !selectedDate) return;
    console.log(`[DiaryPage] Fetching entry for date: ${selectedDate}`);
    setIsLoading(true);
    setError("");
    setSuccessMessage("");
    setNotes("");
    setCurrentEntryId(null);
    setDiaryComments([]);
    setDiaryCommentsError("");
    setIsLoadingDiaryComments(true); // Reset comment state too

    try {
      const response = await apiClient.get("/api/diary", {
        params: { date: selectedDate },
      });
      if (response.data && response.data.entry_id) {
        // Ensure entry_id exists
        console.log("[DiaryPage] Entry found:", response.data);
        setNotes(response.data.notes || "");
        setCurrentEntryId(response.data.entry_id);
        fetchDiaryComments(response.data.entry_id); // Fetch comments for this entry
      } else {
        console.log("[DiaryPage] No entry found for this date.");
        setIsLoadingDiaryComments(false); // Stop comment loading if no entry
      }
    } catch (err) {
      console.error("[DiaryPage] Error fetching diary entry:", err);
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError(
          `Failed to load entry: ${err.response?.data?.message || err.message}`
        );
      }
      setIsLoadingDiaryComments(false); // Stop comment loading on error
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, userInfo, fetchDiaryComments]); // Add fetchDiaryComments dependency

  // Trigger main fetch on date/user change
  useEffect(() => {
    fetchDiaryEntry();
  }, [fetchDiaryEntry]);

  // Handle saving entry
  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!userInfo) {
      setError("Cannot save: User not logged in.");
      return;
    }
    console.log(`[DiaryPage] Saving entry for date: ${selectedDate}`);
    setIsSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await apiClient.post("/api/diary", {
        entry_date: selectedDate,
        notes: notes,
      });
      console.log("[DiaryPage] Save successful:", response.data);
      setSuccessMessage("Entry saved successfully!");
      // If it was a new entry OR updated, ensure we have the correct ID and refetch comments
      if (!currentEntryId && response.data.entry_id) {
        setCurrentEntryId(response.data.entry_id);
        fetchDiaryComments(response.data.entry_id); // Fetch comments for new entry
      } else if (currentEntryId && currentEntryId !== response.data.entry_id) {
        // ID changed? Unlikely but handle defensively
        setCurrentEntryId(response.data.entry_id);
        fetchDiaryComments(response.data.entry_id);
      }
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("[DiaryPage] Error saving diary entry:", err);
      setError(
        `Failed to save entry: ${err.response?.data?.message || err.message}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle deleting entry
  const handleDeleteEntry = async () => {
    if (!userInfo || !currentEntryId) {
      setError("Cannot delete: No entry selected.");
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to delete the entry for ${selectedDate}?`
      )
    )
      return;
    console.log(`[DiaryPage] Deleting entry ID: ${currentEntryId}`);
    setIsSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      // Use entryId for delete if API supports it, otherwise date might be needed
      // Assuming API uses date for DELETE /api/diary for simplicity now
      await apiClient.delete("/api/diary", { params: { date: selectedDate } });
      console.log("[DiaryPage] Delete successful");
      setSuccessMessage("Entry deleted successfully!");
      setNotes("");
      setCurrentEntryId(null);
      setDiaryComments([]);
      setDiaryCommentsError("");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("[DiaryPage] Error deleting diary entry:", err);
      setError(
        `Failed to delete entry: ${err.response?.data?.message || err.message}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Adding Diary Comment
  const handleAddDiaryCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newDiaryCommentText.trim() || !currentEntryId) {
      /*...*/ return;
    }
    console.log(`[DiaryPage] Submitting comment for entry ${currentEntryId}`);
    setIsSubmittingDiaryComment(true);
    setSubmitDiaryCommentStatus("Posting comment...");
    setDiaryCommentsError("");
    try {
      const response = await apiClient.post(
        `/api/diary/${currentEntryId}/comments`,
        { commentText: newDiaryCommentText }
      );
      const newComment = response.data;
      setDiaryComments((prev) => [...prev, newComment]);
      setNewDiaryCommentText("");
      setSubmitDiaryCommentStatus("Comment posted!");
      setTimeout(() => setSubmitDiaryCommentStatus(""), 3000);
    } catch (err) {
      console.error(`[DiaryPage] Error submitting comment:`, err);
      setSubmitDiaryCommentStatus(
        `Failed to post comment: ${err.response?.data?.message || err.message}`
      );
      setDiaryCommentsError(
        `Failed to post comment: ${err.response?.data?.message || err.message}`
      );
    } finally {
      setIsSubmittingDiaryComment(false);
    }
  };

  // Handle date change
  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  // --- Render Logic ---
  if (!userInfo && !error) {
    return <p style={styles.loadingText}>Loading user info...</p>;
  }
  if (error && !userInfo) {
    return (
      <div style={styles.pageContainer}>
        <p style={styles.errorText}>{error}</p> <a href="/">Return Home</a>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <h2>Daily Diary</h2>

      {/* Date Selector */}
      <div style={styles.dateSelector}>
        <label htmlFor="diary-date" style={{ marginRight: "10px" }}>
          Select Date:
        </label>
        <input
          type="date"
          id="diary-date"
          value={selectedDate}
          onChange={handleDateChange}
          max={getIsoDate()}
          style={{ padding: "5px" }}
          disabled={isLoading || isSaving}
        />
      </div>

      {/* Loading/Error/Success for main entry */}
      {isLoading && <p style={styles.loadingText}>Loading entry...</p>}
      {error && !isLoading && <p style={styles.errorText}>{error}</p>}
      {successMessage && <p style={styles.successText}>{successMessage}</p>}

      {/* Notes Text Area and Save/Delete Buttons */}
      {userInfo && !isLoading && (
        <form onSubmit={handleSaveEntry} style={styles.formArea}>
          <label htmlFor="diary-notes">Notes for {selectedDate}:</label>
          <textarea
            id="diary-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows="8"
            placeholder="Log your training notes, feelings, nutrition, etc..."
            style={styles.notesTextarea}
            disabled={isSaving}
          />
          <div style={styles.buttonContainer}>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                ...styles.saveButton,
                ...(isSaving ? styles.saveButtonDisabled : {}),
              }}
            >
              {isSaving
                ? "Saving..."
                : currentEntryId
                ? "Update Entry"
                : "Save Entry"}
            </button>
            {currentEntryId && (
              <button
                type="button"
                onClick={handleDeleteEntry}
                disabled={isSaving}
                style={styles.deleteButton}
              >
                Delete Entry
              </button>
            )}
          </div>
        </form>
      )}

      {/* --- Comments Section (Render only if an entry is loaded) --- */}
      {currentEntryId && !isLoading && (
        <section style={styles.commentsSection}>
          <h3>Comments on this Entry</h3>
          {isLoadingDiaryComments && (
            <p style={styles.loadingText}>Loading comments...</p>
          )}
          {diaryCommentsError && (
            <p style={styles.errorText}>{diaryCommentsError}</p>
          )}
          {!isLoadingDiaryComments && !diaryCommentsError && (
            <>
              {diaryComments.length === 0 ? (
                <p style={styles.noCommentsText}>
                  No comments on this entry yet.
                </p>
              ) : (
                <ul style={styles.commentsList}>
                  {diaryComments.map((comment) => (
                    <li key={comment.comment_id} style={styles.commentItem}>
                      <strong
                        style={{
                          ...styles.commentAuthor,
                          ...(comment.commenter_role === "coach"
                            ? styles.commentRoleCoach
                            : styles.commentRoleRunner),
                        }}
                      >
                        {comment.commenter_first_name || "User"}{" "}
                        {comment.commenter_last_name ||
                          comment.commenter_user_id}{" "}
                        ({comment.commenter_role}):
                      </strong>
                      <span style={styles.commentText}>
                        {comment.comment_text}
                      </span>
                      <span style={styles.commentTimestamp}>
                        {formatDate(comment.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add Comment Form */}
              <form
                onSubmit={handleAddDiaryCommentSubmit}
                style={styles.addCommentForm}
              >
                <textarea
                  value={newDiaryCommentText}
                  onChange={(e) => setNewDiaryCommentText(e.target.value)}
                  placeholder="Add your comment..."
                  rows="3"
                  style={styles.commentTextarea}
                  disabled={isSubmittingDiaryComment}
                  required
                />
                <button
                  type="submit"
                  style={{
                    ...styles.commentSubmitButton,
                    ...(isSubmittingDiaryComment
                      ? styles.commentSubmitButtonDisabled
                      : {}),
                  }}
                  disabled={
                    isSubmittingDiaryComment || !newDiaryCommentText.trim()
                  }
                >
                  {isSubmittingDiaryComment ? "Posting..." : "Post Comment"}
                </button>
                {submitDiaryCommentStatus && (
                  <p style={styles.commentSubmitStatus}>
                    {submitDiaryCommentStatus}
                  </p>
                )}
              </form>
            </>
          )}
        </section>
      )}
      {/* --- End Comments Section --- */}
    </div> // End pageContainer
  );
};

export default DiaryPage;
