// src/components/StravaCallback.js
import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios"; // Use raw axios for this one call as apiClient interceptor might interfere if no token exists initially

const StravaCallback = (/* { onAuthSuccess } */) => {
  // Accept callback if needed
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const [status, setStatus] = useState("Processing Strava connection...");
  const processingRef = useRef(false);

  useEffect(() => {
    if (error) {
      /* ... handle error ... */ return;
    }

    if (code && !processingRef.current) {
      processingRef.current = true;
      setStatus("Exchanging code with backend...");
      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";

      // Use raw axios POST to /strava/token
      axios
        .post(`${backendUrl}/strava/token`, { code })
        .then((response) => {
          console.log("[StravaCallback] Backend response:", response.data);

          // --- Store Token and User Info ---
          if (response.data?.token && response.data?.user) {
            localStorage.setItem("authToken", response.data.token);
            localStorage.setItem(
              "stravaAthlete",
              JSON.stringify(response.data.user)
            ); // Store user info
            console.log("[StravaCallback] Token and User Info Saved.");
            setStatus("Strava connection successful! Redirecting...");

            // Notify App state if using prop/context callback
            // if (onAuthSuccess) onAuthSuccess(true, response.data.user);

            // --- Force reload to update App state ---
            window.location.href =
              response.data.user.role === "coach"
                ? "/coach/dashboard"
                : "/dashboard";
            // navigate(response.data.user.role === 'coach' ? '/coach/dashboard' : '/dashboard');
          } else {
            console.error(
              "[StravaCallback] Backend response missing token or user."
            );
            setStatus("Connection error: Invalid response from server.");
            localStorage.removeItem("authToken"); // Clear partial data
            localStorage.removeItem("stravaAthlete");
          }
          // --- End Store ---
        })
        .catch((err) => {
          console.error(
            "[StravaCallback] Error during backend token exchange:",
            err.response?.data || err.message
          );
          setStatus(
            `Connection failed: ${err.response?.data?.message || err.message}`
          );
          localStorage.removeItem("authToken");
          localStorage.removeItem("stravaAthlete");
        });
      // No finally for processingRef here, let redirect handle it
    } else if (!code && !error) {
      setStatus("Waiting for Strava code...");
    }
  }, [code, error, navigate /*, onAuthSuccess */]); // Add onAuthSuccess if using callback

  return (
    <div>
      <h1>Connecting with Strava...</h1>
      <p>{status}</p>
      {/* Maybe add a manual redirect link if auto-redirect fails */}
    </div>
  );
};

export default StravaCallback;
