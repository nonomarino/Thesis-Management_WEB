// public/js/instructor.js

let currentTopics = []; 

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

    loadMyTopics();
});

// =============================================================
// 1. TOPICS MANAGEMENT (TABLE & FORM)
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
                
                // Status Logic
                let statusBadge = '';
                if(t.status === 'assigned') statusBadge = '<span class="badge" style="background:#3498db; color:white;">Υπό ανάθεση</span>';
                else if(t.status === 'active') statusBadge = '<span class="badge" style="background:#28a745; color:white;">Ενεργή</span>';
                else if(t.status === 'completed') statusBadge = '<span class="badge" style="background:#2ecc71; color:white;">Ολοκληρωμένη</span>';
                else statusBadge = '<span class="badge" style="background:#95a5a6; color:white;">Ελεύθερο</span>';

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

// B. FORM RENDERER (COMPACT & SMOOTH)
window.renderTopicForm = function(id = null) {
    const mainContent = document.getElementById('main-content');
    
    let topic = null;
    let titleText = 'Δημιουργία Νέου Θέματος';
    let subtitleText = 'Συμπληρώστε τα στοιχεία.';
    let btnText = 'Δημιουργία';
    
    if (id) {
        topic = currentTopics.find(t => t.id == id);
        if (topic) {
            titleText = 'Επεξεργασία Θέματος';
            subtitleText = 'Τροποποίηση στοιχείων.';
            btnText = 'Ενημέρωση';
        }
    }

    // Buttons Setup
    const btnStyleCommon = "color:white !important; width: 140px; justify-content: center;";
    const redStyle = `background-color: #e74c3c !important; ${btnStyleCommon}`;
    const greenStyle = `background-color: #27ae60 !important; ${btnStyleCommon}`;

    let leftButtonHtml = '';
    if (id) {
        leftButtonHtml = `<button type="button" class="btn" style="${redStyle}" onclick="deleteTopic(${id})"><i class="fas fa-trash"></i> Διαγραφή</button>`;
    } else {
        leftButtonHtml = `<button type="button" class="btn" style="${redStyle}" onclick="loadMyTopics()"><i class="fas fa-times"></i> Ακύρωση</button>`;
    }

    let rightButtonHtml = `<button type="submit" class="btn" style="${greenStyle}"><i class="fas fa-save"></i> ${btnText}</button>`;

    mainContent.innerHTML = `
        <div class="modern-form-container">
            <div class="form-header">
                <h3>${titleText}</h3>
                <p>${subtitleText}</p>
            </div>

            <div class="form-body">
                <form id="topic-form" onsubmit="submitTopic(event)">
                    <input type="hidden" id="edit-topic-id" value="${id || ''}">
                    
                    <div class="input-group">
                        <label>Τίτλος Θέματος</label>
                        <input type="text" id="topic-title" class="custom-input" 
                               value="${topic ? topic.title : ''}" required placeholder="Τίτλος...">
                        <i class="fas fa-heading"></i>
                    </div>

                    <div class="input-group">
                        <label>Περιγραφή</label>
                        <textarea id="topic-desc" class="custom-input" rows="4"
                                  style="resize: none; padding-top:10px;" 
                                  placeholder="Περιγραφή...">${topic ? topic.description : ''}</textarea>
                        <i class="fas fa-align-left"></i>
                    </div>

                    <div class="input-group">
                        <label>Επισύναψη Αρχείου (PDF)</label>
                        <input type="file" id="topic-file" class="custom-input" accept="application/pdf">
                        <i class="fas fa-file-pdf"></i>
                        ${topic && topic.file_path ? `<div style="margin-top:5px; font-size:12px; color:#3498db;"><i class="fas fa-check-circle"></i> Υπάρχει αρχείο: ${topic.file_path}</div>` : ''}
                    </div>

                    <div style="display:flex; justify-content:space-between; margin-top:30px; border-top:1px solid #eee; padding-top:20px;">
                        ${leftButtonHtml}
                        ${rightButtonHtml}
                    </div>
                </form>
            </div>
        </div>
    `;
}

// -------------------------------------------------------------
// HELPER FUNCTIONS
// -------------------------------------------------------------

window.submitTopic = async function(e) {
    e.preventDefault();
    const id = document.getElementById('edit-topic-id').value;
    const title = document.getElementById('topic-title').value;
    const desc = document.getElementById('topic-desc').value;
    const file = document.getElementById('topic-file').files[0];

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', desc);
    if (file) formData.append('pdf_file', file);
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

// ASSIGNMENT PAGE
window.renderAssignmentPage = async function() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '<h3>Φόρτωση...</h3>';
    try {
        const resTopics = await fetch('../api/instructor.php?action=get_available_topics');
        const dataTopics = await resTopics.json();
        const resAll = await fetch('../api/instructor.php?action=list_my_topics&t='+Date.now());
        const dataAll = await resAll.json();
        const assignedTheses = (dataAll.data || []).filter(t => t.status === 'assigned');

        let options = '<option value="">-- Επιλέξτε Θέμα --</option>';
        (dataTopics.data || []).forEach(t => options += `<option value="${t.id}">${t.title}</option>`);

        // --- Live Search Implementation ---
        // oninput="searchStudent()" triggers the search on every keystroke
        // autocomplete="off" prevents browser history from blocking the view
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
                        <div id="search-results" style="
                            position: absolute;
                            top: 75px; /* Adjust based on label + input height */
                            left: 0;
                            right: 0;
                            background: white;
                            border: 1px solid #ddd;
                            border-radius: 0 0 8px 8px;
                            max-height: 200px;
                            overflow-y: auto;
                            z-index: 100;
                            display: none;
                            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        "></div>
                    </div>

                    <div id="selected-student-display" style="display:none; background:#e8f5e9; padding:10px; border-radius:5px; margin-bottom:15px; border:1px solid #c8e6c9;">
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

// --- LIVE SEARCH LOGIC ---
window.searchStudent = async function() {
    const term = document.getElementById('student-search-input').value;
    const resultsDiv = document.getElementById('search-results');
    
    // Clear results if input is empty or too short
    if(term.length < 2) {
         resultsDiv.style.display = 'none';
         resultsDiv.innerHTML = '';
         return;
    }

    try {
        const res = await fetch(`../api/instructor.php?action=search_student&term=${encodeURIComponent(term)}`);
        const data = await res.json();
        
        resultsDiv.style.display = 'block';
        
        if (!data.data || data.data.length === 0) {
            resultsDiv.innerHTML = '<div style="padding:10px; color:#777; font-style:italic;">Δεν βρέθηκαν αποτελέσματα</div>';
            return;
        }

        // Render List Items
        resultsDiv.innerHTML = data.data.map(s => `
            <div style="padding:10px; cursor:pointer; border-bottom:1px solid #f0f0f0; transition:background 0.2s;" 
                 onmouseover="this.style.background='#f9f9f9'" 
                 onmouseout="this.style.background='white'"
                 onclick="selectStudent(${s.id}, '${s.last_name} ${s.first_name}', '${s.student_am}')">
                <i class="fas fa-user-graduate" style="color:#3498db; margin-right:8px;"></i>
                <strong>${s.last_name} ${s.first_name}</strong> 
                <span style="color:#666; font-size:13px;">(${s.student_am || 'Χωρίς ΑΜ'})</span>
            </div>
        `).join('');

    } catch (err) {
        console.error(err);
    }
}

window.selectStudent = function(id, name, am) {
    document.getElementById('sel-student-id').value = id;
    document.getElementById('sel-student-name').innerText = `${name} (${am})`;
    
    // Hide Search UI
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('student-search-input').value = ''; // Clear input
    document.getElementById('student-search-input').closest('.input-group').style.display = 'none'; // Hide input container
    
    // Show Selection
    document.getElementById('selected-student-display').style.display = 'block';
    
    checkAssignValidity();
}

window.clearStudentSelection = function() {
    document.getElementById('sel-student-id').value = '';
    document.getElementById('selected-student-display').style.display = 'none';
    
    // Show Input again
    const inputGroup = document.getElementById('student-search-input').closest('.input-group');
    inputGroup.style.display = 'block';
    document.getElementById('student-search-input').focus();
    
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

// 3. OTHER PAGES
window.renderThesesListPage = () => document.getElementById('main-content').innerHTML = '<h2>Λίστα</h2><p>Coming soon...</p>';
window.renderInvitesPage = () => document.getElementById('main-content').innerHTML = '<h2>Προσκλήσεις</h2><p>Coming soon...</p>';
window.renderStatsPage = async () => {
    const res = await fetch('../api/instructor.php?action=get_stats');
    const data = await res.json();
    const s = data.supervisor;
    document.getElementById('main-content').innerHTML = `
        <h2 class="section-title">Στατιστικά</h2>
        <div class="card">
            <h3>Ως Επιβλέπων</h3>
            <p>Σύνολο: ${s.count}</p>
            <p>Μ.Ο. Βαθμών: ${s.grade}</p>
        </div>
    `;
}