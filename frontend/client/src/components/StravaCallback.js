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
  const [athleteData, setAthleteData] = useState(null);
  const processingRef = useRef(false);

  useEffect(() => {
    console.log("[StravaCallback] useEffect running.");
    if (error) {
      console.error("[StravaCallback] Strava authorization error:", error);
      setStatus(`Error: ${error}. Please try again.`);
      processingRef.current = false;
      return;
    }

    if (code && !processingRef.current) {
      processingRef.current = true; // Mark as processing *once*
      console.log("[StravaCallback] Authorization Code found:", code);
      setStatus("Exchanging code for tokens...");

      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      console.log(
        `[StravaCallback] POSTing code to ${backendUrl}/strava/token`
      );

      axios
        .post(`${backendUrl}/strava/token`, { code })
        .then((response) => {
          console.log(
            "[StravaCallback] Backend response successful:",
            response.data
          );

          if (
            response.data &&
            response.data.athlete &&
            response.data.athlete.appUserId
          ) {
            setStatus("Strava authentication successful!");
            setAthleteData(response.data.athlete); // For potential display

            // --- Log Before Storing ---
            const dataToStore = response.data.athlete;
            console.log(
              "%c[StravaCallback] Storing athlete data to localStorage:",
              "color: green; font-weight: bold;",
              dataToStore
            );
            // --- Check for appUserId specifically ---
            if (!dataToStore.appUserId) {
              console.error(
                "%c[StravaCallback] CRITICAL: appUserId is MISSING in data from backend!",
                "color: red; font-weight: bold;",
                dataToStore
              );
              setStatus(
                "Authentication Error: Missing critical user ID from backend."
              );
              processingRef.current = false; // Allow retry potentially
              return; // Stop further processing
            }

            try {
              localStorage.setItem(
                "stravaAthlete",
                JSON.stringify(dataToStore)
              );
              // --- Log After Storing (Optional: Read back to verify) ---
              const storedValue = localStorage.getItem("stravaAthlete");
              console.log(
                "%c[StravaCallback] Value verified in localStorage:",
                "color: green;",
                storedValue
              );

              // Redirect to dashboard only after successful storage
              console.log(
                "[StravaCallback] Storage successful. Navigating to dashboard..."
              );
              navigate("/dashboard", { replace: true }); // Use replace to avoid callback in history
            } catch (storageError) {
              console.error(
                "%c[StravaCallback] Error saving to localStorage:",
                "color: red;",
                storageError
              );
              setStatus("Failed to save session. Please try again.");
              processingRef.current = false; // Allow retry
            }
          } else {
            console.error(
              "%c[StravaCallback] Backend response missing athlete data or appUserId:",
              "color: red; font-weight: bold;",
              response.data
            );
            setStatus(
              "Authentication Error: Invalid data received from backend."
            );
            processingRef.current = false;
            localStorage.removeItem("stravaAthlete");
          }
        })
        .catch((err) => {
          console.error(
            "[StravaCallback] Error POSTing code to backend:",
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
    } else if (!code && !error && !processingRef.current) {
      // Avoid logging if already processing
      console.log("[StravaCallback] No code or error found in URL params yet.");
      setStatus("Waiting for Strava authorization...");
    }
  }, [code, error, navigate]); // Dependencies

  return (
    <div>
      <h1>Strava Authentication</h1>
      <p>{status}</p>
      {athleteData && <p>Redirecting...</p>}
    </div>
  );
};

export default StravaCallback;
