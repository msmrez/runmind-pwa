// src/components/TrendsChart.js
import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Helper function for averaging values in an array, skipping nulls/NaNs
const calculateAverage = (arr) => {
  const validNumbers = arr.filter((n) => typeof n === "number" && !isNaN(n));
  if (validNumbers.length === 0) return 0; // Or null/undefined if preferred
  const sum = validNumbers.reduce((acc, val) => acc + val, 0);
  return sum / validNumbers.length;
};

const TrendsChart = ({
  activities = [],
  // Accept two sets of keys and labels
  dataKey1 = "distance_km",
  label1 = "Total Daily Distance (km)",
  dataKey2 = "average_heartrate", // Second metric
  label2 = "Avg Daily Heart Rate (bpm)", // Label for second metric
}) => {
  // --- Aggregate data per day for BOTH metrics using useMemo ---
  const aggregatedChartData = useMemo(() => {
    if (!Array.isArray(activities) || activities.length === 0) {
      return { labels: [], dataPoints1: [], dataPoints2: [] };
    }
    console.log(
      `[TrendsChart Multi Debug] Aggregating ${activities.length}. Key1: "${dataKey1}", Key2: "${dataKey2}"`
    );
    // Log first activity again to be sure
    if (activities.length > 0)
      console.log(
        "[TrendsChart Multi Debug] First activity:",
        JSON.stringify(activities[0])
      );

    const dailyAggregates = new Map();

    activities.forEach((act, index) => {
      try {
        const dateStr = new Date(act.start_date_local)
          .toISOString()
          .split("T")[0];

        // --- Debugging dataKey1 (distance_km) ---
        const value1 = act[dataKey1];
        let numericValue1 = parseFloat(value1); // Try parsing directly
        if (isNaN(numericValue1)) {
          // Log detailed failure info ONLY for dataKey1
          console.warn(
            `[TrendsChart Multi Debug] Failed to parse dataKey1 ("${dataKey1}"). Raw value: ${JSON.stringify(
              value1
            )}, Parsed as: NaN. Index: ${index}. Treating as 0.`
          );
          numericValue1 = 0;
        }
        // --- End Debugging dataKey1 ---

        // Get value2 (heart rate)
        const value2 = act[dataKey2];
        const numericValue2 =
          typeof value2 === "number" && !isNaN(value2) ? value2 : null;

        // Initialize aggregate if needed
        let aggregate = dailyAggregates.get(dateStr);
        if (!aggregate) {
          aggregate = { sum1: 0, values2: [], count1: 0 };
          dailyAggregates.set(dateStr, aggregate);
        }

        // Aggregate metric 1 (sum)
        if (numericValue1 !== null && !isNaN(numericValue1)) {
          // Extra safety check for NaN
          aggregate.sum1 += numericValue1;
          aggregate.count1 += 1;
        }

        // Aggregate metric 2 (average)
        if (numericValue2 !== null) {
          aggregate.values2.push(numericValue2);
        }

        // Log intermediate aggregate state for a specific date (e.g., first date found)
        if (index === 0 || (dailyAggregates.size === 1 && index < 5)) {
          console.log(
            `[TrendsChart Multi Debug] After processing index ${index}, Aggregate for ${dateStr}:`,
            JSON.stringify(dailyAggregates.get(dateStr))
          );
        }
      } catch (e) {
        console.error("Error processing activity for chart:", act, e);
      }
    });

    // Convert Map to sorted array and finalize calculations
    const sortedDailyData = Array.from(dailyAggregates.entries())
      .map(([date, aggregate]) => ({
        date: date,
        value1: parseFloat(aggregate.sum1.toFixed(2)), // Sum for distance
        value2: parseFloat(calculateAverage(aggregate.values2).toFixed(1)), // Avg for HR
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Inside useMemo in TrendsChart.js

    // Extract labels and separate data points for Chart.js
    const chartLabels = sortedDailyData.map((item) => {
      // Keep curly braces if logic is complex
      // Format date like "Jan 8" for display on X-axis
      try {
        const dateObj = new Date(`${item.date}T00:00:00`);
        // <<< --- ADD return statement --- >>>
        return dateObj.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
      } catch {
        // <<< --- ADD return statement --- >>>
        return item.date; // Fallback to YYYY-MM-DD
      }
    }); // End chartLabels map

    // dataPoints maps can use implicit return if simple:
    const chartDataPoints1 = sortedDailyData.map((item) => item.value1);
    const chartDataPoints2 = sortedDailyData.map((item) => item.value2);

    console.log("[TrendsChart Multi Debug] Final Labels:", chartLabels); // Check this log
    console.log(
      `[TrendsChart Multi Debug] Final Data Points 1 ("${dataKey1}"):`,
      chartDataPoints1
    );
    console.log(
      `[TrendsChart Multi Debug] Final Data Points 2 ("${dataKey2}"):`,
      chartDataPoints2
    );

    return {
      labels: chartLabels,
      dataPoints1: chartDataPoints1,
      dataPoints2: chartDataPoints2,
    };
  }, [activities, dataKey1, dataKey2]);

  // Check if enough data points exist
  if (aggregatedChartData.labels.length < 2) {
    return (
      <p style={{ textAlign: "center", color: "#888" }}>
        {" "}
        Not enough daily data points for chart.{" "}
      </p>
    );
  }

  // Chart.js data structure with TWO datasets
  const data = {
    labels: aggregatedChartData.labels,
    datasets: [
      // Dataset 1 (e.g., Distance) - uses default 'y' axis
      {
        label: label1, // Use prop
        data: aggregatedChartData.dataPoints1,
        borderColor: "rgb(52, 152, 219)", // Blue
        backgroundColor: "rgba(52, 152, 219, 0.5)",
        yAxisID: "y", // Assign to the default left Y axis
        tension: 0.1,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      // Dataset 2 (e.g., Avg HR) - uses 'y1' axis
      {
        label: label2, // Use prop
        data: aggregatedChartData.dataPoints2,
        borderColor: "rgb(231, 76, 60)", // Red
        backgroundColor: "rgba(231, 76, 60, 0.5)",
        yAxisID: "y1", // Assign to the SECOND Y axis ('y1')
        tension: 0.1,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  // Chart.js options structure WITH dual axes
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      // Improve hover/tooltip interaction
      mode: "index",
      intersect: false,
    },
    stacked: false, // Ensure lines aren't stacked
    plugins: {
      legend: { position: "top" },
      title: {
        display: true,
        // Update title
        text: `Daily Trends (${aggregatedChartData.labels.length} Days)`,
        padding: { bottom: 15 },
      },
      tooltip: {
        // Tooltips will now show both values for the hovered date index
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y;
            }
            // Add basic units (could be improved)
            if (context.datasetIndex === 0 && dataKey1.includes("distance"))
              label += " km";
            if (context.datasetIndex === 1 && dataKey2.includes("heart"))
              label += " bpm";
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: false },
      },
      // Left Y Axis (default, ID 'y')
      y: {
        type: "linear",
        display: true,
        position: "left",
        title: {
          display: true,
          text: label1, // Label from prop
        },
        beginAtZero: true, // Good for distance
        // Optional: Style grid lines for this axis
        // grid: {
        //   drawOnChartArea: true, // Show grid lines for this axis
        //   color: 'rgba(52, 152, 219, 0.1)' // Light blue grid lines
        // },
      },
      // Right Y Axis (ID 'y1')
      y1: {
        type: "linear",
        display: true, // Make sure it's displayed
        position: "right", // Position on the right side
        title: {
          display: true,
          text: label2, // Label from prop
        },
        // Decide if 0 is appropriate for HR or other metrics
        // beginAtZero: false, // Often better for HR not to start at 0
        // Ensure grid lines from this axis don't clutter the chart area
        grid: {
          drawOnChartArea: false, // Only draw ticks/labels for y1 axis
        },
      },
    },
  };

  return <Line options={options} data={data} />;
};

export default TrendsChart;
