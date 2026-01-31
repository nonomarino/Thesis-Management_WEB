// public/js/student.js

// Global variable to store current thesis data for management view
let currentThesisData = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("Student App Loaded");

    const tabThesis = document.getElementById('tab-btn-thesis');
    const tabProfile = document.getElementById('tab-btn-profile');
    const viewThesis = document.getElementById('view-thesis');
    const viewProfile = document.getElementById('view-profile');
    const viewManage = document.getElementById('view-manage-thesis'); 
    
    document.getElementById('btn-logout').addEventListener('click', () => {
        fetch('../api/auth.php?action=logout').then(() => window.location.href = 'index.html');
    });

    tabThesis.addEventListener('click', () => {
        tabThesis.classList.add('active');
        tabProfile.classList.remove('active');
        if(viewThesis) viewThesis.classList.remove('hidden');
        if(viewProfile) viewProfile.classList.add('hidden');
        if(viewManage) viewManage.classList.add('hidden'); 
        loadMyThesis(); 
    });

    tabProfile.addEventListener('click', () => {
        tabProfile.classList.add('active');
        tabThesis.classList.remove('active');
        if(viewProfile) viewProfile.classList.remove('hidden');
        if(viewThesis) viewThesis.classList.add('hidden');
        if(viewManage) viewManage.classList.add('hidden'); 
        loadProfile(); 
    });

    // Profile Save
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            const formData = {
                email: document.getElementById('p-email').value,
                mobile: document.getElementById('p-mobile').value,
                landline: document.getElementById('p-landline').value,
                address: document.getElementById('p-address').value
            };
            await fetch('../api/student.php?action=update_profile', {
                method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(formData)
            });
            alert("Το προφίλ ενημερώθηκε!");
        });
    }

    loadUserInfo();
    loadMyThesis();
});

function loadUserInfo() {
    fetch('../api/auth.php?action=check').then(res=>res.json()).then(data=>{
        if(data.user) document.getElementById('user-name').textContent = data.user.name;
    });
}

async function loadProfile() {
    const res = await fetch('../api/student.php?action=get_profile');
    const data = await res.json();
    if(data.success && data.data) {
        const p = data.data;
        document.getElementById('display-fullname').textContent = `${p.first_name} ${p.last_name}`;
        document.getElementById('display-am').textContent = p.student_am ? `ΑΜ: ${p.student_am}` : 'Student';
        document.getElementById('profile-avatar').textContent = (p.first_name[0] + p.last_name[0]).toUpperCase();
        
        document.getElementById('p-fullname').value = `${p.first_name} ${p.last_name}`;
        document.getElementById('p-am').value = p.student_am || '-';
        if(p.email_to_show) document.getElementById('p-email').value = p.email_to_show;
        if(p.address) document.getElementById('p-address').value = p.address;
        if(p.phone_mobile) document.getElementById('p-mobile').value = p.phone_mobile;
        if(p.phone_landline) document.getElementById('p-landline').value = p.phone_landline;
    }
}

async function loadMyThesis() {
    const contentDiv = document.getElementById('thesis-content');
    
    document.getElementById('view-thesis').classList.remove('hidden');
    document.getElementById('view-manage-thesis').classList.add('hidden');

    try {
        const response = await fetch('../api/student.php?action=get_my_thesis&t=' + new Date().getTime());
        const data = await response.json();

        if (!data.success) { contentDiv.innerHTML = `<p style="color:red">Error</p>`; return; }
        
        currentThesisData = data.thesis; 
        const t = data.thesis;

        if (!t) {
            contentDiv.innerHTML = `<div style="text-align:center; padding:40px; color:#777;"><p>Δεν σας έχει ανατεθεί θέμα.</p></div>`;
            return;
        }

        let statusText = t.status === 'assigned' ? 'Υπό ανάθεση' : (t.status === 'active' ? 'Ενεργή' : (t.status === 'completed' ? 'Περατωμένη' : 'Άγνωστο'));
        let badgeClass = t.status === 'assigned' ? 'bg-gray' : (t.status === 'active' ? 'bg-blue' : 'bg-green');

        let committeeHtml = `<ul style="margin:5px 0; padding-left:20px;"><li><strong>${t.sup_first} ${t.sup_last}</strong> (Επιβλέπων)</li>`;
        if (data.committee && data.committee.length > 0) {
            data.committee.forEach(m => committeeHtml += `<li>${m.first_name} ${m.last_name} (Μέλος)</li>`);
        } else {
            committeeHtml += `<li><em>Δεν έχουν οριστεί επιπλέον μέλη ακόμα.</em></li>`;
        }
        committeeHtml += '</ul>';

        let fileHtml = t.file_path ? `<a href="../public/uploads/${t.file_path}" target="_blank" style="color:#007bff; text-decoration:none;"><i class="fas fa-paperclip"></i> ${t.file_path}</a>` : `<span style="color:#777;">Κανένα αρχείο</span>`;

        contentDiv.innerHTML = `
            <div class="info-row"><span class="label">Θέμα:</span><span class="value" style="font-size:20px;">${t.title}</span></div>
            <div class="info-row"><span class="label">Περιγραφή:</span><p style="background:#f9f9f9; padding:10px;">${t.description}</p></div>
            <div class="info-row"><span class="label">Συνημμένο Αρχείο:</span>${fileHtml}</div>
            <hr style="border-top:1px solid #eee; margin:15px 0;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div><span class="label">Τρέχουσα Κατάσταση:</span><span class="badge ${badgeClass}">${statusText}</span></div>
                <div><span class="label">Χρόνος από Ανάθεση:</span><span class="value"><i class="far fa-clock"></i> ${data.time_elapsed}</span></div>
            </div>
            <div class="info-row" style="margin-top:20px;"><span class="label">Τριμελής Επιτροπή:</span>${committeeHtml}</div>
            <div style="text-align:right; margin-top:30px; border-top:1px solid #eee; padding-top:20px;">
                <button class="btn btn-primary" onclick="renderManageThesisPage()"><i class="fas fa-cog"></i> Διαχείριση / Ενέργειες</button>
            </div>
        `;
    } catch (err) { console.error(err); }
}

// =============================================================================
// MANAGE THESIS PAGE (MULTI-SELECT UPDATE)
// =============================================================================

window.renderManageThesisPage = async function() {
    if (!currentThesisData) return;

    document.getElementById('view-thesis').classList.add('hidden');
    document.getElementById('view-manage-thesis').classList.remove('hidden');

    const manageContent = document.getElementById('manage-content');
    manageContent.innerHTML = '<p>Φόρτωση...</p>';

    // CASE 1: Assigned - Invite Members
    if (currentThesisData.status === 'assigned') {
        try {
            const invitesRes = await fetch(`../api/student.php?action=get_thesis_invites&thesis_id=${currentThesisData.id}&t=` + Date.now());
            const invitesData = await invitesRes.json();
            const existingIds = (invitesData.data || []).map(i => i.professor_id);

            const instructorsRes = await fetch(`../api/student.php?action=get_available_instructors&supervisor_id=${currentThesisData.supervisor_id}`);
            const instructorsData = await instructorsRes.json();

            // --- BUILD MULTI-SELECT CHECKBOX LIST ---
            let listHtml = '';
            if (instructorsData.success && instructorsData.data) {
                const available = instructorsData.data.filter(inst => !existingIds.includes(inst.id));
                
                if (available.length > 0) {
                    available.forEach(inst => {
                        listHtml += `
                            <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid #eee; cursor:pointer;" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='white'">
                                <input type="checkbox" value="${inst.id}" class="prof-checkbox" style="transform:scale(1.2);">
                                <span style="color:#2c3e50; font-weight:500;">${inst.last_name} ${inst.first_name}</span>
                            </label>
                        `;
                    });
                } else {
                    listHtml = '<div style="padding:15px; color:#777; font-style:italic;">Δεν υπάρχουν άλλοι διαθέσιμοι καθηγητές.</div>';
                }
            }

            // Build Invites Table
            let invitesTableHtml = '';
            if (invitesData.data && invitesData.data.length > 0) {
                invitesTableHtml = `
                    <div style="margin-top:30px;">
                        <h4 style="color:#2c3e50; margin-bottom:10px;">Απεσταλμένες Προσκλήσεις</h4>
                        <table style="width:100%; border-collapse:collapse; font-size:14px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                            <thead style="background:#f8f9fa; text-align:left;">
                                <tr>
                                    <th style="padding:10px; border-bottom:2px solid #eee;">Καθηγητής</th>
                                    <th style="padding:10px; border-bottom:2px solid #eee;">Κατάσταση</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                invitesData.data.forEach(inv => {
                    let statusColor = '#f39c12'; 
                    let statusLabel = 'Εκκρεμεί';
                    if(inv.status === 'accepted') { statusColor = '#27ae60'; statusLabel = 'Αποδέχτηκε'; }
                    if(inv.status === 'rejected') { statusColor = '#e74c3c'; statusLabel = 'Απέρριψε'; }

                    invitesTableHtml += `
                        <tr style="border-bottom:1px solid #eee; background:white;">
                            <td style="padding:10px;">${inv.last_name} ${inv.first_name}</td>
                            <td style="padding:10px;"><span style="color:${statusColor}; font-weight:bold;">${statusLabel}</span></td>
                        </tr>`;
                });
                invitesTableHtml += '</tbody></table></div>';
            }

            // RENDER UI
            manageContent.innerHTML = `
                <h2 class="section-title">Συγκρότηση Τριμελούς Επιτροπής</h2>
                
                <div style="background:#e3f2fd; padding:15px; border-radius:8px; border-left:5px solid #2196f3; margin-bottom:25px;">
                    <strong>Επιλογή Μελών:</strong> Παρακαλώ επιλέξτε τους καθηγητές που επιθυμείτε να προσκαλέσετε στην επιτροπή.
                </div>

                <div class="card" style="border:1px solid #eee; box-shadow:none; background:#fafafa; padding:0; overflow:hidden;">
                    <div style="padding:15px; background:#f1f2f6; border-bottom:1px solid #ddd; font-weight:600; color:#555;">
                        Διαθέσιμοι Καθηγητές
                    </div>
                    
                    <div style="max-height: 250px; overflow-y: auto; background:white;">
                        ${listHtml}
                    </div>

                    <div style="padding:15px; background:#f9f9f9; border-top:1px solid #ddd; text-align:right;">
                        <button class="btn btn-primary" onclick="sendCommitteeInvites()">
                            <i class="fas fa-paper-plane"></i> Αποστολή Προσκλήσεων
                        </button>
                    </div>
                </div>

                ${invitesTableHtml}
            `;

        } catch (err) {
            console.error(err);
            manageContent.innerHTML = '<p style="color:red">Σφάλμα φόρτωσης δεδομένων.</p>';
        }
    } 
    else {
        manageContent.innerHTML = `
            <h2 class="section-title">Διαχείριση Διπλωματικής</h2>
            <p>Η κατάσταση της εργασίας είναι: <strong>${currentThesisData.status}</strong></p>
            <p>Δεν υπάρχουν διαθέσιμες ενέργειες για αυτή τη φάση ακόμα.</p>
        `;
    }
}

// Function to Send MULTIPLE Invites
window.sendCommitteeInvites = async function() {
    // 1. Get all checked boxes
    const checkboxes = document.querySelectorAll('.prof-checkbox:checked');
    
    if (checkboxes.length === 0) {
        alert("Παρακαλώ επιλέξτε τουλάχιστον έναν καθηγητή.");
        return;
    }

    if(!confirm(`Να σταλούν προσκλήσεις σε ${checkboxes.length} καθηγητές;`)) return;

    const formData = new FormData();
    formData.append('thesis_id', currentThesisData.id);
    
    // Append each selected ID to the array
    checkboxes.forEach(cb => {
        formData.append('professor_ids[]', cb.value);
    });

    try {
        const res = await fetch('../api/student.php?action=send_invite', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            alert(data.message || "Οι προσκλήσεις στάλθηκαν επιτυχώς!");
            renderManageThesisPage(); // Refresh page
        } else {
            alert("Σφάλμα: " + (data.error || 'Άγνωστο'));
        }
    } catch (err) {
        console.error(err);
        alert("System error.");
    }
}