// src/components/TrendsChart.js
import React from "react";
// Import Line chart type and necessary components from Chart.js
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, // Import the Chart object
  CategoryScale, // For X axis (labels like dates)
  LinearScale, // For Y axis (numerical values like distance)
  PointElement, // For drawing points on the line
  LineElement, // For drawing the line itself
  Title, // For the chart title
  Tooltip, // For showing info on hover
  Legend, // For the dataset label (e.g., "Distance (km)")
} from "chart.js";

// VERY IMPORTANT: Register the components Chart.js needs to draw this type of chart
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// The React component for the chart
const TrendsChart = ({
  activities = [], // Default to empty array if no activities prop is passed
  dataKey = "distance_km", // The key in the activity object to plot on Y axis (default: distance)
  label = "Trend", // Default label for the dataset
}) => {
  // Ensure activities is an array before processing
  if (!Array.isArray(activities) || activities.length === 0) {
    // Optionally return null or a placeholder if there's no data
    return (
      <p style={{ textAlign: "center", color: "#888" }}>
        Not enough data for chart.
      </p>
    );
    // return null;
  }

  // Prepare data for the chart
  // Chart.js expects labels (X axis) and data points (Y axis)
  // We often want to show time progression, so we reverse the activities
  // (since our API returns newest first) to show oldest -> newest on the chart.
  const reversedActivities = activities.slice().reverse();

  // Extract Y axis values using the dataKey prop
  // Ensure values are numbers, default to 0 if data is missing/invalid for a point
  const chartDataPoints = reversedActivities.map((act) => {
    const value = act[dataKey];
    // Attempt to parse as float, default to 0 if null, undefined, or not a number
    const numberValue = parseFloat(value);
    return !isNaN(numberValue) ? numberValue : 0;
  });

  // Extract X axis labels (e.g., short date representation)
  const chartLabels = reversedActivities.map((act) => {
    try {
      // Format date like "Jan 8"
      return new Date(act.start_date_local).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "N/A"; // Handle invalid dates
    }
  });

  // Chart.js data structure
  const data = {
    labels: chartLabels, // Labels for the X axis
    datasets: [
      {
        label: label, // Label for this line/dataset (passed as prop)
        data: chartDataPoints, // Data points for the Y axis
        fill: false, // Don't fill area under the line
        borderColor: "rgb(52, 152, 219)", // Line color (example: blue)
        backgroundColor: "rgba(52, 152, 219, 0.5)", // Point color (optional)
        tension: 0.1, // Makes the line slightly curved
        pointRadius: 3, // Size of points on the line
        pointHoverRadius: 5, // Size on hover
      },
      // You could add more datasets here later (e.g., a line for average heart rate)
      // {
      //   label: 'Avg Heart Rate',
      //   data: reversedActivities.map(act => act.average_heartrate || 0),
      //   borderColor: 'rgb(231, 76, 60)', // Example red color
      //   tension: 0.1,
      //   yAxisID: 'y1', // Assign to a secondary Y axis if needed
      // }
    ],
  };

  // Chart.js options structure for configuration
  const options = {
    responsive: true, // Chart takes width of container
    maintainAspectRatio: false, // Allows chart to resize height based on container
    plugins: {
      legend: {
        position: "top", // Show legend above the chart
      },
      title: {
        display: true, // Show title
        text: `${label} Trend (Last ${activities.length} Activities)`, // Dynamic title
        padding: {
          bottom: 15, // Add some space below title
        },
      },
      tooltip: {
        callbacks: {
          // Customize what the tooltip shows on hover
          label: function (context) {
            let tooltipLabel = context.dataset.label || "";
            if (tooltipLabel) {
              tooltipLabel += ": ";
            }
            if (context.parsed.y !== null) {
              // Add units automatically based on common labels (can be improved)
              let unit = "";
              if (label.toLowerCase().includes("distance")) unit = " km";
              else if (label.toLowerCase().includes("pace"))
                unit = " /km"; // Future use maybe
              else if (label.toLowerCase().includes("time"))
                unit = " s"; // If plotting time
              else if (
                label.toLowerCase().includes("hr") ||
                label.toLowerCase().includes("heart")
              )
                unit = " bpm";
              // Add more units as needed

              tooltipLabel += context.parsed.y + unit;
            }
            return tooltipLabel;
          },
        },
      },
    },
    scales: {
      // Configure axes
      x: {
        title: {
          display: false, // No need for explicit "Date" title usually
          text: "Date",
        },
      },
      y: {
        // Primary Y axis configuration
        title: {
          display: true, // Show Y axis title
          text: label, // Use the main label prop as Y axis title
        },
        beginAtZero: true, // Start Y axis at 0, good for distance/time
        // You might set this to false for things like pace where 0 isn't meaningful
      },
      // Example of a secondary Y axis (if you add another dataset like HR)
      // y1: {
      //     type: 'linear',
      //     display: true,
      //     position: 'right', // Position on the right
      //     title: {
      //         display: true,
      //         text: 'Avg Heart Rate (bpm)'
      //     },
      //     grid: { // Prevent grid lines from overlapping
      //         drawOnChartArea: false,
      //     },
      // },
    },
  };

  // Render the Line chart component with options and data
  return <Line options={options} data={data} />;
};

export default TrendsChart; // Export the component for use in Dashboard.js
