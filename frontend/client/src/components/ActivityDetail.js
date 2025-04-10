// src/components/ActivityDetail.js
import React, { useState, useEffect, useCallback } from "react"; // Ensure useCallback is imported
import { useParams, Link } from "react-router-dom";
import apiClient from "../api";
import MentalStateLogger from "./MentalStateLogger";

// --- Styles (Keep your complete styles object) ---
const styles = {
  pageContainer: { padding: "20px", maxWidth: "800px", margin: "auto" },
  backLink: { marginBottom: "15px", display: "inline-block" },
  errorText: {
    color: "#D8000C",
    backgroundColor: "#FFD2D2",
    border: "1px solid #D8000C",
    padding: "15px",
    borderRadius: "5px",
    marginTop: "10px",
  },
  statsGridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "15px",
    margin: "20px 0",
  },
  statCard: {
    border: "1px solid #eee",
    padding: "10px",
    borderRadius: "4px",
    textAlign: "center",
  },
  statLabel: { fontWeight: "bold", display: "block", marginBottom: "5px" },
  mapPlaceholder: {
    border: "1px dashed #ccc",
    height: "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#aaa",
    marginBottom: "20px",
  },
  mentalStateContainer: {
    border: "1px solid #eee",
    padding: "15px",
    backgroundColor: "#fdfdfd",
    marginTop: "20px",
  },
  commentsSection: {
    marginTop: "30px",
    paddingTop: "20px",
    borderTop: "2px solid #eee",
  },
  noCommentsText: { fontStyle: "italic", color: "#888", fontSize: "0.9em" },
  commentsList: { listStyle: "none", padding: 0, margin: "10px 0 0 0" },
  commentItem: {
    marginBottom: "10px",
    paddingBottom: "10px",
    borderBottom: "1px dotted #eee",
    fontSize: "0.95em",
  },
  commentAuthor: { fontWeight: "bold", color: "#333", marginRight: "5px" },
  commentRoleRunner: { color: "#007bff" },
  commentRoleCoach: { color: "#28a745" },
  commentText: { lineHeight: "1.4", display: "block", margin: "3px 0 5px 0" },
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

// --- Helper Functions (Define ONCE) ---
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

const formatStat = (value, unit = "") => {
  // Handle pre-formatted strings like pace first
  if (typeof value === "string" && value.includes("/")) return value; // Assume pace string like "X:XX /km"

  if (value === null || value === undefined) return "N/A";

  // Handle numbers
  if (typeof value === "number" && !isNaN(value)) {
    // Simple rounding for display, adjust precision as needed
    // If it's likely an integer (e.g., HR), don't add decimals
    if (Math.floor(value) === value && !unit.includes("km")) {
      // Don't format distance with 0 decimals if integer
      return `${value}${unit}`;
    }
    // Otherwise round to 1 or 2 decimals depending on context
    const roundedValue = Math.round(value * 10) / 10; // Example: 1 decimal place
    return `${roundedValue}${unit}`;
  }
  // Return original value + unit if not easily formatted
  return `${value}${unit}`;
};
// --- End Helper Functions ---

// --- Component Definition ---
const ActivityDetail = () => {
  const { activityId } = useParams();
  const [activity, setActivity] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [commentsError, setCommentsError] = useState("");
  const [newCommentText, setNewCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [submitCommentStatus, setSubmitCommentStatus] = useState("");

  // useEffect for UserInfo (Keep as is)
  useEffect(() => {
    const storedUser = localStorage.getItem("stravaAthlete");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed.appUserId) {
          setUserInfo(parsed);
        } else {
          setError("User session invalid. Please log in again.");
        }
      } catch (e) {
        setError("Error reading user session.");
        localStorage.removeItem("stravaAthlete");
      }
    } else {
      setError("User not logged in.");
    }
  }, []);

  // fetchComments function (Keep as is)
  const fetchComments = useCallback(async () => {
    if (!activityId) {
      setCommentsError("Activity ID missing.");
      setIsLoadingComments(false);
      return;
    }
    console.log(
      `[ActivityDetail] Fetching comments for activity ${activityId}...`
    );
    setIsLoadingComments(true);
    setCommentsError("");
    setComments([]);
    try {
      const response = await apiClient.get(
        `/api/activities/${activityId}/comments`
      );
      const data = response.data || [];
      setComments(data);
      console.log("[ActivityDetail fetchComments] Data set:", data);
    } catch (err) {
      console.error(`[ActivityDetail] Error fetching comments:`, err);
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setCommentsError(
          `Failed to load comments: ${
            err.response?.data?.message || err.message
          }`
        );
      }
      setComments([]);
    } finally {
      setIsLoadingComments(false);
      console.log("[ActivityDetail fetchComments] Finished.");
    }
  }, [activityId]);

  // Single useEffect for fetching Activity and then Comments
  useEffect(() => {
    // Don't fetch if user info failed or no activityId
    if (!userInfo || !activityId) {
      setIsLoading(false); // Stop main loading
      setIsLoadingComments(false); // Stop comments loading
      // Set error only if not already set by user info loading
      if (!error && !userInfo) setError("User info not available.");
      if (!error && !activityId) setError("Activity ID missing.");
      return;
    }

    const fetchActivityAndComments = async () => {
      setIsLoading(true); // Main loading starts
      setError(""); // Clear previous main errors
      // Reset comments state when activityId changes
      setComments([]);
      setIsLoadingComments(true);
      setCommentsError("");

      console.log(`[ActivityDetail] Fetching activity ${activityId}`);
      try {
        const response = await apiClient.get(`/api/activities/${activityId}`);
        // Add safety check for response data
        if (response.data && response.data.activity_id) {
          setActivity(response.data);
          console.log(
            "[ActivityDetail] Activity fetched, now fetching comments..."
          );
          fetchComments(); // Trigger comment fetch
        } else {
          // Handle case where API returns OK but no valid activity data
          throw new Error("Received invalid activity data from server.");
        }
      } catch (err) {
        console.error("[ActivityDetail] Error fetching activity details:", err);
        if (err.response?.status !== 401 && err.response?.status !== 403) {
          setError(
            `Failed to load activity: ${
              err.response?.data?.message || err.message
            }`
          );
        } // Interceptor handles 401/403
        setActivity(null); // Clear activity state
        setIsLoadingComments(false); // Ensure comments loading stops
      } finally {
        setIsLoading(false); // Main loading ends regardless of success/failure
      }
    };

    fetchActivityAndComments();
    // Dependencies: Run when activityId or userInfo changes. fetchComments is stable.
  }, [activityId, userInfo, fetchComments]);

  // handleMentalStateUpdate (Keep as is)
  const handleMentalStateUpdate = (id, updatedState) => {
    if (!activity || activity.activity_id !== id) return; // Guard clause
    console.log(
      `[ActivityDetail] handleMentalStateUpdate called for activity ${id}`,
      updatedState
    );
    setActivity((currentActivity) => ({ ...currentActivity, ...updatedState }));
  };

  // handleAddCommentSubmit (Keep as is)
  const handleAddCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activityId) {
      /* ... */ return;
    }
    console.log(
      `[ActivityDetail] Submitting comment for activity ${activityId}`
    );
    setIsSubmittingComment(true);
    setSubmitCommentStatus("Posting comment...");
    setCommentsError("");
    try {
      const response = await apiClient.post(
        `/api/activities/${activityId}/comments`,
        { commentText: newCommentText }
      );
      const newComment = response.data;
      setComments((prev) => [...prev, newComment]); // Add to list
      setNewCommentText("");
      setSubmitCommentStatus("Comment posted!");
      setTimeout(() => setSubmitCommentStatus(""), 3000);
    } catch (err) {
      /* ... error handling ... */
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // --- Rendering Logic ---
  // Initial Loading State
  if (isLoading && !activity && !error) {
    return <p style={styles.loadingText}>Loading activity details...</p>;
  }

  // Display Error if activity fetch failed or user info failed
  if (error) {
    return (
      <div style={styles.pageContainer}>
        <p style={styles.errorText}>{error}</p>
        <Link to="/dashboard" style={styles.backLink}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // If loading finished but activity is still null (and no main error)
  if (!activity && !isLoading) {
    return (
      <div style={styles.pageContainer}>
        <p>Activity data not available or failed to load.</p>
        <Link to="/dashboard" style={styles.backLink}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // --- Render Page Content (only if activity is loaded) ---
  return (
    <div style={styles.pageContainer}>
      <Link to="/dashboard" style={styles.backLink}>
        ← Back to Dashboard
      </Link>
      {/* Render details only if activity object exists */}
      {activity && (
        <>
          <h2>{activity.name}</h2>
          <p>
            <strong>Date:</strong> {formatDate(activity.start_date_local)} (
            {activity.timezone})
          </p>
          <p>
            <strong>Type:</strong> {activity.type}
          </p>

          {/* Stats Grid */}
          <div style={styles.statsGridContainer}>
            {/* Use formatStat correctly */}
            <div style={styles.statCard}>
              {" "}
              <div style={styles.statLabel}>Distance</div>{" "}
              <div>{formatStat(activity.distance_km, " km")}</div>{" "}
            </div>
            {/* Use pre-formatted time or format raw time */}
            <div style={styles.statCard}>
              {" "}
              <div style={styles.statLabel}>Moving Time</div>{" "}
              <div>
                {activity.moving_time_formatted ||
                  formatStat(activity.moving_time, "s")}
              </div>{" "}
            </div>
            <div style={styles.statCard}>
              {" "}
              <div style={styles.statLabel}>Pace</div>{" "}
              <div>{activity.pace_per_km || "N/A"}</div>{" "}
            </div>
            <div style={styles.statCard}>
              {" "}
              <div style={styles.statLabel}>Elevation Gain</div>{" "}
              <div>{formatStat(activity.total_elevation_gain, " m")}</div>{" "}
            </div>
            <div style={styles.statCard}>
              {" "}
              <div style={styles.statLabel}>Avg HR</div>{" "}
              <div>{formatStat(activity.average_heartrate, " bpm")}</div>{" "}
            </div>
            <div style={styles.statCard}>
              {" "}
              <div style={styles.statLabel}>Max HR</div>{" "}
              <div>{formatStat(activity.max_heartrate, " bpm")}</div>{" "}
            </div>
          </div>

          {/* Map Placeholder */}
          <div style={styles.mapPlaceholder}> Map Placeholder </div>

          {/* Mental State Section */}
          <div style={styles.mentalStateContainer}>
            <h4>Mental State Log</h4>
            {/* Display state */}
            {!activity.mental_mood &&
              !activity.mental_focus &&
              !activity.mental_stress &&
              !activity.mental_notes && (
                <p style={{ color: "#888", fontStyle: "italic" }}>
                  (Not logged yet)
                </p>
              )}
            {activity.mental_mood && (
              <p>
                <strong>Mood:</strong> {activity.mental_mood}/5
              </p>
            )}
            {activity.mental_focus && (
              <p>
                <strong>Focus:</strong> {activity.mental_focus}/5
              </p>
            )}
            {activity.mental_stress && (
              <p>
                <strong>Stress:</strong> {activity.mental_stress}/5
              </p>
            )}
            {activity.mental_notes && (
              <p>
                <strong>Notes:</strong>
                <br />
                {activity.mental_notes}
              </p>
            )}
            {/* Logger */}
            {userInfo && (
              <MentalStateLogger
                activity={activity}
                onSave={handleMentalStateUpdate}
                userId={userInfo.appUserId}
              />
            )}
          </div>

          {/* Comments Section */}
          <section style={styles.commentsSection}>
            <h3>Comments</h3>
            {isLoadingComments && <p>Loading comments...</p>}
            {commentsError && (
              <p style={{ ...styles.errorText, marginTop: 0 }}>
                {commentsError}
              </p>
            )}
            {!isLoadingComments && !commentsError && (
              <>
                {comments.length === 0 ? (
                  <p style={styles.noCommentsText}>No comments yet.</p>
                ) : (
                  <ul style={styles.commentsList}>
                    {comments.map((comment) => (
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
                        </span>{" "}
                        {/* Use correct helper */}
                      </li>
                    ))}
                  </ul>
                )}
                {/* Add Comment Form */}
                <form
                  onSubmit={handleAddCommentSubmit}
                  style={styles.addCommentForm}
                >
                  <textarea
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Add your comment..."
                    rows="3"
                    style={styles.commentTextarea}
                    disabled={isSubmittingComment}
                    required
                  />
                  <button
                    type="submit"
                    style={{
                      ...styles.commentSubmitButton,
                      ...(isSubmittingComment
                        ? styles.commentSubmitButtonDisabled
                        : {}),
                    }}
                    disabled={isSubmittingComment || !newCommentText.trim()}
                  >
                    {isSubmittingComment ? "Posting..." : "Post Comment"}
                  </button>
                  {submitCommentStatus && (
                    <p style={styles.commentSubmitStatus}>
                      {submitCommentStatus}
                    </p>
                  )}
                </form>
              </>
            )}
          </section>
        </>
      )}{" "}
      {/* End check for activity */}
    </div> // End pageContainer
  );
};

export default ActivityDetail;
