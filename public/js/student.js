// public/js/student.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("Student App Loaded");

    // Elements
    const tabThesis = document.getElementById('tab-btn-thesis');
    const tabProfile = document.getElementById('tab-btn-profile');
    const viewThesis = document.getElementById('view-thesis');
    const viewProfile = document.getElementById('view-profile');
    
    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        fetch('../api/auth.php?action=logout').then(() => window.location.href = 'index.html');
    });

    // --- Tab Switching ---
    tabThesis.addEventListener('click', () => {
        tabThesis.classList.add('active');
        tabProfile.classList.remove('active');
        viewThesis.classList.remove('hidden');
        viewProfile.classList.add('hidden');
    });

    tabProfile.addEventListener('click', () => {
        tabProfile.classList.add('active');
        tabThesis.classList.remove('active');
        viewProfile.classList.remove('hidden');
        viewThesis.classList.add('hidden');
        
        // Load data when tab is opened
        loadProfile(); 
    });

    // --- Manage/View Mode Toggles ---
    const btnManage = document.getElementById('btn-go-manage');
    const btnBack = document.getElementById('btn-go-back');
    
    if(btnManage) {
        btnManage.addEventListener('click', () => {
            document.getElementById('card-view-mode').classList.add('hidden');
            document.getElementById('card-manage-mode').classList.remove('hidden');
        });
    }

    if(btnBack) {
        btnBack.addEventListener('click', () => {
            document.getElementById('card-manage-mode').classList.add('hidden');
            document.getElementById('card-view-mode').classList.remove('hidden');
        });
    }

    // --- PROFILE SAVE HANDLER (NEW) ---
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Stop page reload

            // Collect data from inputs
            const formData = {
                email: document.getElementById('p-email').value,
                mobile: document.getElementById('p-mobile').value,
                landline: document.getElementById('p-landline').value,
                address: document.getElementById('p-address').value // Covers Street & Number
            };

            // Send to PHP
            try {
                const response = await fetch('../api/student.php?action=update_profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                
                const res = await response.json();

                if (res.success) {
                    alert("Profile updated successfully!");
                } else {
                    alert("Error: " + (res.error || "Unknown error"));
                }
            } catch (err) {
                console.error(err);
                alert("System error during save.");
            }
        });
    }

    // Initial Load
    loadUserInfo();
    loadMyThesis();
});

// Load User Name (Header)
function loadUserInfo() {
    fetch('../api/auth.php?action=check')
        .then(res => res.json())
        .then(data => {
            if (data.user) {
                document.getElementById('user-name').textContent = data.user.name;
            }
        });
}

// Load Profile Data (Fill inputs)
async function loadProfile() {
    try {
        const response = await fetch('../api/student.php?action=get_profile');
        const res = await response.json();

        if (res.success && res.data) {
            const p = res.data;

            // 1. Full Name (Read Only)
            document.getElementById('p-fullname').value = `${p.first_name} ${p.last_name}`;

            // 2. Email (Editable)
            // CHANGE HERE: We use the logic we created in PHP
            if (p.email_to_show) {
                document.getElementById('p-email').value = p.email_to_show;
            }

            // 3. Contact Info
            if (p.address) document.getElementById('p-address').value = p.address;
            if (p.phone_mobile) document.getElementById('p-mobile').value = p.phone_mobile;
            if (p.phone_landline) document.getElementById('p-landline').value = p.phone_landline;
        }
    } catch (err) {
        console.error("Error loading profile:", err);
    }

}

// Load Thesis Data (ΠΡΟΒΟΛΗ ΘΕΜΑΤΟΣ)
async function loadMyThesis() {
    const contentDiv = document.getElementById('thesis-content');
    const statusBadge = document.getElementById('thesis-status-badge');
    const actionsContainer = document.getElementById('actions-container');

    try {
        const response = await fetch('../api/student.php?action=get_my_thesis');
        const data = await response.json();

        if (!data.success) {
            console.error("Server Error:", data); 
            // Τυπώνουμε το πραγματικό μήνυμα λάθους στην οθόνη
            contentDiv.innerHTML = `<p style="color:red">Σφάλμα: ${data.error || 'Άγνωστο σφάλμα'}</p>`;
            return;
        }
        const t = data.thesis;

        // --- ΠΕΡΙΠΤΩΣΗ: ΔΕΝ ΕΧΕΙ ΘΕΜΑ ---
        if (!t) {
            statusBadge.className = 'badge bg-gray';
            statusBadge.textContent = 'Δεν έχει Ανατεθεί';
            contentDiv.innerHTML = `
                <div style="text-align:center; padding: 40px; color: #777;">
                    <i class="fas fa-book-open" style="font-size: 40px; margin-bottom: 15px;"></i>
                    <p>Δεν σας έχει ανατεθεί θέμα διπλωματικής εργασίας.</p>
                </div>
            `;
            if(actionsContainer) actionsContainer.classList.add('hidden');
            return;
        }

        // --- ΜΕΤΑΦΡΑΣΗ KATAΣΤΑΣΗΣ (ΑΚΡΙΒΗΣ ΟΡΟΛΟΓΙΑ) ---
        let statusText = 'Άγνωστο';
        let badgeClass = 'bg-gray';

        if (t.status === 'assigned') { 
            statusText = 'Υπό ανάθεση'; // Όπως το ζήτησες (σημαίνει: ψάχνουμε επιτροπή)
            badgeClass = 'bg-gray'; 
        } else if (t.status === 'under_examination') { 
            statusText = 'Υπό εξέταση'; 
            badgeClass = 'bg-blue'; 
        } else if (t.status === 'completed') { 
            statusText = 'Περατωμένη'; 
            badgeClass = 'bg-green'; 
        }

        // Ενημέρωση Badge στον τίτλο του κουτιού
        statusBadge.textContent = statusText;
        statusBadge.className = `badge ${badgeClass}`;

        // --- ΤΡΙΜΕΛΗΣ ΕΠΙΤΡΟΠΗ ---
        // Βάζουμε πρώτα τον Επιβλέποντα, μετά τα μέλη
        let committeeHtml = `<ul style="margin: 5px 0; padding-left: 20px;">`;
        committeeHtml += `<li><strong>${t.sup_first} ${t.sup_last}</strong> (Επιβλέπων)</li>`; // Ο Επιβλέπων πάντα πρώτος
        
        if (data.committee && data.committee.length > 0) {
            data.committee.forEach(m => {
                committeeHtml += `<li>${m.first_name} ${m.last_name} (Μέλος)</li>`;
            });
        } else {
            committeeHtml += `<li><em>Δεν έχουν οριστεί επιπλέον μέλη ακόμα.</em></li>`;
        }
        committeeHtml += '</ul>';

        // --- ΣΥΝΗΜΜΕΝΟ ΑΡΧΕΙΟ ---
        // Ελέγχουμε αν υπάρχει αρχείο στη βάση
        let fileHtml = '';
        if (t.file_path) {
            // Υποθέτουμε ότι τα uploads πάνε στο folder 'uploads/'
            // Προσοχή: Στη βάση πρέπει να αποθηκεύεται το filename ή το path
            fileHtml = `
                <div style="margin-top: 10px;">
                    <a href="uploads/${t.file_path}" target="_blank" class="btn btn-secondary" style="font-size: 13px; padding: 5px 10px;">
                        <i class="fas fa-file-download"></i> Λήψη Περιγραφής (PDF)
                    </a>
                </div>
            `;
        } else {
            fileHtml = `<p style="font-style:italic; color:#777;">Δεν υπάρχει συνημμένο αρχείο.</p>`;
        }

        // --- ΕΜΦΑΝΙΣΗ (RENDER) ΜΕ ΤΗ ΣΕΙΡΑ ΠΟΥ ΖΗΤΗΣΕΣ ---
        contentDiv.innerHTML = `
            <div class="info-row">
                <span class="label">Θέμα:</span>
                <span class="value" style="font-size: 20px; color: #2c3e50;">${t.title}</span>
            </div>

            <div class="info-row">
                <span class="label">Περιγραφή:</span>
                <p style="margin-top:5px; background: #f9f9f9; padding: 10px; border-radius: 4px;">${t.description}</p>
            </div>

            <div class="info-row">
                <span class="label">Συνημμένο Αρχείο:</span>
                ${fileHtml}
            </div>

            <hr style="border:0; border-top:1px solid #eee; margin: 15px 0;">

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                <div>
                    <span class="label">Τρέχουσα Κατάσταση:</span>
                    <span class="badge ${badgeClass}" style="font-size:14px;">${statusText}</span>
                </div>

                <div>
                    <span class="label">Χρόνος από Ανάθεση:</span>
                    <span class="value"><i class="far fa-clock"></i> ${data.time_elapsed ? data.time_elapsed : '-'}</span>
                </div>
            </div>

            <div class="info-row" style="margin-top:20px;">
                <span class="label">Τριμελής Επιτροπή:</span>
                ${committeeHtml}
            </div>
        `;
        
        // Show Manage Button (αν υπάρχει θέμα, εμφανίζουμε το κουμπί ενεργειών)
        if(actionsContainer) actionsContainer.classList.remove('hidden');

    } catch (err) {
        console.error("Error:", err);
        contentDiv.innerHTML = `<p>Προέκυψε σφάλμα σύνδεσης.</p>`;
    }
}