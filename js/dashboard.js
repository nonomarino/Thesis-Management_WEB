// js/dashboard.js

// 1. Με το που φορτώσει η σελίδα, ρωτάμε το API: "Ποιος είναι μέσα;"
document.addEventListener('DOMContentLoaded', () => {
    fetch('api/check_session.php')
        .then(response => response.json())
        .then(data => {
            if (!data.logged_in) {
                // Αν δεν είναι συνδεδεμένος, διώξτον πίσω στο login
                window.location.href = 'index.html';
            } else {
                // Είναι συνδεδεμένος. Ενημέρωσε το UI
                initDashboard(data);
            }
        })
        .catch(err => console.error('Error checking session:', err));
});

function initDashboard(user) {
    // Εμφάνιση ονόματος και ρόλου
    document.getElementById('userNameDisplay').innerText = user.full_name;
    
    // Μετάφραση ρόλου στα Ελληνικά
    let roleName = '';
    if (user.role === 'student') roleName = 'Φοιτητής';
    if (user.role === 'instructor') roleName = 'Διδάσκων';
    if (user.role === 'secretariat') roleName = 'Γραμματεία';
    document.getElementById('userRoleDisplay').innerText = roleName;

    // Για ασφάλεια κρύβουμε τα πάντα
    // Παρόλο που και το HTML έχει ήδη class="hidden"
    document.getElementById('studentSection').classList.add('hidden');
    document.getElementById('instructorSection').classList.add('hidden');
    document.getElementById('secretariatSection').classList.add('hidden');

    // Αφαιρούμε την ετικέτα hidden
    // Εμφάνιση των κατάλληλων τμημάτων (Sections)
    if (user.role === 'student') {
        document.getElementById('studentSection').classList.remove('hidden');
    } else if (user.role === 'instructor') {
        document.getElementById('instructorSection').classList.remove('hidden');
    } else if (user.role === 'secretariat') {
        document.getElementById('secretariatSection').classList.remove('hidden');
    }
}

// Λειτουργία Αποσύνδεσης
function logout() {
    fetch('api/logout.php')
        .then(() => {
            window.location.href = 'index.html';
        });
}