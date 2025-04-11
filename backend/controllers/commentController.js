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

/**
 * @desc    Get comments for a specific diary entry
 * @route   GET /api/diary/:entryId/comments
 * @access  Private (Runner who owns entry, Coach linked to runner)
 */
exports.getDiaryEntryComments = asyncHandler(async (req, res, next) => {
  const requestingUserId = req.user.userId;
  const requestingUserRole = req.user.role;
  const { entryId } = req.params; // Get diary entry ID from route

  const entryIdInt = parseInt(entryId, 10);
  if (isNaN(entryIdInt)) {
    return res.status(400).json({ message: "Invalid Diary Entry ID." });
  }

  console.log(
    `[Ctrl-getDiaryComments] User ${requestingUserId} requesting comments for Diary Entry ${entryIdInt}`
  );

  // 1. Get the owner of the diary entry
  const entryOwnerQuery =
    "SELECT user_id FROM diary_entries WHERE entry_id = $1";
  const ownerResult = await db.query(entryOwnerQuery, [entryIdInt]);

  if (ownerResult.rowCount === 0) {
    return res.status(404).json({ message: "Diary entry not found." });
  }
  const entryOwnerId = ownerResult.rows[0].user_id;

  // 2. Authorization Check (Owner or Linked Coach)
  let isAuthorized = false;
  if (requestingUserId === entryOwnerId) {
    isAuthorized = true;
  } else if (requestingUserRole === "coach") {
    const linkCheckQuery = `SELECT 1 FROM coach_athlete_links WHERE coach_user_id = $1 AND athlete_user_id = $2 AND status = 'accepted';`;
    const linkCheck = await db.query(linkCheckQuery, [
      requestingUserId,
      entryOwnerId,
    ]);
    if (linkCheck.rowCount > 0) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    console.warn(
      `[Ctrl-getDiaryComments] Auth Failure: User ${requestingUserId} cannot view comments for Diary Entry ${entryIdInt} owned by ${entryOwnerId}`
    );
    return res
      .status(403)
      .json({ message: "Not authorized to view these comments." });
  }

  // 3. Fetch Comments linked to this diary_entry_id
  const commentsQuery = `
      SELECT c.comment_id, c.comment_text, c.created_at,
             c.user_id as commenter_user_id,
             u.first_name as commenter_first_name,
             u.last_name as commenter_last_name,
             u.role as commenter_role
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.diary_entry_id = $1 -- Filter by diary_entry_id
      ORDER BY c.created_at ASC;
  `;
  const { rows: comments } = await db.query(commentsQuery, [entryIdInt]);
  console.log(
    `[Ctrl-getDiaryComments] Found ${comments.length} comments for Diary Entry ${entryIdInt}`
  );

  res.status(200).json(comments);
});

/**
 * @desc    Create a new comment on a diary entry
 * @route   POST /api/diary/:entryId/comments
 * @access  Private (Runner who owns entry, Coach linked to runner)
 */
exports.addCommentToDiaryEntry = asyncHandler(async (req, res, next) => {
  const commenterUserId = req.user.userId;
  const commenterUserRole = req.user.role;
  const { entryId } = req.params;
  const { commentText } = req.body;

  const entryIdInt = parseInt(entryId, 10);
  if (isNaN(entryIdInt)) {
    return res.status(400).json({ message: "Invalid Diary Entry ID." });
  }
  if (!commentText || commentText.trim() === "") {
    return res.status(400).json({ message: "Comment text cannot be empty." });
  }

  console.log(
    `[Ctrl-addDiaryComment] User ${commenterUserId} adding comment to Diary Entry ${entryIdInt}`
  );

  // 1. Get the owner of the diary entry
  const entryOwnerQuery =
    "SELECT user_id FROM diary_entries WHERE entry_id = $1";
  const ownerResult = await db.query(entryOwnerQuery, [entryIdInt]);

  if (ownerResult.rowCount === 0) {
    return res.status(404).json({ message: "Diary entry not found." });
  }
  const entryOwnerId = ownerResult.rows[0].user_id;

  // 2. Authorization Check (Owner or Linked Coach)
  let isAuthorized = false;
  if (commenterUserId === entryOwnerId) {
    isAuthorized = true;
  } else if (commenterUserRole === "coach") {
    const linkCheckQuery = `SELECT 1 FROM coach_athlete_links WHERE coach_user_id = $1 AND athlete_user_id = $2 AND status = 'accepted';`;
    const linkCheck = await db.query(linkCheckQuery, [
      commenterUserId,
      entryOwnerId,
    ]);
    if (linkCheck.rowCount > 0) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    console.warn(
      `[Ctrl-addDiaryComment] Auth Failure: User ${commenterUserId} cannot comment on Diary Entry ${entryIdInt} owned by ${entryOwnerId}`
    );
    return res
      .status(403)
      .json({ message: "Not authorized to comment on this diary entry." });
  }

  // 3. Insert the comment, linking diary_entry_id
  const insertCommentQuery = `
      INSERT INTO comments (user_id, diary_entry_id, comment_text) -- Link diary_entry_id
      VALUES ($1, $2, $3)
      RETURNING comment_id; -- Return only ID initially
  `;
  const { rows } = await db.query(insertCommentQuery, [
    commenterUserId,
    entryIdInt,
    commentText.trim(),
  ]);
  const newCommentId = rows[0].comment_id;
  console.log(
    `[Ctrl-addDiaryComment] Comment created (ID: ${newCommentId}) for Diary Entry ${entryIdInt}`
  );

  // 4. Fetch the newly created comment with user details to return it
  const newCommentQuery = `
      SELECT c.comment_id, c.comment_text, c.created_at, c.diary_entry_id,
             c.user_id as commenter_user_id,
             u.first_name as commenter_first_name,
             u.last_name as commenter_last_name,
             u.role as commenter_role
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.comment_id = $1;
  `;
  const newCommentResult = await db.query(newCommentQuery, [newCommentId]);

  res.status(201).json(newCommentResult.rows[0]);
});
