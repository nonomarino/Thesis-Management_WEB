document.addEventListener('DOMContentLoaded', () => {
    
    const loginForm = document.getElementById('login-form');
    
    // 1. Check if user is ALREADY logged in when the page loads
    fetch('../api/auth.php?action=check')
        .then(response => response.json())
        .then(data => {
            if (data.logged_in) {
                // User is already logged in, redirect them immediately
                redirectToDashboard(data.user.role);
            }
        })
        .catch(err => console.error("Session check failed", err));

    // 2. Handle the Login Button Click
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error-msg');

            // Clear previous errors
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';

            try {
                // Send AJAX request to PHP
                const response = await fetch('../api/auth.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const result = await response.json();

                if (response.ok) {
                    // Login Success: Redirect based on the role received from PHP
                    redirectToDashboard(result.role);
                } else {
                    // Login Failed: Show error message
                    errorDiv.textContent = result.error || 'Login failed';
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                console.error("Login Error:", err);
                errorDiv.textContent = 'A system error occurred.';
                errorDiv.style.display = 'block';
            }
        });
    }

    // Helper function to handle the redirects
    function redirectToDashboard(role) {
        if (role === 'student') {
            window.location.href = 'student_dashboard.html';
        } else if (role === 'instructor') {
            window.location.href = 'instructor_dashboard.html';
        } else if (role === 'secretariat') {
            window.location.href = 'secretariat_dashboard.html';
        } else {
            alert("Unknown User Role");
        }
    }
});