// backend/services/analyticsService.js
const db = require("../db"); // Adjust path if needed

/**
 * Calculates average pace in minutes per kilometer.
 */
function calculatePaceMinPerKm(distanceMeters, movingTimeSeconds) {
  // Make checks slightly safer
  const dist = Number(distanceMeters);
  const time = Number(movingTimeSeconds);
  if (isNaN(dist) || dist <= 0 || isNaN(time) || time <= 0) return null;
  try {
    const distanceKm = dist / 1000;
    if (distanceKm === 0) return null;
    const paceSecondsPerKm = time / distanceKm;
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.round(paceSecondsPerKm % 60);
    const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
    return `${minutes}:${formattedSeconds} /km`;
  } catch (e) {
    console.error("[calculatePaceMinPerKm] Error:", e, {
      distanceMeters,
      movingTimeSeconds,
    });
    return null;
  }
}

/**
 * Generates insights based on recent user data.
 * @param {number} userId
 * @returns {Promise<string[]>} Array of insight strings.
 */
async function generateInsights(userId) {
  const numberOfRunsToAnalyze = 10;
  console.log(
    `[Analytics Service] Generating insights for User: ${userId}, analyzing last ${numberOfRunsToAnalyze} runs.`
  );
  let client;
  try {
    client = await db.pool.connect();
    console.log("[Analytics Service] DB Client acquired.");

    // 1. Fetch Data (Runs, Diary, Diet)
    const recentRunsQuery = `SELECT activity_id, distance, moving_time, average_heartrate, start_date_local, mental_mood FROM activities WHERE user_id = $1 AND type = 'Run' ORDER BY start_date_local DESC LIMIT $2;`;
    const { rows: recentRuns } = await client.query(recentRunsQuery, [
      userId,
      numberOfRunsToAnalyze,
    ]);
    console.log(
      `[Analytics Service] Fetched ${recentRuns.length} recent runs.`
    );
    if (recentRuns.length < 2) {
      //client.release();
      return ["Log more runs (at least 2) for trends!"];
    }

    const oldestRunDate = recentRuns[recentRuns.length - 1].start_date_local
      .toISOString()
      .split("T")[0];
    const latestRunDate = recentRuns[0].start_date_local
      .toISOString()
      .split("T")[0];
    console.log(
      `[Analytics Service] Date range: ${oldestRunDate} to ${latestRunDate}`
    );

    const diaryQuery = `SELECT entry_date, notes FROM diary_entries WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3;`;
    const { rows: diaryEntries } = await client.query(diaryQuery, [
      userId,
      oldestRunDate,
      latestRunDate,
    ]);
    const diaryMap = new Map(
      diaryEntries.map((e) => [
        e.entry_date.toISOString().split("T")[0],
        e.notes,
      ])
    );
    console.log(`[Analytics Service] Found ${diaryMap.size} diary entries.`);

    const dietQuery = `SELECT log_date, SUM(estimated_calories) as total_calories FROM diet_logs WHERE user_id = $1 AND log_date BETWEEN $2 AND $3 GROUP BY log_date;`;
    const { rows: dietLogs } = await client.query(dietQuery, [
      userId,
      oldestRunDate,
      latestRunDate,
    ]);
    const dietMap = new Map(
      dietLogs.map((log) => [
        log.log_date.toISOString().split("T")[0],
        parseInt(log.total_calories || 0, 10),
      ])
    );
    console.log(`[Analytics Service] Found ${dietMap.size} diet log days.`);

    // 2. Analysis Logic
    const insights = [];
    const lastRun = recentRuns[0];
    const previousRuns = recentRuns.slice(1);
    console.log(
      `[Analytics Service] Analyzing ${previousRuns.length} previous runs.`
    );

    // --- Calculate Averages (with added safety and logging) ---
    const initialAcc = {
      distance: 0,
      moving_time: 0,
      heartrate: 0,
      count: 0,
      totalPaceSeconds: 0,
      paceCount: 0,
    };
    console.log(
      "[Analytics Service] Starting reduce for previous runs averages..."
    );
    const avgPrevious = previousRuns.reduce((acc, run, index) => {
      console.log(
        `%c[Analytics Reduce #${index}] Processing run from ${run?.start_date_local?.toISOString()}`,
        "color: gray"
      );
      // Safely add values, defaulting to 0 if null/undefined/NaN
      const runDistance = Number(run?.distance) || 0;
      const runMovingTime = Number(run?.moving_time) || 0;
      const runAvgHr = Number(run?.average_heartrate) || 0;

      acc.distance += runDistance;
      acc.moving_time += runMovingTime;
      acc.heartrate += runAvgHr;
      acc.count++; // Increment count for every run processed

      const pace = calculatePaceMinPerKm(runDistance, runMovingTime);
      if (pace) {
        try {
          const parts = pace.split(/[:\s/]/);
          const paceSeconds =
            parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          if (!isNaN(paceSeconds)) {
            acc.totalPaceSeconds += paceSeconds;
            acc.paceCount++; // Increment only if pace calculation is valid
          } else {
            console.warn(
              `[Analytics Reduce #${index}] Pace calc ok ("${pace}"), but seconds NaN.`
            );
          }
        } catch (paceError) {
          console.warn(
            `[Analytics Reduce #${index}] Error parsing pace "${pace}":`,
            paceError.message
          );
        }
      } else {
        console.log(
          `[Analytics Reduce #${index}] Could not calculate pace (Dist: ${runDistance}, Time: ${runMovingTime}).`
        );
      }

      console.log(
        `%c[Analytics Reduce #${index}] Accumulator: count=${
          acc.count
        }, paceCount=${acc.paceCount}, dist=${acc.distance.toFixed(
          0
        )}, hr=${acc.heartrate.toFixed(
          1
        )}, paceSec=${acc.totalPaceSeconds.toFixed(1)}`,
        "color: gray"
      );
      return acc;
    }, initialAcc); // <<< Pass initial value

    // --- Check avgPrevious AFTER reduce ---
    if (!avgPrevious) {
      // Should not happen with initial value, but safety first
      console.error(
        "[Analytics Service] CRITICAL: avgPrevious is undefined after reduce!"
      );
      throw new Error("Failed to calculate averages."); // Throw error to be caught by controller
    }
    console.log(
      "[Analytics Service] Final Averages Object:",
      JSON.stringify(avgPrevious)
    );

    // --- Calculate final averages (SAFELY accessing avgPrevious properties) ---
    // Line 98 where the error happened was likely one of these divisions
    const avgDistance =
      avgPrevious.count > 0 ? avgPrevious.distance / avgPrevious.count : 0;
    const avgHeartrate =
      avgPrevious.count > 0 ? avgPrevious.heartrate / avgPrevious.count : 0;
    const avgPaceSeconds =
      avgPrevious.paceCount > 0
        ? avgPrevious.totalPaceSeconds / avgPrevious.paceCount
        : 0; // Use paceCount here
    let avgPaceFormatted = null;
    if (avgPaceSeconds > 0) {
      const m = Math.floor(avgPaceSeconds / 60),
        s = Math.round(avgPaceSeconds % 60);
      avgPaceFormatted = `${m}:${s < 10 ? "0" + s : s} /km`;
    }
    console.log(
      `[Analytics Service] Calculated Avg: Dist=${avgDistance.toFixed(
        0
      )}m, HR=${avgHeartrate.toFixed(1)}, PaceSec=${avgPaceSeconds.toFixed(
        1
      )}s/km (${avgPaceFormatted})`
    );

    // ... Calculate last run details ...
    const lastRunPace = calculatePaceMinPerKm(
      lastRun.distance,
      lastRun.moving_time
    );
    let lastRunPaceSeconds = null;
    if (lastRunPace) {
      try {
        lastRunPaceSeconds =
          parseInt(lastRunPace.split(/[:\s/]/)[0]) * 60 +
          parseInt(lastRunPace.split(/[:\s/]/)[1]);
        if (isNaN(lastRunPaceSeconds)) lastRunPaceSeconds = null;
      } catch {
        lastRunPaceSeconds = null;
      }
    }
    let lastRunDateStr = "N/A";
    try {
      lastRunDateStr = lastRun.start_date_local.toISOString().split("T")[0];
    } catch {}
    console.log(
      `[Analytics Service] Last Run (${lastRunDateStr}): Dist=${lastRun.distance}m, Pace=${lastRunPace} (${lastRunPaceSeconds}s/km), Mood=${lastRun.mental_mood}`
    );

    // --- Generate Insight Strings (with logging) ---
    console.log("[Analytics Service] Generating specific insights...");
    // a) Pace Trend Check
    if (
      lastRunPace &&
      avgPaceFormatted &&
      lastRunPaceSeconds &&
      avgPaceSeconds > 0
    ) {
      const paceDiff = lastRunPaceSeconds - avgPaceSeconds,
        threshold = 10;
      console.log(`[Analytics Check Pace] Diff: ${paceDiff.toFixed(1)}s`);
      if (paceDiff < -threshold)
        insights.push(
          `🚀 Pace: Faster (${lastRunPace}) than avg (${avgPaceFormatted}).`
        );
      else if (paceDiff > threshold)
        insights.push(
          `📉 Pace: Slower (${lastRunPace}) than avg (${avgPaceFormatted}).`
        );
    } else {
      console.log("[Analytics Check Pace] Skip: Insufficient data.");
    }

    // b) Distance Trend Check
    if (lastRun.distance && avgDistance > 0) {
      const distDiffPercent =
          ((lastRun.distance - avgDistance) / avgDistance) * 100,
        threshold = 25;
      console.log(
        `[Analytics Check Dist] Diff: ${distDiffPercent.toFixed(1)}%`
      );
      if (distDiffPercent > threshold)
        insights.push(
          `🏃 Distance: Longer (${(lastRun.distance / 1000).toFixed(
            1
          )}km) than avg (${(avgDistance / 1000).toFixed(1)}km).`
        );
      else if (distDiffPercent < -threshold)
        insights.push(
          ` Short (${(lastRun.distance / 1000).toFixed(1)}km) vs avg (${(
            avgDistance / 1000
          ).toFixed(1)}km).`
        );
    } else {
      console.log("[Analytics Check Dist] Skip: Insufficient data.");
    }

    // c) Recovery Suggestion Check
    const isLongRun = avgDistance > 0 && lastRun.distance > avgDistance * 1.3;
    const isHighHR =
      lastRun.average_heartrate &&
      avgHeartrate > 0 &&
      lastRun.average_heartrate > avgHeartrate * 1.05;
    console.log(
      `[Analytics Check Recovery] IsLong=${isLongRun}, IsHighHR=${isHighHR}`
    );
    if (isLongRun && isHighHR)
      insights.push(
        `🥵 Recovery: High effort & long run. Prioritize recovery.`
      );
    else if (isLongRun) insights.push(`👍 Recovery: Long run. Recover well.`);
    else if (isHighHR)
      insights.push(`💓 Recovery: HR higher than usual. Listen to body.`);
    else {
      console.log("[Analytics Check Recovery] Skip: Conditions not met.");
    }

    // e) Diet Correlation Check
    const caloriesOnRunDay = dietMap.get(lastRunDateStr);
    const typicalAvgCalories = 2500;
    console.log(
      `[Analytics Check Diet] CalsToday=${caloriesOnRunDay}, LastPaceSec=${lastRunPaceSeconds}, AvgPaceSec=${avgPaceSeconds}`
    );
    if (
      caloriesOnRunDay !== undefined &&
      lastRunPaceSeconds &&
      avgPaceSeconds > 0
    ) {
      const highCal = typicalAvgCalories * 1.1,
        lowCal = typicalAvgCalories * 0.8,
        fastPace = avgPaceSeconds * 0.98,
        slowPace = avgPaceSeconds * 1.02;
      if (caloriesOnRunDay > highCal && lastRunPaceSeconds < fastPace)
        insights.push(
          `⚡️ Fuel Factor: Higher cals (~${caloriesOnRunDay} kcal) & faster pace!`
        );
      else if (caloriesOnRunDay < lowCal && lastRunPaceSeconds > slowPace)
        insights.push(
          `⛽ Fuel Factor: Lower cals (~${caloriesOnRunDay} kcal) & slower pace.`
        );
      else {
        console.log(
          "[Analytics Check Diet] No strong cal/pace correlation found."
        );
      }
    } else if (caloriesOnRunDay !== undefined) {
      insights.push(
        `🍽️ Diet Logged: ~${caloriesOnRunDay} kcal logged on run day.`
      );
    } else {
      console.log("[Analytics Check Diet] Skip: No calorie data for date.");
    }

    // f) Diary Correlation Check
    const diaryNotesOnRunDay = diaryMap.get(lastRunDateStr);
    console.log(
      `[Analytics Check Diary] Notes found: ${!!diaryNotesOnRunDay}, LastRunMood: ${
        lastRun.mental_mood
      }`
    );
    if (diaryNotesOnRunDay) {
      const lowerNotes = diaryNotesOnRunDay.toLowerCase();
      const posRegex = /\b(great|good|strong|energized|awesome|easy)\b/,
        negRegex = /\b(tired|sore|struggled|tough|heavy|bad)\b/;
      let added = false;
      if (
        posRegex.test(lowerNotes) &&
        lastRun.mental_mood &&
        lastRun.mental_mood >= 4
      ) {
        insights.push(`😊 Mind Notes: Diary & mood suggest feeling positive!`);
        added = true;
      } else if (
        negRegex.test(lowerNotes) &&
        lastRun.mental_mood &&
        lastRun.mental_mood <= 2
      ) {
        insights.push(
          `😟 Mind Notes: Diary & mood suggest finding it challenging.`
        );
        added = true;
      }
      if (!added && lowerNotes.length > 10) {
        insights.push(`📝 Diary Notes logged on run day.`);
      } else if (!added) {
        console.log(
          "[Analytics Check Diary] No specific keyword/mood correlation found."
        );
      }
    } else {
      console.log("[Analytics Check Diary] Skip: No diary notes for date.");
    }

    // --- Default message ---
    if (insights.length === 0) {
      console.log(
        "[Analytics Result] No specific insights generated, adding default."
      );
      insights.push(
        "Keep logging runs, diet, diary & mood to unlock more detailed insights!"
      );
    }

    console.log(
      `[Analytics Service] Generated ${insights.length} insights for User: ${userId}`
    );
    return insights; // Return the array
  } catch (error) {
    console.error(
      `[Analytics Service] Error generating insights for User ${userId}:`,
      error
    );
    // Throw the error so the controller's catch block handles it
    throw error; // Let controller handle response formatting
    // Or return error message: return ["Could not generate insights due to an internal error."];
  } finally {
    if (client) {
      console.log("[Analytics Service] Releasing DB client.");
      client.release();
    }
  }
}
// --- End generateInsights ---

module.exports = {
  calculatePaceMinPerKm, // Export if needed elsewhere, though currently only used here
  generateInsights,
};
