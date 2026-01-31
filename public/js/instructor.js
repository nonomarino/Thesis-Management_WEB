// public/js/instructor.js

// Global Variables
let currentTopics = []; 

document.addEventListener('DOMContentLoaded', () => {
    console.log("Instructor App Loaded");

    // Navigation Handler
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const target = item.getAttribute('href');
            if (target === '#topics') loadMyTopics();
            else if (target === '#assign') renderAssignmentPage();
            else if (target === '#theses') renderThesesListPage();
            else if (target === '#invites') renderInvitesPage();
            else if (target === '#stats') renderStatsPage();
        });
    });

    // Initial Load
    loadMyTopics();
});

// =============================================================
// 1. TOPICS MANAGEMENT (ΛΙΣΤΑ & ΦΟΡΜΑ)
// =============================================================

// Α. ΟΘΟΝΗ ΛΙΣΤΑΣ (Table View)
window.loadMyTopics = async function() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<p>Φόρτωση θεμάτων...</p>';

    try {
        const res = await fetch('../api/instructor.php?action=list_my_topics&t=' + new Date().getTime());
        const data = await res.json();
        
        if(!data.success) {
            mainContent.innerHTML = '<p style="color:red">Σφάλμα φόρτωσης δεδομένων.</p>';
            return;
        }

        currentTopics = data.data || [];
        
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 class="section-title">Θέματα προς Ανάθεση</h2>
                <button class="btn" style="background-color: #007bff !important; color: white;" onclick="renderTopicForm()">
                    <i class="fas fa-plus"></i> Δημιουργία Νέου Θέματος
                </button>
            </div>

            <table class="table" style="width:100%; border-collapse: collapse; background:white; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <thead style="background:#eee; text-align:left;">
                    <tr>
                        <th style="padding:10px;">Τίτλος</th>
                        <th style="padding:10px;">Κατάσταση</th>
                        <th style="padding:10px;">Ανατέθηκε σε</th>
                        <th style="padding:10px;">Ημ/νία</th>
                        <th style="padding:10px;">Αρχείο</th>
                        <th style="padding:10px;">Ενέργειες</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if(currentTopics.length === 0) {
            html += '<tr><td colspan="6" style="padding:20px; text-align:center;">Δεν έχετε δημιουργήσει θέματα ακόμα.</td></tr>';
        } else {
            currentTopics.forEach(t => {
                const studentName = t.first_name ? `${t.first_name} ${t.last_name}` : '-';
                
                // --- ΑΛΛΑΓΗ ΕΔΩ ---
                let statusBadge = '';
                if(t.status === 'assigned') {
                    // Εφόσον έχει γίνει ανάθεση, η κατάσταση είναι "Υπό ανάθεση"
                    statusBadge = '<span class="badge" style="background:#3498db; color:white; padding:3px 8px; border-radius:10px; font-size:12px;">Υπό ανάθεση</span>';
                } else if(t.status === 'completed') {
                    statusBadge = '<span class="badge" style="background:#27ae60; color:white; padding:3px 8px; border-radius:10px; font-size:12px;">Ολοκληρωμένο</span>';
                } else {
                    // Αν δεν έχει ανατεθεί πουθενά (status null, free ή available)
                    statusBadge = '<span class="badge" style="background:#7f8c8d; color:white; padding:3px 8px; border-radius:10px; font-size:12px;">Ελεύθερο</span>';
                }

                let fileLink = '-';
                if (t.file_path) {
                    fileLink = `<a href="../public/uploads/${t.file_path}" target="_blank" style="color:#007bff; text-decoration:none;"><i class="fas fa-file-pdf"></i> PDF</a>`;
                }

                // Κουμπιά Ενεργειών στη Λίστα
                let actions = `
                    <button class="btn" onclick="renderTopicForm(${t.id})" title="Επεξεργασία" style="background-color: #6c757d !important; color: white; padding:5px 10px; font-size:12px;">
                        <i class="fas fa-edit"></i>
                    </button>
                `;
                
                if (t.student_id) {
                    actions += `
                        <button class="btn" onclick="revokeAssignment(${t.id})" title="Αναίρεση Ανάθεσης" style="background-color: #dc3545 !important; color: white; padding:5px 10px; font-size:12px; margin-left:5px; border:none; border-radius:5px; cursor:pointer;">
                            <i class="fas fa-user-slash"></i>
                        </button>
                    `;
                }

                html += `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:10px; font-weight:bold;">${t.title}</td>
                        <td style="padding:10px;">${statusBadge}</td>
                        <td style="padding:10px;">${studentName}</td>
                        <td style="padding:10px;">${new Date(t.created_at).toLocaleDateString()}</td>
                        <td style="padding:10px;">${fileLink}</td>
                        <td style="padding:10px;">${actions}</td>
                    </tr>
                `;
            });
        }

        html += `</tbody></table>`;
        mainContent.innerHTML = html;

    } catch(err) {
        console.error("Error loading topics:", err);
        mainContent.innerHTML = '<p>System Error.</p>';
    }
}

// Β. ΟΘΟΝΗ ΦΟΡΜΑΣ (Form View)
window.renderTopicForm = function(id = null) {
    const mainContent = document.getElementById('main-content');
    
    let topic = null;
    let titleText = 'Δημιουργία Νέου Θέματος';
    let btnText = 'Δημιουργία';
    
    if (id) {
        topic = currentTopics.find(t => t.id == id);
        if (topic) {
            titleText = 'Επεξεργασία Θέματος';
            btnText = 'Ενημέρωση';
        }
    }

    // --- ΚΟΥΜΠΙΑ ---
    let leftButtonHtml = '';
    
    const btnStyleCommon = "color:white !important; margin-right:10px; width: 140px; justify-content: center; border:none; cursor:pointer;";
    const redStyle = `background-color: #dc3545 !important; ${btnStyleCommon}`;
    const greenStyle = `background-color: #28a745 !important; ${btnStyleCommon}`;

    if (id) {
        // Edit Mode -> Delete Button
        leftButtonHtml = `
            <button type="button" class="btn" style="${redStyle}" onclick="deleteTopic(${id})">
                <i class="fas fa-trash"></i> Διαγραφή
            </button>`;
    } else {
        // Create Mode -> Cancel Button
        leftButtonHtml = `
            <button type="button" class="btn" style="${redStyle}" onclick="loadMyTopics()">
                Ακύρωση
            </button>`;
    }

    // Δεξί Κουμπί (Πράσινο): Submit
    let rightButtonHtml = `
        <button type="submit" class="btn" style="${greenStyle}">
            <i class="fas fa-save"></i> ${btnText}
        </button>
    `;

    mainContent.innerHTML = `
        <h2 class="section-title">${titleText}</h2>

        <div class="form-container">
            <form id="topic-form" onsubmit="submitTopic(event)">
                <input type="hidden" id="edit-topic-id" value="${id || ''}">
                
                <div class="form-group" style="margin-bottom:15px;">
                    <label style="font-weight:bold; display:block; margin-bottom:5px;">Τίτλος Θέματος</label>
                    <input type="text" id="topic-title" class="form-control" 
                           style="width:100%; padding:10px; border:1px solid #ddd; border-radius:4px;" 
                           value="${topic ? topic.title : ''}" required>
                </div>

                <div class="form-group" style="margin-bottom:15px;">
                    <label style="font-weight:bold; display:block; margin-bottom:5px;">Περιγραφή</label>
                    <textarea id="topic-desc" class="form-control" rows="8"
                              style="width:100%; padding:10px; border:1px solid #ddd; border-radius:4px; resize: none;">${topic ? topic.description : ''}</textarea>
                </div>

                <div class="form-group" style="margin-bottom:20px;">
                    <label style="font-weight:bold; display:block; margin-bottom:5px;">Επισύναψη Αρχείου (PDF)</label>
                    <input type="file" id="topic-file" class="form-control" accept="application/pdf">
                </div>

                <div style="text-align:right; border-top:1px solid #eee; padding-top:20px;">
                    ${leftButtonHtml}
                    ${rightButtonHtml}
                </div>
            </form>
        </div>
    `;
}

// Υποβολή Φόρμας
window.submitTopic = async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('edit-topic-id').value;
    const title = document.getElementById('topic-title').value;
    const desc = document.getElementById('topic-desc').value;
    const file = document.getElementById('topic-file').files[0];

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', desc);
    if (file) {
        formData.append('pdf_file', file);
    }

    const action = id ? 'update_topic' : 'create_topic';
    if(id) formData.append('id', id);

    try {
        const res = await fetch(`../api/instructor.php?action=${action}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if(data.success) {
            alert(id ? "Το θέμα ενημερώθηκε επιτυχώς!" : "Το θέμα δημιουργήθηκε επιτυχώς!");
            loadMyTopics();
        } else {
            alert("Σφάλμα: " + data.error);
        }
    } catch(err) {
        console.error(err);
        alert("System Error");
    }
}

// Διαγραφή
window.deleteTopic = async function(id) {
    if (!confirm("Είστε σίγουρος ότι θέλετε να διαγράψετε οριστικά αυτό το θέμα;")) {
        return;
    }

    const formData = new FormData();
    formData.append('id', id);

    try {
        const res = await fetch('../api/instructor.php?action=delete_topic', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if(data.success) {
            alert("Το θέμα διαγράφηκε.");
            loadMyTopics();
        } else {
            alert("Σφάλμα διαγραφής: " + (data.error || 'Άγνωστο σφάλμα'));
        }
    } catch(err) {
        console.error(err);
        alert("System Error");
    }
}


// =============================================================
// 2. ASSIGNMENT PAGE
// =============================================================

window.renderAssignmentPage = async function() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<h3>Φόρτωση δεδομένων ανάθεσης...</h3>';

    try {
        const resTopics = await fetch('../api/instructor.php?action=get_available_topics');
        const dataTopics = await resTopics.json();
        
        const resAll = await fetch('../api/instructor.php?action=list_my_topics');
        const dataAll = await resAll.json();
        
        const assignedTheses = (dataAll.data || []).filter(t => t.status === 'assigned' && t.first_name); 

        let optionsHtml = '<option value="">-- Επιλέξτε Θέμα --</option>';
        if(dataTopics.data && dataTopics.data.length > 0) {
            dataTopics.data.forEach(t => {
                optionsHtml += `<option value="${t.id}">${t.title}</option>`;
            });
        }

        mainContent.innerHTML = `
            <h2 class="section-title">Ανάθεση Θέματος</h2>
            
            <div style="display: flex; gap: 30px; margin-bottom: 40px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 300px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <h3 style="margin-top:0;">1. Νέα Ανάθεση</h3>
                    
                    <div class="form-group" style="margin-bottom:15px;">
                        <label style="font-weight:bold;">Επιλογή Διαθέσιμου Θέματος:</label>
                        <select id="assign-thesis-select" class="form-control" style="width:100%; padding: 10px; margin-top:5px;" onchange="checkAssignValidity()">
                            ${optionsHtml}
                        </select>
                    </div>

                    <div class="form-group" style="margin-top:20px;">
                        <label style="font-weight:bold;">Αναζήτηση Φοιτητή (Όνομα ή ΑΜ):</label>
                        <div style="display:flex; gap:10px; margin-top:5px;">
                            <input type="text" id="student-search-input" class="form-control" style="flex:1; padding:8px;" placeholder="π.χ. Παπαδόπουλος ή up1050">
                            <button onclick="searchStudent()" class="btn btn-secondary" style="padding:8px 15px;">
                                <i class="fas fa-search"></i>
                            </button>
                        </div>
                    </div>

                    <div id="search-results" style="margin-top: 15px; border: 1px solid #eee; max-height: 200px; overflow-y: auto; display:none; background:#fff;"></div>

                    <div id="selected-student-display" style="margin-top: 20px; padding: 10px; background: #e3f2fd; border-left: 4px solid #2196F3; display: none;">
                        <strong>Επιλεγμένος Φοιτητής:</strong> <span id="sel-student-name"></span>
                        <input type="hidden" id="sel-student-id">
                    </div>

                    <button onclick="submitAssignment()" class="btn btn-primary" style="margin-top: 20px; width: 100%; padding:10px;" disabled id="btn-submit-assign">
                        Οριστικοποίηση Ανάθεσης
                    </button>
                </div>

                <div style="flex: 1; min-width: 300px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <h3 style="margin-top:0;">2. Τρέχουσες Αναθέσεις</h3>
                    <p style="font-size: 13px; color: #666;">Θέματα που έχετε αναθέσει προσωρινά. Μπορείτε να κάνετε ακύρωση.</p>
                    <div id="active-assignments-list">
                        ${renderActiveAssignments(assignedTheses)}
                    </div>
                </div>
            </div>
        `;

    } catch (err) {
        console.error(err);
        mainContent.innerHTML = '<p style="color:red">Σφάλμα φόρτωσης σελίδας ανάθεσης.</p>';
    }
}

function renderActiveAssignments(list) {
    if (!list || list.length === 0) return '<p><em>Δεν υπάρχουν ενεργές αναθέσεις.</em></p>';
    
    return list.map(t => `
        <div style="border-bottom: 1px solid #eee; padding: 10px 0; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>${t.title}</strong><br>
                <small>Φοιτητής: ${t.first_name} ${t.last_name}</small>
            </div>
            <button onclick="revokeAssignment(${t.id})" class="btn" style="background: #dc3545; color: white; padding: 5px 10px; font-size: 12px; border:none; border-radius:3px; cursor:pointer;">
                <i class="fas fa-times"></i> Αναίρεση
            </button>
        </div>
    `).join('');
}

window.checkAssignValidity = function() {
    const thesisVal = document.getElementById('assign-thesis-select').value;
    const studentVal = document.getElementById('sel-student-id').value;
    const btn = document.getElementById('btn-submit-assign');
    
    if (thesisVal && studentVal) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
    } else {
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.style.cursor = "not-allowed";
    }
}

window.searchStudent = async function() {
    const term = document.getElementById('student-search-input').value;
    const resultsDiv = document.getElementById('search-results');
    
    if (term.length < 2) {
        alert("Παρακαλώ γράψτε τουλάχιστον 2 χαρακτήρες.");
        return;
    }

    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '<p style="padding:10px;">Αναζήτηση...</p>';

    try {
        const res = await fetch(`../api/instructor.php?action=search_student&term=${encodeURIComponent(term)}`);
        const data = await res.json();

        if (!data.data || data.data.length === 0) {
            resultsDiv.innerHTML = '<p style="padding:10px; color:red;">Δεν βρέθηκαν φοιτητές.</p>';
            return;
        }

        let html = '<ul style="list-style:none; padding:0; margin:0;">';
        data.data.forEach(s => {
            const am = s.student_am ? `(${s.student_am})` : '';
            html += `
                <li style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;" 
                    onmouseover="this.style.background='#f9f9f9'" 
                    onmouseout="this.style.background='white'"
                    onclick="selectStudent(${s.id}, '${s.first_name} ${s.last_name} ${am}')">
                    <i class="fas fa-user-graduate"></i> 
                    <strong>${s.last_name} ${s.first_name}</strong> ${am}
                    <br><small style="color:#777;">${s.email}</small>
                </li>
            `;
        });
        html += '</ul>';
        resultsDiv.innerHTML = html;

    } catch (err) {
        console.error(err);
        resultsDiv.innerHTML = '<p>Σφάλμα αναζήτησης.</p>';
    }
}

window.selectStudent = function(id, name) {
    document.getElementById('sel-student-id').value = id;
    document.getElementById('sel-student-name').textContent = name;
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('selected-student-display').style.display = 'block';
    checkAssignValidity();
}

window.submitAssignment = async function() {
    const thesisId = document.getElementById('assign-thesis-select').value;
    const studentId = document.getElementById('sel-student-id').value;

    if (!thesisId || !studentId) {
        alert("Παρακαλώ επιλέξτε Θέμα ΚΑΙ Φοιτητή.");
        return;
    }

    const formData = new FormData();
    formData.append('thesis_id', thesisId);
    formData.append('student_id', studentId);

    try {
        const res = await fetch('../api/instructor.php?action=assign_topic', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            alert("Η ανάθεση έγινε επιτυχώς!");
            renderAssignmentPage(); // Refresh
        } else {
            alert("Σφάλμα: " + data.error);
        }
    } catch (err) {
        console.error(err);
        alert("Σφάλμα συστήματος.");
    }
}

window.revokeAssignment = async function(thesisId) {
    if (!confirm("Είστε σίγουρος ότι θέλετε να ακυρώσετε την ανάθεση;")) {
        return;
    }

    const formData = new FormData();
    formData.append('thesis_id', thesisId);

    try {
        const res = await fetch('../api/instructor.php?action=revoke_assignment', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            alert("Η ανάθεση ακυρώθηκε.");
            loadMyTopics();
            if (document.querySelector('a[href="#assign"]').classList.contains('active')) {
                renderAssignmentPage();
            }
        } else {
            alert("Σφάλμα κατά την ακύρωση.");
        }
    } catch (err) {
        console.error(err);
        alert("Σφάλμα συστήματος.");
    }
}


// =============================================================
// 3. OTHER PAGES
// =============================================================
window.renderThesesListPage = function() {
    document.getElementById('main-content').innerHTML = '<h2>Λίστα Διπλωματικών</h2><p>Εδώ θα εμφανίζεται η πλήρης λίστα...</p>';
}

window.renderInvitesPage = function() {
    document.getElementById('main-content').innerHTML = '<h2>Προσκλήσεις Τριμελούς</h2><p>Διαχείριση προσκλήσεων...</p>';
}

window.renderStatsPage = async function() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<p>Loading stats...</p>';
    try {
        const res = await fetch('../api/instructor.php?action=get_stats');
        const data = await res.json();
        
        if(!data.success) {
            mainContent.innerHTML = '<p>Error loading stats.</p>';
            return;
        }

        const s = data.supervisor;
        const m = data.member;

        mainContent.innerHTML = `
            <h2 class="section-title">Στατιστικά</h2>
            <div style="display:flex; gap:20px;">
                <div style="flex:1; padding:20px; background:white; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                    <h3>Ως Επιβλέπων</h3>
                    <p>Πλήθος περατωμένων: <strong>${s.count}</strong></p>
                    <p>Μέσος Όρος Βαθμολογίας: <strong>${s.grade || '-'}</strong></p>
                </div>
            </div>
        `;
    } catch (err) {
        console.error(err);
        mainContent.innerHTML = '<p>System Error.</p>';
    }
}