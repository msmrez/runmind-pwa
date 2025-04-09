// src/components/DiaryPage.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Helper to format date as YYYY-MM-DD for API calls and date input default
const getIsoDate = (date = new Date()) => {
    return date.toISOString().split('T')[0];
};

const DiaryPage = () => {
    const [selectedDate, setSelectedDate] = useState(getIsoDate()); // Default to today
    const [notes, setNotes] = useState('');
    const [currentEntryId, setCurrentEntryId] = useState(null); // Store ID if editing
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [userInfo, setUserInfo] = useState(null); // Need user info for auth

    // Load user info
    useEffect(() => {
        const storedUser = localStorage.getItem("stravaAthlete");
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                if (parsed?.appUserId) setUserInfo(parsed);
                else setError("Invalid user session.");
            } catch { setError("Corrupted user session."); }
        } else { setError("User not logged in."); }
    }, []);

    // --- Fetch diary entry when selectedDate or userInfo changes ---
    const fetchDiaryEntry = useCallback(async () => {
        if (!userInfo || !selectedDate) return; // Don't fetch without user or date

        console.log(`[DiaryPage] Fetching entry for date: ${selectedDate}, User: ${userInfo.appUserId}`);
        setIsLoading(true);
        setError('');
        setSuccessMessage('');
        setNotes(''); // Reset notes before loading new date
        setCurrentEntryId(null); // Reset ID

        try {
            const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
            const response = await axios.get(`${backendUrl}/api/diary`, {
                headers: { "X-User-ID": userInfo.appUserId },
                params: { date: selectedDate } // Pass date as query param
            });

            if (response.data) { // Entry found
                console.log("[DiaryPage] Entry found:", response.data);
                setNotes(response.data.notes || '');
                setCurrentEntryId(response.data.entry_id);
            } else { // No entry found for this date
                console.log("[DiaryPage] No entry found for this date.");
                // Keep notes empty and currentEntryId null
            }
        } catch (err) {
            console.error("[DiaryPage] Error fetching diary entry:", err.response?.data || err.message);
            setError(`Failed to load entry: ${err.response?.data?.message || err.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate, userInfo]); // Dependencies for useCallback

    // Trigger fetch when component mounts or dependencies change
    useEffect(() => {
        fetchDiaryEntry();
    }, [fetchDiaryEntry]); // Dependency array includes the memoized fetch function

    // --- Handle saving (Create or Update) ---
    const handleSaveEntry = async (e) => {
        e.preventDefault(); // Prevent default form submission
        if (!userInfo) { setError("Cannot save: User not logged in."); return; }

        console.log(`[DiaryPage] Saving entry for date: ${selectedDate}`);
        setIsSaving(true);
        setError('');
        setSuccessMessage('');

        try {
            const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
            const response = await axios.post(`${backendUrl}/api/diary`,
                { // Data in request body
                    entry_date: selectedDate,
                    notes: notes
                },
                { // Config with headers
                    headers: { "X-User-ID": userInfo.appUserId }
                }
            );

            console.log("[DiaryPage] Save successful:", response.data);
            setSuccessMessage("Entry saved successfully!");
            setCurrentEntryId(response.data.entry_id); // Update ID after save
            // Optionally clear success message after a delay
            setTimeout(() => setSuccessMessage(''), 3000);

        } catch (err) {
            console.error("[DiaryPage] Error saving diary entry:", err.response?.data || err.message);
            setError(`Failed to save entry: ${err.response?.data?.message || err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

     // --- Handle deleting ---
    const handleDeleteEntry = async () => {
        if (!userInfo || !currentEntryId) {
             setError("Cannot delete: No entry selected or not logged in.");
             return;
         }
         // Optional: Confirm deletion
         if (!window.confirm(`Are you sure you want to delete the entry for ${selectedDate}?`)) {
             return;
         }

        console.log(`[DiaryPage] Deleting entry for date: ${selectedDate}, ID: ${currentEntryId}`);
        setIsSaving(true); // Use saving state to disable buttons during delete
        setError('');
        setSuccessMessage('');

        try {
            const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
            await axios.delete(`${backendUrl}/api/diary`, {
                headers: { "X-User-ID": userInfo.appUserId },
                params: { date: selectedDate } // Pass date as query param for deletion
            });

            console.log("[DiaryPage] Delete successful");
            setSuccessMessage("Entry deleted successfully!");
            setNotes(''); // Clear notes field
            setCurrentEntryId(null); // Clear ID
             setTimeout(() => setSuccessMessage(''), 3000);

        } catch (err) {
            console.error("[DiaryPage] Error deleting diary entry:", err.response?.data || err.message);
            setError(`Failed to delete entry: ${err.response?.data?.message || err.message}`);
        } finally {
            setIsSaving(false);
        }
    };


    // Handle date change
    const handleDateChange = (e) => {
        setSelectedDate(e.target.value);
        // Fetching will be triggered by the useEffect watching selectedDate
    };

    // --- Render Logic ---
    if (!userInfo && !error) {
        return <p>Loading user info...</p>; // Show loading if user isn't loaded yet and no error
    }
     if (error && !userInfo) {
         // If there was an error loading user info or user not logged in
         return <div style={{ padding: '20px' }}><p style={{ color: 'red' }}>Error: {error}</p> <a href="/">Return Home</a></div>;
     }


    return (
        <div style={{ padding: '20px', maxWidth: '700px', margin: 'auto' }}>
            <h2>Daily Diary</h2>

            {/* Date Selector */}
            <div>
                <label htmlFor="diary-date" style={{ marginRight: '10px' }}>Select Date:</label>
                <input
                    type="date"
                    id="diary-date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    max={getIsoDate()} // Prevent selecting future dates
                    style={{ padding: '5px' }}
                    disabled={isLoading || isSaving} // Disable while loading/saving
                />
            </div>

             {/* Display loading/error states for fetching */}
             {isLoading && <p style={{fontStyle:'italic', color:'#555'}}>Loading entry...</p>}
             {error && !isLoading && <p style={{ color: 'red' }}>{error}</p>}
             {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}


            {/* Notes Text Area and Save Button */}
            {/* Only show form if user info is loaded */}
            {userInfo && !isLoading && (
                <form onSubmit={handleSaveEntry} style={{ marginTop: '20px' }}>
                    <label htmlFor="diary-notes">Notes for {selectedDate}:</label>
                    <textarea
                        id="diary-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows="8"
                        placeholder="Log your training notes, feelings, nutrition, etc..."
                        style={{ width: '100%', marginTop: '5px', padding: '8px', boxSizing: 'border-box' }}
                        disabled={isSaving} // Disable while saving
                    />
                    <div style={{marginTop: '10px', display: 'flex', justifyContent: 'space-between'}}>
                        <button type="submit" disabled={isSaving}>
                            {isSaving ? 'Saving...' : (currentEntryId ? 'Update Entry' : 'Save Entry')}
                        </button>
                        {/* Show delete button only if an entry exists for this date */}
                        {currentEntryId && (
                            <button type="button" onClick={handleDeleteEntry} disabled={isSaving} style={{backgroundColor: '#e74c3c', color:'white'}}>
                                Delete Entry
                            </button>
                        )}
                    </div>
                </form>
            )}
        </div>
    );
};

export default DiaryPage;