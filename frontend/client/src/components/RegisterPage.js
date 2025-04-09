// src/components/RegisterPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api'; // Use our configured axios instance

const RegisterPage = () => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
     const isLoggedIn = !!localStorage.getItem('authToken'); // Check if already logged in

    // Redirect if already logged in
    useEffect(() => {
        if (isLoggedIn) {
            console.log("[RegisterPage] User already logged in, redirecting to dashboard.");
            navigate('/dashboard');
        }
    }, [isLoggedIn, navigate]);


    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError(''); // Clear error on change
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Basic Frontend Validation
        if (!formData.email || !formData.password || !formData.firstName) {
            setError('First Name, Email, and Password are required.');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        // Add more validation (email format, password strength) if desired

        setIsLoading(true);
        try {
            console.log("[RegisterPage] Attempting registration for:", formData.email);
            // Make POST request to backend register route using apiClient
            // No auth token needed for registration
            const response = await apiClient.post('/auth/register', {
                firstName: formData.firstName,
                lastName: formData.lastName, // Send lastName even if optional on backend
                email: formData.email,
                password: formData.password,
                // role: 'runner' // Backend defaults to runner
            });

            console.log("[RegisterPage] Registration successful:", response.data);
            setSuccess('Registration successful! Please log in.');
            // Optionally redirect to login after a short delay
            setTimeout(() => navigate('/login'), 2000); // Navigate to login page

        } catch (err) {
            console.error("[RegisterPage] Registration error:", err.response?.data || err.message);
            setError(`Registration failed: ${err.response?.data?.message || err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Don't render form if redirecting
     if (isLoggedIn) return <p>Redirecting...</p>;

    return (
        <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '5px' }}>
            <h2>Register for RunMind</h2>
            <form onSubmit={handleSubmit}>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                {success && <p style={{ color: 'green' }}>{success}</p>}

                <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="firstName">First Name:</label><br />
                    <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} required style={{width: '95%'}}/>
                </div>
                 <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="lastName">Last Name:</label><br />
                    <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} style={{width: '95%'}}/>
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="email">Email:</label><br />
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required style={{width: '95%'}}/>
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="password">Password:</label><br />
                    <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} required style={{width: '95%'}}/>
                </div>
                 <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="confirmPassword">Confirm Password:</label><br />
                    <input type="password" id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required style={{width: '95%'}}/>
                </div>

                <button type="submit" disabled={isLoading} style={{ padding: '10px 15px' }}>
                    {isLoading ? 'Registering...' : 'Register'}
                </button>
            </form>
             <p style={{marginTop: '15px'}}>
                Already have an account? <Link to="/login">Log In</Link>
            </p>
        </div>
    );
};

export default RegisterPage;