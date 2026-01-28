// js/auth.js

// Check if user is already logged in
fetch('api/check_session.php')
    .then(res => res.json())
    .then(data => {
        if (data.logged_in) {
            window.location.href = 'dashboard.html';
        }
    });

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault(); // Stop refreshing page

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');

    // Call AJAX
    fetch('api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            window.location.href = 'dashboard.html'; // Success -> Dashboard
        } else {
            errorMsg.innerText = data.message;
            errorMsg.style.display = 'block';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        errorMsg.innerText = 'Σφάλμα επικοινωνίας με τον server';
        errorMsg.style.display = 'block';
    });
});