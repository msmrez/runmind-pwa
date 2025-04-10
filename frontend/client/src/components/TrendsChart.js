// src/components/TrendsChart.js
import React, { useMemo } from "react"; // Import useMemo
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

const TrendsChart = ({
  activities = [],
  dataKey = "distance_km",
  label = "Total Daily", // Updated default label
}) => {
  // --- <<< START: Aggregate data per day using useMemo WITH DEBUG LOGS >>> ---
  const aggregatedChartData = useMemo(() => {
    if (!Array.isArray(activities) || activities.length === 0) {
      return { labels: [], dataPoints: [] };
    }
    // <<< LOG 1: Log the received props >>>
    console.log(
      `[TrendsChart Debug] Aggregating ${activities.length} activities. dataKey prop: "${dataKey}"`
    );
    // <<< LOG 2: Log the first activity object to see its structure >>>
    if (activities.length > 0) {
      console.log(
        "[TrendsChart Debug] First activity structure:",
        JSON.stringify(activities[0])
      );
    }

    const dailyTotals = new Map();

    activities.forEach((act, index) => {
      // Add index for logging
      try {
        const dateStr = new Date(act.start_date_local)
          .toISOString()
          .split("T")[0];
        const value = act[dataKey];
        const numericValue = parseFloat(value);
        if (isNaN(numericValue)) {
          console.warn(
            `[TrendsChart Debug] Could not parse value "${value}" for dataKey "${dataKey}". Treating as 0.`
          );
          numericValue = 0; // Treat non-parsable values as 0
        }

        // <<< LOG 3: Log processing for each activity (or sample) >>>
        if (index < 5 || index === activities.length - 1) {
          // Log first 5 and last
          console.log(
            `[TrendsChart Debug] Processing act[${index}]: date=${dateStr}, dataKey="${dataKey}", rawValue=${JSON.stringify(
              value
            )}, numericValue=${numericValue}`
          );
        }

        if (dailyTotals.has(dateStr)) {
          dailyTotals.set(dateStr, dailyTotals.get(dateStr) + numericValue);
        } else {
          dailyTotals.set(dateStr, numericValue);
        }
      } catch (e) {
        console.error(
          `[TrendsChart Debug] Error processing activity index ${index}:`,
          act,
          e
        );
      }
    });

    // Convert Map to sorted array
    const sortedDailyData = Array.from(dailyTotals.entries())
      .map(([date, totalValue]) => ({
        date: date,
        value: parseFloat(totalValue.toFixed(2)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Extract labels and data points
    const chartLabels = sortedDailyData.map((item) => {
      try {
        const dateObj = new Date(`${item.date}T00:00:00`);
        return dateObj.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
      } catch {
        return item.date;
      }
    });
    const chartDataPoints = sortedDailyData.map((item) => item.value);

    // <<< LOG 4: Log the final aggregated result >>>
    console.log("[TrendsChart Debug] Final Labels:", chartLabels);
    console.log("[TrendsChart Debug] Final Data Points:", chartDataPoints);

    return { labels: chartLabels, dataPoints: chartDataPoints };
  }, [activities, dataKey]);
  // --- <<< END: Aggregate data per day using useMemo WITH DEBUG LOGS >>> ---
  // Check if enough *aggregated* data points exist
  if (aggregatedChartData.labels.length < 2) {
    return (
      <p style={{ textAlign: "center", color: "#888" }}>
        Not enough daily data points for chart.
      </p>
    );
  }

  // Chart.js data structure using aggregated data
  const data = {
    labels: aggregatedChartData.labels, // Use aggregated labels
    datasets: [
      {
        label: `${label} (${dataKey})`, // Make label more descriptive
        data: aggregatedChartData.dataPoints, // Use aggregated data points
        fill: false,
        borderColor: "rgb(52, 152, 219)",
        backgroundColor: "rgba(52, 152, 219, 0.5)",
        tension: 0.1,
        pointRadius: 4, // Slightly larger points might look better with fewer points
        pointHoverRadius: 6,
      },
    ],
  };

  // Chart.js options structure (mostly unchanged, but update titles)
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        // Title reflects daily aggregation and number of days plotted
        text: `${label} Trend (${aggregatedChartData.labels.length} Days)`,
        padding: { bottom: 15 },
      },
      tooltip: {
        callbacks: {
          // Tooltip callback can remain similar, maybe update label context
          label: function (context) {
            let tooltipLabel = context.dataset.label || "";
            if (tooltipLabel) {
              tooltipLabel += ": ";
            }
            if (context.parsed.y !== null) {
              // Simple unit detection - can be refined
              let unit = "";
              if (dataKey.toLowerCase().includes("distance")) unit = " km";
              else if (dataKey.toLowerCase().includes("time"))
                unit = " s"; // Assuming seconds if plotting time
              else if (
                dataKey.toLowerCase().includes("hr") ||
                dataKey.toLowerCase().includes("heart")
              )
                unit = " bpm";
              tooltipLabel += context.parsed.y + unit;
            }
            return tooltipLabel;
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: false },
      },
      y: {
        title: {
          display: true,
          text: `${label} (${dataKey})`, // Y-axis title
        },
        beginAtZero: true,
      },
    },
  };

  return <Line options={options} data={data} />;
};

export default TrendsChart;
