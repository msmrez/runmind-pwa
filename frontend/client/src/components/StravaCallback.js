// src/components/StravaCallback.js
import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios"; // Use plain axios for this one-off call (no prior auth token)

const StravaCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const [status, setStatus] = useState("Processing Strava callback...");
  // We don't necessarily need athleteData state if we just store and navigate
  // const [athleteData, setAthleteData] = useState(null);
  const processingRef = useRef(false);

  useEffect(() => {
    console.log("[StravaCallback] useEffect running.");
    if (error) {
      console.error("[StravaCallback] Strava authorization error:", error);
      setStatus(`Error: ${error}. Please try again or log in manually.`);
      processingRef.current = false;
      // Clear potentially bad tokens if user denied access etc.
      localStorage.removeItem("authToken");
      localStorage.removeItem("stravaAthlete");
      return;
    }

    if (code && !processingRef.current) {
      processingRef.current = true;
      console.log("[StravaCallback] Authorization Code found:", code);
      setStatus("Exchanging code for session token...");

      const backendUrl =
        process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
      console.log(
        `[StravaCallback] POSTing code to ${backendUrl}/strava/token`
      );

      // Use plain axios for the token exchange itself
      axios
        .post(`${backendUrl}/strava/token`, { code }) // Send code in body
        .then((response) => {
          console.log(
            "[StravaCallback] Backend response successful:",
            response.data
          );

          // --- Expect token AND user object ---
          if (
            response.data &&
            response.data.token &&
            response.data.user &&
            response.data.user.appUserId
          ) {
            setStatus("Strava authentication successful! Redirecting...");

            // --- Store Token (as 'authToken') ---
            const receivedToken = response.data.token;
            console.log(
              "%c[StravaCallback] Storing authToken...",
              "color: green;",
              receivedToken ? "Token Received" : "TOKEN MISSING!"
            );
            localStorage.setItem("authToken", receivedToken);

            // --- Store User Info (as 'stravaAthlete') ---
            // Ensure the object has the fields your app expects (like appUserId)
            const userToStore = response.data.user;
            // --- LOG THE OBJECT BEFORE STORING ---
            console.log(
              '%c[StravaCallback] OBJECT TO BE STORED in localStorage["stravaAthlete"]:',
              "color: purple; font-weight: bold;",
              JSON.stringify(userToStore, null, 2)
            ); // Log prettified JSON
            // --- END LOG ---
            console.log(
              "%c[StravaCallback] Storing user info (stravaAthlete)...",
              "color: green;",
              userToStore
            );
            localStorage.setItem("stravaAthlete", JSON.stringify(userToStore));

            // --- Log verification (Optional) ---
            console.log(
              "[StravaCallback] Verifying storage:",
              localStorage.getItem("authToken"),
              localStorage.getItem("stravaAthlete")
            );

            // Redirect to the dashboard upon successful login/token storage
            console.log(
              "[StravaCallback] Storage successful. Navigating to dashboard..."
            );
            navigate("/dashboard", { replace: true }); // Use replace
          } else {
            console.error(
              "%c[StravaCallback] Backend response missing token, user, or appUserId!",
              "color: red;",
              response.data
            );
            setStatus(
              "Authentication Error: Invalid session data received from server."
            );
            localStorage.removeItem("authToken"); // Clear bad state
            localStorage.removeItem("stravaAthlete");
            processingRef.current = false; // Allow potential retry?
          }
          // --- End Store ---
        })
        .catch((err) => {
          console.error(
            "[StravaCallback] Error POSTing code to backend:",
            err.response?.data || err.message
          );
          setStatus(
            `Authentication Error: ${
              err.response?.data?.message || err.message
            }`
          );
          localStorage.removeItem("authToken"); // Clear on error
          localStorage.removeItem("stravaAthlete");
          processingRef.current = false;
        });
    } else if (!code && !error && !processingRef.current) {
      console.log("[StravaCallback] No code/error found yet.");
      setStatus("Waiting for Strava authorization...");
    }
  }, [code, error, navigate]); // Dependencies

  return (
    <div>
      <h1>Strava Authentication</h1>
      <p>{status}</p>
      {/* Don't need to display athlete data here if redirecting */}
      {/* {athleteData && <p>Redirecting...</p>} */}
    </div>
  );
};

export default StravaCallback;
