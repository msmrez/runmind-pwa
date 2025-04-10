// backend/controllers/commentController.js

const db = require("../db");
const asyncHandler = require("express-async-handler"); // Assuming you use this

/**
 * @desc    Get comments for a specific activity
 * @route   GET /api/activities/:activityId/comments
 * @access  Private (Runner who owns activity, Coach linked to runner)
 */
exports.getActivityComments = asyncHandler(async (req, res, next) => {
  const requestingUserId = req.user.userId;
  const requestingUserRole = req.user.role;
  const { activityId } = req.params;

  const activityIdInt = parseInt(activityId, 10);
  if (isNaN(activityIdInt)) {
    return res.status(400).json({ message: "Invalid Activity ID." });
  }

  console.log(
    `[Ctrl-getComments] User ${requestingUserId} requesting comments for Activity ${activityIdInt}`
  );

  // 1. Get the owner of the activity
  const activityOwnerQuery =
    "SELECT user_id FROM activities WHERE activity_id = $1";
  const ownerResult = await db.query(activityOwnerQuery, [activityIdInt]);

  if (ownerResult.rowCount === 0) {
    return res.status(404).json({ message: "Activity not found." });
  }
  const activityOwnerId = ownerResult.rows[0].user_id;

  // 2. Authorization Check:
  let isAuthorized = false;
  // User is the owner?
  if (requestingUserId === activityOwnerId) {
    isAuthorized = true;
  }
  // User is a coach linked to the owner?
  else if (requestingUserRole === "coach") {
    const linkCheckQuery = `
            SELECT 1 FROM coach_athlete_links
            WHERE coach_user_id = $1 AND athlete_user_id = $2 AND status = 'accepted';
        `;
    const linkCheck = await db.query(linkCheckQuery, [
      requestingUserId,
      activityOwnerId,
    ]);
    if (linkCheck.rowCount > 0) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    console.warn(
      `[Ctrl-getComments] Auth Failure: User ${requestingUserId} cannot view comments for Activity ${activityIdInt} owned by ${activityOwnerId}`
    );
    return res
      .status(403)
      .json({ message: "Not authorized to view these comments." });
  }

  // 3. Fetch Comments (join with users to get commenter's name)
  const commentsQuery = `
        SELECT c.comment_id, c.comment_text, c.created_at,
               c.user_id as commenter_user_id,
               u.first_name as commenter_first_name,
               u.last_name as commenter_last_name,
               u.role as commenter_role
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.activity_id = $1
        ORDER BY c.created_at ASC; -- Show oldest first for conversation flow
    `;
  const { rows: comments } = await db.query(commentsQuery, [activityIdInt]);
  console.log(
    `[Ctrl-getComments] Found ${comments.length} comments for Activity ${activityIdInt}`
  );

  res.status(200).json(comments);
});

/**
 * @desc    Create a new comment on an activity
 * @route   POST /api/activities/:activityId/comments
 * @access  Private (Runner who owns activity, Coach linked to runner)
 */
exports.addCommentToActivity = asyncHandler(async (req, res, next) => {
  const commenterUserId = req.user.userId;
  const commenterUserRole = req.user.role;
  const { activityId } = req.params;
  const { commentText } = req.body;

  const activityIdInt = parseInt(activityId, 10);
  if (isNaN(activityIdInt)) {
    return res.status(400).json({ message: "Invalid Activity ID." });
  }
  if (!commentText || commentText.trim() === "") {
    return res.status(400).json({ message: "Comment text cannot be empty." });
  }

  console.log(
    `[Ctrl-addComment] User ${commenterUserId} adding comment to Activity ${activityIdInt}`
  );

  // 1. Get the owner of the activity
  const activityOwnerQuery =
    "SELECT user_id FROM activities WHERE activity_id = $1";
  const ownerResult = await db.query(activityOwnerQuery, [activityIdInt]);

  if (ownerResult.rowCount === 0) {
    return res.status(404).json({ message: "Activity not found." });
  }
  const activityOwnerId = ownerResult.rows[0].user_id;

  // 2. Authorization Check (Same logic as get comments)
  let isAuthorized = false;
  if (commenterUserId === activityOwnerId) {
    isAuthorized = true;
  } else if (commenterUserRole === "coach") {
    const linkCheckQuery = `SELECT 1 FROM coach_athlete_links WHERE coach_user_id = $1 AND athlete_user_id = $2 AND status = 'accepted';`;
    const linkCheck = await db.query(linkCheckQuery, [
      commenterUserId,
      activityOwnerId,
    ]);
    if (linkCheck.rowCount > 0) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    console.warn(
      `[Ctrl-addComment] Auth Failure: User ${commenterUserId} cannot comment on Activity ${activityIdInt} owned by ${activityOwnerId}`
    );
    return res
      .status(403)
      .json({ message: "Not authorized to comment on this activity." });
  }

  // 3. Insert the comment
  const insertCommentQuery = `
        INSERT INTO comments (user_id, activity_id, comment_text)
        VALUES ($1, $2, $3)
        RETURNING comment_id, user_id, activity_id, comment_text, created_at;
    `;
  const { rows } = await db.query(insertCommentQuery, [
    commenterUserId,
    activityIdInt,
    commentText.trim(),
  ]);
  console.log(
    `[Ctrl-addComment] Comment created (ID: ${rows[0].comment_id}) for Activity ${activityIdInt}`
  );

  // 4. Return the newly created comment (maybe join with user details?)
  const newCommentQuery = `
        SELECT c.comment_id, c.comment_text, c.created_at,
               c.user_id as commenter_user_id,
               u.first_name as commenter_first_name,
               u.last_name as commenter_last_name,
               u.role as commenter_role
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.comment_id = $1;
    `;
  const newCommentResult = await db.query(newCommentQuery, [
    rows[0].comment_id,
  ]);

  res.status(201).json(newCommentResult.rows[0]); // Return the full comment object
});

// Optional: Add function for deleting comments later
// exports.deleteComment = asyncHandler(async (req, res, next) => { ... });

// module.exports = { getActivityComments, addCommentToActivity }; // Use module.exports if needed
