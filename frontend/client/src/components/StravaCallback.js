// src/components/StravaCallback.js
import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";

const StravaCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const [status, setStatus] = useState("Processing Strava callback...");
  const [athleteData, setAthleteData] = useState(null); // Can still store full data for display
  const processingRef = useRef(false);

  useEffect(() => {
    if (error) {
      console.error("[StravaCallback] Strava authorization error:", error);
      setStatus(
        `Error during Strava authorization: ${error}. Please try again.`
      );
      processingRef.current = false;
      return;
    }

    if (code && !processingRef.current) {
      processingRef.current = true;
      console.log("[StravaCallback] Authorization Code from Strava:", code);
      setStatus("Exchanging code for tokens...");

      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";

      axios
        .post(`${backendUrl}/strava/token`, { code })
        .then((response) => {
          console.log("[StravaCallback] Backend response:", response.data);

          // --- Crucial Check ---
          if (
            response.data &&
            response.data.athlete &&
            response.data.athlete.appUserId
          ) {
            setStatus("Strava authentication successful!");
            setAthleteData(response.data.athlete); // Store the received athlete data

            // --- Store in localStorage ---
            // Ensure the object you store contains appUserId
            console.log(
              "[StravaCallback] Storing athlete data to localStorage:",
              response.data.athlete
            );
            localStorage.setItem(
              "stravaAthlete",
              JSON.stringify(response.data.athlete) // Store the whole athlete object from backend
            );
            // --- End Store ---

            // Redirect to dashboard after successful authentication and storage
            console.log("[StravaCallback] Navigating to dashboard...");
            navigate("/dashboard"); // Redirect immediately on success
          } else {
            // Handle case where backend response is missing expected data
            console.error(
              "[StravaCallback] Backend response missing athlete data or appUserId:",
              response.data
            );
            setStatus(
              "Authentication succeeded but failed to retrieve necessary user details from backend."
            );
            processingRef.current = false; // Allow retry potentially?
            localStorage.removeItem("stravaAthlete"); // Clear any partial data
          }
        })
        .catch((err) => {
          console.error(
            "[StravaCallback] Error sending code to backend:",
            err.response ? err.response.data : err.message
          );
          setStatus(
            `Error authenticating: ${
              err.response?.data?.message || err.message
            }`
          );
          processingRef.current = false;
          localStorage.removeItem("stravaAthlete");
        });
    } else if (!code && !error) {
      setStatus("Waiting for Strava authorization code...");
    }
  }, [code, error, navigate]);

  return (
    <div>
      <h1>Strava Authentication</h1>
      <p>{status}</p>
      {/* Display details if needed, but primary goal is storage and redirect */}
      {athleteData && (
        <div>
          <h2>Welcome, {athleteData.firstname}!</h2>
          <p>Redirecting to dashboard...</p>
          {/* You might not even see this if the redirect is fast enough */}
        </div>
      )}
    </div>
  );
};

export default StravaCallback;
