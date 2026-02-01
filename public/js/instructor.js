// public/js/instructor.js

let currentTopics = []; 
let allThesesList = []; // For export

// Helper Functions for Translation
function getGreekStatus(status) {
    switch(status) {
        case 'available': return 'Διαθέσιμη';
        case 'assigned': return 'Υπό Ανάθεση';
        case 'active': return 'Ενεργή';
        case 'under_examination': return 'Υπό Εξέταση';
        case 'completed': return 'Περατωμένη';
        case 'cancelled': return 'Ακυρωμένη';
        case 'accepted': return 'Αποδέχθηκε';
        case 'rejected': return 'Απέρριψε';
        case 'pending': return 'Σε αναμονή';
        default: return status || '-';
    }
}

function getGreekRole(role) {
    if (role === 'supervisor') return 'Επιβλέπων';
    if (role === 'member') return 'Μέλος Τριμελούς';
    return role;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("Instructor App Loaded");

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

    loadMyTopics(); // Default view
});

// =============================================================
// 1. TOPICS MANAGEMENT (YOUR ORIGINAL LOGIC - KEPT)
// =============================================================

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
                <h2 class="section-title" style="margin:0; border:none; padding:0;">Θέματα προς Ανάθεση</h2>
                <button class="btn btn-primary" onclick="renderTopicForm()">
                    <i class="fas fa-plus"></i> Δημιουργία Νέου
                </button>
            </div>

            <div class="card" style="padding:0; overflow:hidden;">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Τίτλος</th>
                            <th>Κατάσταση</th>
                            <th>Ανατέθηκε σε</th>
                            <th>Ημ/νία</th>
                            <th>Αρχείο</th>
                            <th>Ενέργειες</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if(currentTopics.length === 0) {
            html += '<tr><td colspan="6" style="padding:30px; text-align:center; font-style:italic;">Δεν έχετε δημιουργήσει θέματα ακόμα.</td></tr>';
        } else {
            currentTopics.forEach(t => {
                const studentName = t.first_name ? `${t.first_name} ${t.last_name}` : '-';
                const statusGreek = getGreekStatus(t.status);
                
                // Status Logic for Colors
                let badgeColor = '#95a5a6'; // grey default
                if(t.status === 'assigned') badgeColor = '#3498db';
                else if(t.status === 'active') badgeColor = '#28a745';
                else if(t.status === 'completed') badgeColor = '#2ecc71';

                let statusBadge = `<span class="badge" style="background:${badgeColor}; color:white;">${statusGreek}</span>`;

                let fileLink = '-';
                if (t.file_path) {
                    fileLink = `<a href="../public/uploads/${t.file_path}" target="_blank" style="color:#3498db; text-decoration:none;"><i class="fas fa-paperclip"></i> PDF</a>`;
                }

                // Actions
                let actions = `
                    <button class="btn" onclick="renderTopicForm(${t.id})" title="Επεξεργασία" style="background-color: #fff; color: #34495e; border:1px solid #bdc3c7; padding:4px 8px; font-size:12px;">
                        <i class="fas fa-edit"></i>
                    </button>
                `;
                
                if (t.student_id) {
                    actions += `
                        <button class="btn" onclick="revokeAssignment(${t.id})" title="Αναίρεση" style="background-color: #fff; color: #e74c3c; border:1px solid #e74c3c; padding:4px 8px; font-size:12px; margin-left:5px;">
                            <i class="fas fa-user-slash"></i>
                        </button>
                    `;
                } else {
                    actions += `
                        <button class="btn" onclick="deleteTopic(${t.id})" title="Διαγραφή" style="background-color: #fff; color: #e74c3c; border:1px solid #e74c3c; padding:4px 8px; font-size:12px; margin-left:5px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                }

                html += `
                    <tr>
                        <td style="font-weight:600;">${t.title}</td>
                        <td>${statusBadge}</td>
                        <td>${studentName}</td>
                        <td>${new Date(t.created_at).toLocaleDateString()}</td>
                        <td>${fileLink}</td>
                        <td>${actions}</td>
                    </tr>
                `;
            });
        }

        html += `</tbody></table></div>`;
        mainContent.innerHTML = html;

    } catch(err) {
        console.error(err);
        mainContent.innerHTML = '<p>System Error.</p>';
    }
}

// B. FORM RENDERER
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

    let leftButtonHtml = '';
    if (id) {
        leftButtonHtml = `<button type="button" class="btn" style="background-color: #e74c3c; color:white;" onclick="deleteTopic(${id})"><i class="fas fa-trash"></i> Διαγραφή</button>`;
    } else {
        leftButtonHtml = `<button type="button" class="btn" style="background-color: #e74c3c; color:white;" onclick="loadMyTopics()"><i class="fas fa-times"></i> Ακύρωση</button>`;
    }

    mainContent.innerHTML = `
        <div class="modern-form-container">
            <div class="form-header">
                <h3>${titleText}</h3>
            </div>
            <div class="form-body">
                <form id="topic-form" onsubmit="submitTopic(event)">
                    <input type="hidden" id="edit-topic-id" value="${id || ''}">
                    
                    <div class="input-group">
                        <label>Τίτλος Θέματος</label>
                        <input type="text" id="topic-title" class="custom-input" value="${topic ? topic.title : ''}" required>
                    </div>

                    <div class="input-group">
                        <label>Περιγραφή</label>
                        <textarea id="topic-desc" class="custom-input" rows="4">${topic ? topic.description : ''}</textarea>
                    </div>

                    <div class="input-group">
                        <label>Επισύναψη Αρχείου (PDF)</label>
                        <input type="file" id="topic-file" class="custom-input" accept="application/pdf">
                    </div>

                    <div style="display:flex; justify-content:space-between; margin-top:20px;">
                        ${leftButtonHtml}
                        <button type="submit" class="btn btn-primary">${btnText}</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

window.submitTopic = async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit-topic-id').value;
    const formData = new FormData();
    formData.append('title', document.getElementById('topic-title').value);
    formData.append('description', document.getElementById('topic-desc').value);
    const file = document.getElementById('topic-file').files[0];
    if(file) formData.append('pdf_file', file);
    if(id) formData.append('id', id);

    const action = id ? 'update_topic' : 'create_topic';

    try {
        const res = await fetch(`../api/instructor.php?action=${action}`, { method: 'POST', body: formData });
        const data = await res.json();
        if(data.success) {
            alert(id ? "Το θέμα ενημερώθηκε!" : "Το θέμα δημιουργήθηκε!");
            loadMyTopics();
        } else {
            alert("Σφάλμα: " + data.error);
        }
    } catch(err) { console.error(err); alert("System Error"); }
}

window.deleteTopic = async function(id) {
    if (!confirm("Είστε σίγουρος για τη διαγραφή;")) return;
    const formData = new FormData(); formData.append('id', id);
    try {
        const res = await fetch('../api/instructor.php?action=delete_topic', { method: 'POST', body: formData });
        if((await res.json()).success) { alert("Διαγράφηκε."); loadMyTopics(); }
    } catch(err) { console.error(err); }
}

// =============================================================
// 2. ASSIGNMENT PAGE (YOUR ORIGINAL LOGIC - KEPT)
// =============================================================
window.renderAssignmentPage = async function() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<h3>Φόρτωση...</h3>';
    try {
        const resTopics = await fetch('../api/instructor.php?action=get_available_topics');
        const dataTopics = await resTopics.json();
        const resAll = await fetch('../api/instructor.php?action=list_my_topics&t='+Date.now());
        const dataAll = await resAll.json();
        const assignedTheses = (dataAll.data || []).filter(t => t.status === 'assigned' || t.status === 'under_assignment');

        let options = '<option value="">-- Επιλέξτε Θέμα --</option>';
        (dataTopics.data || []).forEach(t => options += `<option value="${t.id}">${t.title}</option>`);

        mainContent.innerHTML = `
            <h2 class="section-title">Ανάθεση σε Φοιτητή</h2>
            <div style="display:flex; gap:30px; flex-wrap:wrap;">
                <div class="card" style="flex:1; min-width:300px;">
                    <h3 style="margin-top:0;">Νέα Ανάθεση</h3>
                    <div class="input-group">
                        <label>Επιλογή Θέματος</label>
                        <select id="assign-thesis-select" class="custom-input" onchange="checkAssignValidity()">${options}</select>
                    </div>
                    
                    <div class="input-group" style="position:relative;">
                        <label>Αναζήτηση Φοιτητή</label>
                        <input type="text" id="student-search-input" class="custom-input" 
                               placeholder="Πληκτρολογήστε Όνομα ή ΑΜ..." 
                               autocomplete="off" 
                               oninput="searchStudent()">
                        <div id="search-results" style="position: absolute; top: 75px; left: 0; right: 0; background: white; border: 1px solid #ddd; z-index: 100; display: none;"></div>
                    </div>

                    <div id="selected-student-display" style="display:none; background:#e8f5e9; padding:10px; margin-bottom:15px;">
                        <strong>Επιλεγμένος Φοιτητής:</strong><br>
                        <span id="sel-student-name" style="color:#2e7d32;"></span>
                        <input type="hidden" id="sel-student-id">
                        <div style="text-align:right; margin-top:5px;">
                             <button class="btn" style="background:none; color:#c62828; padding:0; font-size:12px; text-decoration:underline;" onclick="clearStudentSelection()">Αλλαγή</button>
                        </div>
                    </div>
                    
                    <button id="btn-submit-assign" class="btn btn-primary" style="width:100%;" disabled onclick="submitAssignment()">Καταχώρηση Ανάθεσης</button>
                </div>
                
                <div class="card" style="flex:1; min-width:300px;">
                    <h3 style="margin-top:0;">Τρέχουσες Αναθέσεις</h3>
                    ${renderActiveAssignments(assignedTheses)}
                </div>
            </div>
        `;
    } catch(err) { console.error(err); }
}

function renderActiveAssignments(list) {
    if(!list.length) return '<p style="color:#777;">Καμία εκκρεμής ανάθεση.</p>';
    return list.map(t => `
        <div style="border-bottom:1px solid #eee; padding:10px 0; display:flex; justify-content:space-between; align-items:center;">
            <div><strong>${t.title}</strong><br><small>${t.first_name} ${t.last_name}</small></div>
            <button class="btn" style="background:#e74c3c; color:white; padding:5px 10px; font-size:12px;" onclick="revokeAssignment(${t.id})">Αναίρεση</button>
        </div>
    `).join('');
}

window.checkAssignValidity = function() {
    const t = document.getElementById('assign-thesis-select').value;
    const s = document.getElementById('sel-student-id').value;
    document.getElementById('btn-submit-assign').disabled = !(t && s);
}

window.searchStudent = async function() {
    const term = document.getElementById('student-search-input').value;
    const resultsDiv = document.getElementById('search-results');
    
    if(term.length < 2) { resultsDiv.style.display = 'none'; return; }

    try {
        const res = await fetch(`../api/instructor.php?action=search_student&term=${encodeURIComponent(term)}`);
        const data = await res.json();
        
        resultsDiv.style.display = 'block';
        if (!data.data || data.data.length === 0) { resultsDiv.innerHTML = '<div style="padding:10px;">Δεν βρέθηκαν αποτελέσματα</div>'; return; }

        resultsDiv.innerHTML = data.data.map(s => `
            <div style="padding:10px; cursor:pointer; border-bottom:1px solid #f0f0f0;" 
                 onclick="selectStudent(${s.id}, '${s.last_name} ${s.first_name}', '${s.student_am}')">
                <strong>${s.last_name} ${s.first_name}</strong> (${s.student_am || '-'})
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

window.selectStudent = function(id, name, am) {
    document.getElementById('sel-student-id').value = id;
    document.getElementById('sel-student-name').innerText = `${name} (${am})`;
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('selected-student-display').style.display = 'block';
    checkAssignValidity();
}

window.clearStudentSelection = function() {
    document.getElementById('sel-student-id').value = '';
    document.getElementById('selected-student-display').style.display = 'none';
    checkAssignValidity();
}

window.submitAssignment = async function() {
    const tid = document.getElementById('assign-thesis-select').value;
    const sid = document.getElementById('sel-student-id').value;
    const fd = new FormData(); fd.append('thesis_id', tid); fd.append('student_id', sid);
    await fetch('../api/instructor.php?action=assign_topic', {method:'POST', body:fd});
    alert('Επιτυχία!'); renderAssignmentPage();
}
window.revokeAssignment = async function(id) {
    if(!confirm('Σίγουρα;')) return;
    const fd = new FormData(); fd.append('thesis_id', id);
    await fetch('../api/instructor.php?action=revoke_assignment', {method:'POST', body:fd});
    renderAssignmentPage();
}

// =============================================================
// 3. LIST ALL THESES & DETAILS (FULL FEATURED + TRANSLATIONS)
// =============================================================
window.renderThesesListPage = function() {
    const mainContent = document.getElementById('main-content');
    
    // UPDATED: Small dropdowns, Cancelled status added, and Modal structure
    mainContent.innerHTML = `
        <h2 class="section-title">Λίστα Διπλωματικών</h2>
        <div style="background:white; padding:15px; border-radius:8px; display:flex; gap:15px; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.1); margin-bottom:20px;">
            <div>
                <label style="font-size:12px; font-weight:600; display:block;">Ρόλος:</label>
                <select id="filter-role" class="custom-input" style="padding:5px; width: 180px;" onchange="fetchThesesWithFilters()">
                    <option value="all">Όλοι</option>
                    <option value="supervisor">Επιβλέπων</option>
                    <option value="member">Μέλος</option>
                </select>
            </div>
            
            <div>
                <label style="font-size:12px; font-weight:600; display:block;">Κατάσταση:</label>
                <select id="filter-status" class="custom-input" style="padding:5px; width: 180px;" onchange="fetchThesesWithFilters()">
                    <option value="all">Όλες</option>
                    <option value="assigned">Υπό Ανάθεση</option>
                    <option value="active">Ενεργή</option>
                    <option value="completed">Περατωμένη</option>
                    <option value="cancelled">Ακυρωμένη</option>
                </select>
            </div>
            
            <div style="margin-left:auto;">
                <button class="btn btn-primary" onclick="exportData('csv')" style="padding:5px 15px; font-size:13px;">CSV</button>
                <button class="btn btn-primary" onclick="exportData('json')" style="padding:5px 15px; font-size:13px;">JSON</button>
            </div>
        </div>
        
        <div id="theses-list-container"></div>

        <div id="thesis-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999; align-items:center; justify-content:center;">
            <div style="background:white; width:700px; max-width:90%; padding:25px; border-radius:8px; max-height:85vh; overflow-y:auto; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
                    <h2 style="margin:0;">Λεπτομέρειες</h2>
                    <button onclick="closeModal()" style="border:none; background:none; font-size:24px; cursor:pointer;">&times;</button>
                </div>
                <div id="modal-content"></div>
            </div>
        </div>
    `;
    fetchThesesWithFilters();
}

window.fetchThesesWithFilters = async function() {
    const r = document.getElementById('filter-role').value;
    const s = document.getElementById('filter-status').value;
    const container = document.getElementById('theses-list-container');
    container.innerHTML = '<p>Φόρτωση...</p>';
    
    try {
        const res = await fetch(`../api/instructor.php?action=list_all_theses&role=${r}&status=${s}`);
        const data = await res.json();
        allThesesList = data.data; 

        if(!allThesesList || allThesesList.length === 0) { 
            container.innerHTML = '<div style="padding:20px; background:white; text-align:center;">Δεν βρέθηκαν αποτελέσματα.</div>'; 
            return; 
        }

        let html = `<div class="card" style="padding:0; overflow:hidden;"><table class="table">
            <thead><tr><th>Τίτλος</th><th>Φοιτητής</th><th>Ρόλος</th><th>Κατάσταση</th><th></th></tr></thead><tbody>`;
        
        allThesesList.forEach(t => {
            // Apply Translation here
            const roleGreek = getGreekRole(t.my_role);
            const statusGreek = getGreekStatus(t.status);
            
            // Color Badge for Role
            const roleColor = t.my_role === 'supervisor' ? '#2c3e50' : '#95a5a6';

            html += `<tr>
                <td style="font-weight:600;">${t.title}</td>
                <td>${t.student_surname || '-'} ${t.student_name || ''}</td>
                <td><span class="badge" style="background:${roleColor}; color:white;">${roleGreek}</span></td>
                <td>${statusGreek}</td>
                <td><button class="btn btn-primary" style="padding:5px 10px; font-size:12px;" onclick="openThesisModal(${t.id})">Προβολή</button></td>
            </tr>`;
        });
        container.innerHTML = html + '</tbody></table></div>';
    } catch(e) { console.error(e); container.innerHTML = 'Error loading list.'; }
}

// THIS FIXES THE "CAN'T SEE ANYTHING" BUG AND MATCHES YOUR DB COLUMNS
window.openThesisModal = async function(id) {
    document.getElementById('thesis-modal').style.display = 'flex';
    const c = document.getElementById('modal-content');
    c.innerHTML = 'Loading...';
    
    try {
        const res = await fetch(`../api/instructor.php?action=get_thesis_details&id=${id}`);
        const d = await res.json();
        const t = d.thesis;
        
        // Committee List
        let commHtml = '<p style="color:#777; font-style:italic;">Δεν έχουν οριστεί ακόμα.</p>';
        if(d.committee && d.committee.length > 0) {
            commHtml = '<ul style="list-style:none; padding:0;">' + 
            d.committee.map(m => `
                <li style="padding:5px 0; border-bottom:1px solid #f0f0f0;">
                    ${m.first_name} ${m.last_name}: 
                    <strong style="color:${m.invitation_status==='accepted'?'green':(m.invitation_status==='rejected'?'red':'orange')}">${getGreekStatus(m.invitation_status)}</strong>
                </li>
            `).join('') + '</ul>';
        }
        
        // Logs List (Using 'action' and 'timestamp' as per your DB)
        let logsHtml = '<p style="color:#777;">Κανένα ιστορικό.</p>';
        if(d.logs && d.logs.length > 0) {
            logsHtml = '<ul style="font-size:0.9em; color:#555; max-height:150px; overflow-y:auto;">' + 
            d.logs.map(l => `<li><strong>${l.timestamp}:</strong> ${l.action}</li>`).join('') + '</ul>';
        }

        // Final Info (Repository Link & Grade & Minutes)
        let finalInfo = '';
        if (t.status === 'completed' || t.status === 'under_examination') {
            finalInfo = `
                <div style="background:#e8f5e9; padding:15px; border-radius:5px; margin-top:20px;">
                    <h4 style="margin-top:0;">Ολοκλήρωση</h4>
                    <p><strong>Τελικός Βαθμός:</strong> ${t.final_grade || 'Δεν καταχωρήθηκε'}</p>
                    <p><strong>Σύνδεσμος Νημερτής:</strong> ${t.repository_link ? `<a href="${t.repository_link}" target="_blank">Άνοιγμα Συνδέσμου</a>` : 'Δεν καταχωρήθηκε'}</p>
                    <button class="btn" style="background:#333; color:white; font-size:12px; margin-top:5px;" onclick="alert('Προβολή Πρακτικού (PDF)')">
                        <i class="fas fa-file-pdf"></i> Προβολή Πρακτικού Βαθμολόγησης
                    </button>
                </div>
            `;
        }
        
        c.innerHTML = `
            <h3 style="color:#2c3e50; margin-top:0;">${t.title}</h3>
            <p><strong>Φοιτητής:</strong> ${t.student_first} ${t.student_last} (<a href="mailto:${t.student_email}">${t.student_email}</a>)</p>
            <p><strong>Επιβλέπων:</strong> ${t.sup_first} ${t.sup_last}</p>
            <p><strong>Κατάσταση:</strong> ${getGreekStatus(t.status)}</p>
            <p style="background:#f9f9f9; padding:10px; border-radius:4px;">${t.description}</p>
            
            ${finalInfo}

            <h4 style="border-bottom:2px solid #3498db; padding-bottom:5px; color:#3498db; margin-top:20px;">Τριμελής Επιτροπή</h4>
            ${commHtml}
            
            <h4 style="border-bottom:2px solid #3498db; padding-bottom:5px; color:#3498db; margin-top:20px;">Ιστορικό</h4>
            ${logsHtml}
        `;
    } catch(e) { console.error(e); }
}

window.closeModal = function() { document.getElementById('thesis-modal').style.display = 'none'; }

window.exportData = function(fmt) {
    if(!allThesesList.length) return alert('Empty');
    let content = (fmt==='json') ? JSON.stringify(allThesesList) : "ID,Title\n" + allThesesList.map(r=>`${r.id},${r.title}`).join('\n');
    const blob = new Blob([content],{type:'text/plain'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='export.'+fmt; a.click();
}

// =============================================================
// 4. INVITES (ADDED NEW LOGIC)
// =============================================================
window.renderInvitesPage = async function() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = 'Loading...';
    
    try {
        const res = await fetch('../api/instructor.php?action=list_pending_invites');
        const data = await res.json();
        
        if(!data.data || data.data.length === 0) { 
            mainContent.innerHTML = '<h2>Προσκλήσεις</h2><p>Καμία εκκρεμότητα.</p>'; return; 
        }
        
        let html = `<h2>Εισερχόμενες Προσκλήσεις</h2>`;
        data.data.forEach(inv => {
            html += `
                <div class="card" style="margin-bottom:15px; border-left:5px solid #3498db; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h4 style="margin:0;">${inv.title}</h4>
                        <p style="margin:5px 0;">Φοιτητής: ${inv.first_name} ${inv.last_name}</p>
                    </div>
                    <div>
                        <button class="btn btn-primary" style="margin-right:5px; background:green;" onclick="respondInvite(${inv.invite_id}, 'accepted')">Αποδοχή</button>
                        <button class="btn" style="background:red; color:white;" onclick="respondInvite(${inv.invite_id}, 'rejected')">Απόρριψη</button>
                    </div>
                </div>
            `;
        });
        mainContent.innerHTML = html;
    } catch(e) { console.error(e); }
}

window.respondInvite = async function(id, resp) {
    if(!confirm('Are you sure?')) return;
    const fd = new FormData(); fd.append('invite_id', id); fd.append('response', resp);
    await fetch('../api/instructor.php?action=respond_invite', {method:'POST', body:fd});
    alert('Done'); renderInvitesPage();
}

// 5. STATS
window.renderStatsPage = async () => {
    const res = await fetch('../api/instructor.php?action=get_stats');
    const data = await res.json();
    const s = data.supervisor;
    document.getElementById('main-content').innerHTML = `
        <h2 class="section-title">Στατιστικά</h2>
        <div class="card" style="max-width:400px;">
            <h3>Ως Επιβλέπων</h3>
            <p>Σύνολο: ${s.count}</p>
            <p>Μ.Ο. Βαθμών: ${s.grade}</p>
        </div>
    `;
}