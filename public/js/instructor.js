let currentTopics = []; 
let allThesesList = []; 

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

    loadMyTopics(); 
});

// 1. TOPICS MANAGEMENT (HOME TAB)

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
                            <th>Ημ/νία Ανάθεσης</th> <th>Ενέργειες</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if(currentTopics.length === 0) {
            html += '<tr><td colspan="5" style="padding:30px; text-align:center; font-style:italic;">Δεν έχετε δημιουργήσει θέματα ακόμα.</td></tr>';
        } else {
            currentTopics.forEach(t => {
                const studentName = t.first_name ? `${t.first_name} ${t.last_name}` : '-';
                const statusGreek = getGreekStatus(t.status);
                
                // Υπολογισμός Χρόνου για τα 2 έτη
                let createdDate = new Date(t.created_at);
                let displayDate = createdDate.toLocaleDateString();
                let canCancelActive = false;

                // Αν είναι active, ελέγχουμε το assigned_at
                
                // Υποθέτουμε ότι το assigned_at υπάρχει στα data
                if (t.status === 'active' && t.created_at) {
                     // Logic correction: Check date diff
                     const assignDateObj = new Date(t.created_at); 
                     const now = new Date();
                     const diffTime = Math.abs(now - assignDateObj);
                     const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);
                     if (diffYears >= 2) canCancelActive = true;
                }

                let badgeColor = '#95a5a6'; 
                if(t.status === 'assigned') badgeColor = '#3498db';
                else if(t.status === 'active') badgeColor = '#28a745';
                else if(t.status === 'under_examination') badgeColor = '#f39c12';
                else if(t.status === 'completed') badgeColor = '#2ecc71';

                const statusBadge = `<span class="badge" style="background:${badgeColor}; color:white;">${statusGreek}</span>`;

                let actions = `
                    <button class="btn" onclick="renderTopicForm(${t.id})" title="Επεξεργασία" style="background-color: #fff; color: #34495e; border:1px solid #bdc3c7; padding:4px 8px; font-size:12px;">
                        <i class="fas fa-edit"></i>
                    </button>
                `;
                
                if (t.student_id && t.status === 'assigned') {
                    actions += `
                        <button class="btn" onclick="revokeAssignment(${t.id})" title="Αναίρεση Ανάθεσης" style="background-color: #fff; color: #e74c3c; border:1px solid #e74c3c; padding:4px 8px; font-size:12px; margin-left:5px;">
                            <i class="fas fa-user-slash"></i>
                        </button>
                    `;
                } else if (!t.student_id) {
                    actions += `
                        <button class="btn" onclick="deleteTopic(${t.id})" title="Διαγραφή" style="background-color: #fff; color: #e74c3c; border:1px solid #e74c3c; padding:4px 8px; font-size:12px; margin-left:5px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                }

                // Promote to Exam 
                if (t.status === 'active') {
                    actions += `
                        <button class="btn" onclick="promoteToExam(${t.id})" title="Αλλαγή σε 'Υπό Εξέταση'" style="background-color: #fef9e7; color: #f39c12; border:1px solid #f39c12; padding:4px 8px; font-size:12px; margin-left:5px;">
                            <i class="fas fa-step-forward"></i>
                        </button>
                    `;
                }

                // Cancel Active Assignment (2 Years) 
                if (t.status === 'active' && canCancelActive) {
                    actions += `
                        <button class="btn" onclick="cancelActiveAssignment(${t.id})" title="Ακύρωση Ανάθεσης (Λόγω 2ετίας)" style="background-color: #fff5f5; color: #c0392b; border:1px solid #c0392b; padding:4px 8px; font-size:12px; margin-left:5px;">
                            <i class="fas fa-ban"></i> 2Έτη
                        </button>
                    `;
                }

                if (t.status === 'under_examination') {
                    actions += `
                        <button class="btn" onclick="renderSupervisorReviewPage(${t.id})" title="Επισκόπηση" style="background-color: #e3f2fd; color: #2196f3; border:1px solid #2196f3; padding:4px 8px; font-size:12px; margin-left:5px;">
                            <i class="fas fa-eye"></i>
                        </button>
                    `;
                }

                html += `
                    <tr>
                        <td style="font-weight:600;">${t.title}</td>
                        <td>${statusBadge}</td>
                        <td>${studentName}</td>
                        <td>${displayDate}</td>
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

window.cancelActiveAssignment = async function(id) {
    if(!confirm("ΠΡΟΣΟΧΗ: Η ανάθεση θα ακυρωθεί οριστικά λόγω παρέλευσης 2ετίας.\nΕίστε σίγουροι;")) return;

    // Ζητάμε τα στοιχεία ΓΣ με απλά prompts
    const gaNum = prompt("Παρακαλώ εισάγετε τον Αριθμό της Γενικής Συνέλευσης:");
    if(!gaNum) return; // User cancelled

    const gaYear = prompt("Παρακαλώ εισάγετε το Έτος της Γενικής Συνέλευσης (π.χ. 2024):");
    if(!gaYear) return; // User cancelled

    const formData = new FormData();
    formData.append('thesis_id', id);
    formData.append('ga_num', gaNum);
    formData.append('ga_year', gaYear);

    try {
        const res = await fetch('../api/instructor.php?action=cancel_active_assignment', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (data.success) {
            alert("Η ανάθεση ακυρώθηκε επιτυχώς. Το θέμα είναι πλέον διαθέσιμο.");
            loadMyTopics();
        } else {
            alert("Σφάλμα: " + data.error);
        }
    } catch (err) {
        console.error(err);
        alert("System Error");
    }
}
// Promote to Under Examination
window.promoteToExam = async function(id) {
    if(!confirm("Να αλλάξει η κατάσταση σε 'Υπό Εξέταση'; Αυτό θα επιτρέψει στον φοιτητή να αναρτήσει το υλικό.")) return;
    
    const formData = new FormData();
    formData.append('thesis_id', id);
    
    try {
        const res = await fetch('../api/instructor.php?action=promote_to_exam', { method: 'POST', body: formData });
        const data = await res.json();
        if(data.success) {
            alert("Η κατάσταση άλλαξε επιτυχώς!");
            loadMyTopics();
        } else {
            alert("Σφάλμα: " + data.error);
        }
    } catch(err) { console.error(err); alert("System Error"); }
}

//Supervisor review page with announcement generator 

window.renderSupervisorReviewPage = function(id) {
    const topic = currentTopics.find(t => t.id == id);
    if (!topic) return;

    const mainContent = document.getElementById('main-content');

    let examInfoHtml = '<p style="color:#777;">Δεν έχει οριστεί ημερομηνία εξέτασης.</p>';
    let canGenerateAnnouncement = false;

    if (topic.exam_date) {
        canGenerateAnnouncement = true;
        const dt = new Date(topic.exam_date).toLocaleString('el-GR', { 
            dateStyle: 'full', timeStyle: 'short', hour12: false 
        });
        const method = topic.exam_method === 'online' ? 'Διαδικτυακά' : 'Δια ζώσης';
        examInfoHtml = `
            <div style="font-size:15px; margin-top:10px;">
                <div style="margin-bottom:8px;"><strong>📅 Ημερομηνία:</strong> ${dt}</div>
                <div style="margin-bottom:8px;"><strong>📍 Τρόπος:</strong> ${method}</div>
                <div><strong>🏫 Τοποθεσία/Link:</strong> ${topic.exam_location || '-'}</div>
            </div>
        `;
    }

    let draftHtml = '<p style="color:#777; font-style:italic;">Δεν έχει αναρτηθεί πρόχειρο κείμενο.</p>';
    if (topic.draft_file_path) {
        draftHtml = `
            <a href="../public/uploads/${topic.draft_file_path}" target="_blank" style="display:flex; align-items:center; gap:10px; padding:15px; background:#f8f9fa; border:1px solid #dee2e6; border-radius:5px; text-decoration:none; color:#2c3e50; font-weight:600; transition:all 0.2s;">
                <i class="fas fa-file-pdf" style="font-size:24px; color:#e74c3c;"></i>
                <span>Προβολή Πρόχειρου Κειμένου (Draft)</span>
            </a>
        `;
    }

    let linksHtml = '<p style="color:#777;">Δεν υπάρχουν σύνδεσμοι.</p>';
    if (topic.external_links) {
        linksHtml = `<div style="background:#f9f9f9; padding:15px; border-radius:5px; border:1px solid #eee; white-space:pre-wrap; font-family:monospace;">${topic.external_links}</div>`;
    }

    let announceBtnHtml = '';
    if(canGenerateAnnouncement) {
        announceBtnHtml = `
            <div style="text-align:right; margin-top:20px; border-top:1px solid #eee; padding-top:15px;">
                <button class="btn btn-primary" onclick="generateAnnouncement(${id})">
                    <i class="fas fa-bullhorn"></i> Παραγωγή Ανακοίνωσης
                </button>
            </div>
        `;
    }

    mainContent.innerHTML = `
        <button class="btn" style="background:#ecf0f1; color:#2c3e50; margin-bottom:20px;" onclick="loadMyTopics()">
            <i class="fas fa-arrow-left"></i> Πίσω στη Λίστα
        </button>

        <h2 class="section-title">Επισκόπηση Υλικού Εξέτασης</h2>
        <p style="font-size:16px; margin-bottom:30px;">Θέμα: <strong>${topic.title}</strong> | Φοιτητής: ${topic.first_name} ${topic.last_name}</p>

        <div style="display:flex; gap:30px; flex-wrap:wrap;">
            
            <div class="card" style="flex:1; min-width:300px; border-top:4px solid #3498db;">
                <h3 style="margin-top:0; color:#2c3e50; border-bottom:1px solid #eee; padding-bottom:10px;">
                    <i class="fas fa-calendar-alt"></i> Στοιχεία Παρουσίασης
                </h3>
                ${examInfoHtml}
                ${announceBtnHtml}
            </div>

            <div class="card" style="flex:1.5; min-width:300px; border-top:4px solid #27ae60;">
                <h3 style="margin-top:0; color:#2c3e50; border-bottom:1px solid #eee; padding-bottom:10px;">
                    <i class="fas fa-folder-open"></i> Υλικό Φοιτητή
                </h3>
                
                <div style="margin-bottom:25px;">
                    <h4 style="font-size:14px; color:#7f8c8d; text-transform:uppercase;">1. Αρχείο Κειμένου</h4>
                    ${draftHtml}
                </div>

                <div>
                    <h4 style="font-size:14px; color:#7f8c8d; text-transform:uppercase;">2. Συνοδευτικό Υλικό (Links)</h4>
                    ${linksHtml}
                </div>
            </div>
        </div>
        
        <div id="announce-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
            <div style="background:white; width:600px; max-width:90%; padding:25px; border-radius:8px; box-shadow:0 5px 20px rgba(0,0,0,0.3);">
                <h3 style="margin-top:0;">Κείμενο Ανακοίνωσης</h3>
                <textarea id="announce-text" style="width:100%; height:200px; font-family:monospace; padding:10px; border:1px solid #ccc; border-radius:5px;" readonly></textarea>
                <div style="text-align:right; margin-top:15px; display:flex; justify-content:flex-end; gap:10px;">
                    <button class="btn btn-secondary" onclick="document.getElementById('announce-modal').style.display='none'">Κλείσιμο</button>
                    <button class="btn btn-primary" onclick="copyAnnouncement()"><i class="fas fa-copy"></i> Αντιγραφή</button>
                </div>
            </div>
        </div>
    `;
}

window.generateAnnouncement = async function(id) {
    try {
        const res = await fetch(`../api/instructor.php?action=get_thesis_details&id=${id}`);
        const data = await res.json();
        
        if(!data.success) { alert("Error fetching details"); return; }
        
        const t = data.thesis;
        const committee = data.committee || [];
        
        let membersStr = `${t.sup_first} ${t.sup_last} (Επιβλέπων)`;
        committee.forEach(m => {
            if(m.invitation_status === 'accepted') {
                membersStr += `, ${m.first_name} ${m.last_name}`;
            }
        });

        const dt = new Date(t.exam_date).toLocaleString('el-GR', { dateStyle: 'full', timeStyle: 'short' });
        const method = t.exam_method === 'online' ? 'Διαδικτυακά' : 'Δια ζώσης';

        const text = 
`ΠΑΡΟΥΣΙΑΣΗ ΔΙΠΛΩΜΑΤΙΚΗΣ ΕΡΓΑΣΙΑΣ

Ονοματεπώνυμο Φοιτητή: ${t.student_first} ${t.student_last}
Θέμα: ${t.title}

Τριμελής Επιτροπή:
${membersStr}

Ημερομηνία: ${dt}
Τρόπος Εξέτασης: ${method}
Τοποθεσία / Σύνδεσμος: ${t.exam_location}

Περίληψη:
${t.description}
`;

        document.getElementById('announce-text').value = text;
        document.getElementById('announce-modal').style.display = 'flex';

    } catch(e) { console.error(e); alert("System Error"); }
}

window.copyAnnouncement = function() {
    const copyText = document.getElementById("announce-text");
    copyText.select();
    copyText.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(copyText.value);
    alert("Το κείμενο αντιγράφηκε!");
}

//Form renderer
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

//assignement page
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

//LIST ALL THESES & DETAILS
window.renderThesesListPage = function() {
    const mainContent = document.getElementById('main-content');
    
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
            const roleGreek = getGreekRole(t.my_role);
            const statusGreek = getGreekStatus(t.status);
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

window.openThesisModal = async function(id) {
    document.getElementById('thesis-modal').style.display = 'flex';
    const c = document.getElementById('modal-content');
    c.innerHTML = 'Loading...';
    
    try {
        const res = await fetch(`../api/instructor.php?action=get_thesis_details&id=${id}`);
        const d = await res.json();
        const t = d.thesis;
        
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
        
        let logsHtml = '<p style="color:#777;">Κανένα ιστορικό.</p>';
        if(d.logs && d.logs.length > 0) {
            logsHtml = '<ul style="font-size:0.9em; color:#555; max-height:150px; overflow-y:auto;">' + 
            d.logs.map(l => `<li><strong>${l.timestamp}:</strong> ${l.action}</li>`).join('') + '</ul>';
        }

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
        
        //START GRADING
        const myId = d.current_user_id; 
        const isSupervisor = (t.supervisor_id == myId);
        let gradingHtml = '';

        // 1. If Active & Supervisor -> Show Enable Button
        if (t.status === 'active' && isSupervisor) {
            gradingHtml = `
                <div style="background:#fff3cd; padding:15px; border-radius:5px; margin-top:20px; border:1px solid #ffeeba;">
                    <h4 style="margin-top:0;">Ενέργειες Επιβλέποντα</h4>
                    <p>Η διπλωματική είναι Ενεργή. Μπορείτε να ενεργοποιήσετε τη βαθμολόγηση.</p>
                    <button class="btn btn-primary" onclick="enableGrading(${t.id})">Ενεργοποίηση Βαθμολόγησης</button>
                </div>
            `;
        }

        // 2. If Under Exam or Completed -> Show Grades & Form
        if (t.status === 'under_examination' || t.status === 'completed') {
            
            // List existing grades
            let gradesList = '<ul style="margin-top:10px;">';
            if (d.grades && d.grades.length > 0) {
                d.grades.forEach(g => {
                    gradesList += `<li>${g.first_name} ${g.last_name}: <strong>${g.grade}</strong> <small style="color:#777;">(${g.submitted_at})</small></li>`;
                });
            } else {
                gradesList += '<li>Κανένας βαθμός ακόμα.</li>';
            }
            gradesList += '</ul>';

            // My Grading Form (only if under exam)
            let inputForm = '';
            if (t.status === 'under_examination') {
                // Find if I already graded
                const myGradeEntry = (d.grades || []).find(g => g.prof_id == myId);
                const myGradeVal = myGradeEntry ? myGradeEntry.grade : '';

                inputForm = `
                    <div style="margin-top:15px; border-top:1px solid #ddd; padding-top:10px;">
                        <label><strong>Η Βαθμολογία μου (0-10):</strong></label>
                        <div style="display:flex; gap:10px; align-items:center; margin-top:5px;">
                            <input type="number" id="grade-input" class="custom-input" style="width:100px;" step="0.5" min="0" max="10" value="${myGradeVal}">
                            <button class="btn btn-primary" style="background:#28a745;" onclick="submitGrade(${t.id})">Καταχώρηση</button>
                        </div>
                        <small style="color:#666;">Αναλυτικά βάσει κριτηρίων ΤΜΗΥΠ.</small>
                    </div>
                `;
            }

            gradingHtml = `
                <div style="background:#e8f5e9; padding:15px; border-radius:5px; margin-top:20px; border:1px solid #c3e6cb;">
                    <h4 style="margin-top:0;">Βαθμολογία Τριμελούς</h4>
                    ${gradesList}
                    ${inputForm}
                </div>
            `;
        }
        

       c.innerHTML = `
            <h3 style="color:#2c3e50; margin-top:0;">${t.title}</h3>
            
            <div style="background:#f8f9fa; padding:15px; border-radius:5px; margin-bottom:15px;">
                <p><strong>Φοιτητής:</strong> ${t.first_name || '-'} ${t.last_name || ''} (<a href="mailto:${t.student_email}">${t.student_email || '-'}</a>)</p>
                <p><strong>Επιβλέπων:</strong> ${t.sup_first} ${t.sup_last}</p>
                <p><strong>Κατάσταση:</strong> ${getGreekStatus(t.status)}</p>
                <p><strong>Περιγραφή:</strong> ${t.description}</p>
                ${t.external_links ? `<p><strong>Links:</strong> ${t.external_links}</p>` : ''}
            </div>
            
            ${finalInfo}   ${gradingHtml} <h4 style="border-bottom:2px solid #3498db; padding-bottom:5px; color:#3498db; margin-top:20px;">Τριμελής Επιτροπή</h4>
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

// 4. INVITES
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

//GRADING HELPER FUNCTIONS
window.enableGrading = async function(id) {
    if(!confirm("Είστε σίγουρος ότι θέλετε να ενεργοποιήσετε τη βαθμολόγηση;")) return;
    
    const fd = new FormData(); 
    fd.append('thesis_id', id);
    
    try {
        const res = await fetch('../api/instructor.php?action=enable_grading', {method:'POST', body:fd});
        const d = await res.json();
        if(d.success) {
            alert("Η βαθμολόγηση ενεργοποιήθηκε.");
            openThesisModal(id); 
        
        } else {
            alert("Error: " + (d.error || "Unknown"));
        }
    } catch(e) { console.error(e); }
}

window.submitGrade = async function(id) {
    const val = document.getElementById('grade-input').value;
    if(val === '' || val < 0 || val > 10) return alert("Εισάγετε έγκυρο βαθμό (0-10).");
    
    const fd = new FormData(); 
    fd.append('thesis_id', id); 
    fd.append('grade', val);
    
    try {
        const res = await fetch('../api/instructor.php?action=submit_grade', {method:'POST', body:fd});
        const d = await res.json();
        if(d.success) {
            alert("Ο βαθμός καταχωρήθηκε.");
            openThesisModal(id); 
        } else {
            alert("Error: " + (d.error || "Unknown"));
        }
    } catch(e) { console.error(e); }
}