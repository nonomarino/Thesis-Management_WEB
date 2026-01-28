document.addEventListener('DOMContentLoaded', () => {
    
    const mainContent = document.getElementById('main-content');
    const navItems = document.querySelectorAll('.nav-item');
    let currentTopics = []; 
    let allThesesList = [];
    
    // Charts container to manage destroying old charts
    let charts = []; 

    // =============================================================
    // NAVIGATION HANDLER
    // =============================================================
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const target = item.getAttribute('href');
            
            if (target === '#topics') {
                loadMyTopics();
            } else if (target === '#assign') {
                renderAssignmentPage();
            } else if (target === '#theses') {
                renderThesesListPage();
            } else if (target === '#invites') {
                renderInvitesPage();
            } else if (target === '#stats') {
                renderStatsPage(); // <--- Load Statistics
            }
        });
    });

    // Default Load
    loadMyTopics();


    // =============================================================
    // SECTION 1: TOPICS (Create/Edit)
    // =============================================================
    async function loadMyTopics() {
        try {
            const response = await fetch('../api/instructor.php?action=list_my_topics');
            const result = await response.json();
            if (result.success) {
                currentTopics = result.data;
                renderTopicsTable(result.data);
            }
        } catch (error) { console.error(error); }
    }

    function renderTopicsTable(topics) {
        let html = `
            <div style="margin-bottom: 20px;">
                <button onclick="resetAndShowForm()" style="background:#333; color:white; padding:10px 15px; border:none; cursor:pointer;">
                    <i class="fas fa-plus"></i> Νέο Θέμα
                </button>
            </div>
            
            <div id="create-form-container" style="display:none; background:#fff; padding:20px; border:1px solid #ddd; margin-bottom:20px;">
                <h3 id="form-title">Δημιουργία</h3>
                <form id="topic-form">
                    <input type="hidden" name="topic_id" id="topic_id">
                    <div style="margin-bottom:10px;">
                        <label>Τίτλος:</label><br>
                        <input type="text" name="title" id="input-title" required style="width:100%; padding:8px;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label>Περιγραφή:</label><br>
                        <textarea name="description" id="input-desc" required style="width:100%; height:80px; padding:8px;"></textarea>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label>Αρχείο (PDF):</label><br>
                        <input type="file" name="pdf_file" accept=".pdf">
                    </div>
                    <button type="submit" id="btn-save" style="background:#28a745; color:white; padding:8px 15px; border:none; cursor:pointer;">Αποθήκευση</button>
                    <button type="button" onclick="hideForm()" style="background:#dc3545; color:white; padding:8px 15px; border:none; cursor:pointer;">Ακύρωση</button>
                </form>
            </div>

            <table style="width:100%; border-collapse:collapse; background:white; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <thead style="background:#eee;">
                    <tr>
                        <th style="padding:10px;">Τίτλος</th>
                        <th style="padding:10px;">Κατάσταση</th>
                        <th style="padding:10px;">Φοιτητής</th>
                        <th style="padding:10px;">Ενέργεια</th>
                    </tr>
                </thead>
                <tbody>`;
        
        if (topics.length === 0) {
            html += `<tr><td colspan="4" style="padding:20px;">Κενό.</td></tr>`;
        } else {
            topics.forEach(t => {
                html += `
                    <tr style="border-bottom:1px solid #ddd;">
                        <td style="padding:10px;">${t.title}</td>
                        <td style="padding:10px;">${t.status}</td>
                        <td style="padding:10px;">${t.first_name || '-'} ${t.last_name || ''}</td>
                        <td style="padding:10px;">
                            <button onclick="editTopic(${t.id})" style="color:blue; border:none; background:none; cursor:pointer;">Επεξεργασία</button>
                        </td>
                    </tr>`;
            });
        }
        html += `</tbody></table>`;
        mainContent.innerHTML = html;
        document.getElementById('topic-form').addEventListener('submit', handleFormSubmit);
    }
    
    async function handleFormSubmit(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const act = fd.get('topic_id') ? 'update_topic' : 'create_topic';
        
        try {
            const res = await fetch(`../api/instructor.php?action=${act}`, { method: 'POST', body: fd });
            const d = await res.json();
            if (d.success) { 
                alert("Επιτυχία!"); 
                hideForm(); 
                loadMyTopics(); 
            } else { 
                alert("Σφάλμα: " + d.error); 
            }
        } catch (err) { console.error(err); }
    }

    // =============================================================
    // SECTION 2: ASSIGNMENT PAGE
    // =============================================================
    async function renderAssignmentPage() {
        mainContent.innerHTML = 'Loading...';
        
        const res = await fetch('../api/instructor.php?action=list_assignable_topics');
        const data = await res.json();
        const pending = currentTopics.filter(t => t.status === 'under_assignment');
        
        let html = `
            <h2 class="section-title">Ανάθεση Θέματος</h2>
            <div style="display:flex; gap:20px; flex-wrap:wrap;">
                
                <div style="flex:1; min-width:300px; background:white; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                    <h3>1. Νέα Ανάθεση</h3>
                    <label>Επιλογή Θέματος:</label>
                    <select id="assign-topic-select" style="width:100%; padding:8px; margin-bottom:10px;">
                        <option value="">-- Επιλέξτε --</option>
                        ${data.data.map(t => `<option value="${t.id}">${t.title}</option>`).join('')}
                    </select>

                    <label>Αναζήτηση Φοιτητή (ΑΜ ή Όνομα):</label>
                    <div style="display:flex; gap:5px;">
                        <input id="student-search-input" placeholder="π.χ. 1020" style="flex:1; padding:8px;">
                        <button onclick="searchStudent()" style="padding:8px; cursor:pointer;">Αναζήτηση</button>
                    </div>
                    
                    <div id="search-results" style="margin-top:10px; max-height:150px; overflow-y:auto; border:1px solid #eee;"></div>

                    <div id="selected-student-area" style="display:none; margin-top:10px; background:#eef; padding:10px; border-left:3px solid blue;">
                        <strong>Επιλογή:</strong> <span id="sel-name"></span>
                        <input type="hidden" id="sel-id">
                    </div>

                    <button onclick="submitAssignment()" style="margin-top:20px; width:100%; padding:10px; background:#007bff; color:white; border:none; cursor:pointer;">
                        ΑΝΑΘΕΣΗ
                    </button>
                </div>

                <div style="flex:1; min-width:300px; background:white; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                    <h3>2. Εκκρεμείς Αναθέσεις</h3>
                    <ul>
                        ${pending.length === 0 ? '<li>Καμία εκκρεμότητα.</li>' : 
                          pending.map(t => `
                            <li style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                                ${t.title} <br>
                                <small>Φοιτητής: ${t.first_name} ${t.last_name}</small> 
                                <button onclick="cancelAssignment(${t.id})" style="color:red; cursor:pointer; border:none; background:none; float:right;">(Ακύρωση)</button>
                            </li>`).join('')}
                    </ul>
                </div>
            </div>`;
        mainContent.innerHTML = html;
    }

    // =============================================================
    // SECTION 3: LIST ALL THESES (Filters & Export)
    // =============================================================
    window.renderThesesListPage = function() {
        mainContent.innerHTML = `
            <h2 class="section-title">Λίστα Διπλωματικών</h2>
            
            <div style="background:white; padding:15px; display:flex; gap:15px; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.1); margin-bottom:20px;">
                <div>
                    <label>Ρόλος:</label>
                    <select id="filter-role" onchange="fetchThesesWithFilters()" style="padding:5px;">
                        <option value="all">Όλοι</option>
                        <option value="supervisor">Επιβλέπων</option>
                        <option value="member">Μέλος Τριμελούς</option>
                    </select>
                </div>
                <div>
                    <label>Κατάσταση:</label>
                    <select id="filter-status" onchange="fetchThesesWithFilters()" style="padding:5px;">
                        <option value="all">Όλες</option>
                        <option value="under_assignment">Υπό Ανάθεση</option>
                        <option value="active">Ενεργή</option>
                        <option value="completed">Περατωμένη</option>
                    </select>
                </div>
                <div style="margin-left:auto;">
                    <button onclick="exportData('csv')" style="background:#28a745; color:white; border:none; padding:5px 10px; cursor:pointer;">Export CSV</button>
                    <button onclick="exportData('json')" style="background:#17a2b8; color:white; border:none; padding:5px 10px; cursor:pointer;">Export JSON</button>
                </div>
            </div>

            <div id="theses-list-container">Φόρτωση...</div>

            <div id="thesis-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000;">
                <div style="background:white; width:600px; margin:50px auto; padding:20px; border-radius:5px; max-height:80vh; overflow-y:auto;">
                    <div style="display:flex; justify-content:space-between;">
                        <h2 style="margin:0;">Λεπτομέρειες</h2>
                        <button onclick="closeModal()" style="border:none; background:none; font-size:20px; cursor:pointer;">&times;</button>
                    </div>
                    <hr>
                    <div id="modal-content"></div>
                </div>
            </div>
        `;
        fetchThesesWithFilters();
    }

    window.fetchThesesWithFilters = async function() {
        const role = document.getElementById('filter-role').value;
        const status = document.getElementById('filter-status').value;
        const container = document.getElementById('theses-list-container');
        
        container.innerHTML = 'Ανανέωση...';
        try {
            const res = await fetch(`../api/instructor.php?action=list_all_theses&role=${role}&status=${status}`);
            const data = await res.json();

            if (data.success) {
                allThesesList = data.data; 
                if (data.data.length === 0) { container.innerHTML = '<p>Κανένα αποτέλεσμα.</p>'; return; }

                let html = `<table style="width:100%; border-collapse:collapse; background:white;"><thead style="background:#333; color:white;"><tr><th style="padding:10px;">Τίτλος</th><th>Φοιτητής</th><th>Ρόλος</th><th>Κατάσταση</th><th></th></tr></thead><tbody>`;
                data.data.forEach(t => {
                    html += `
                        <tr style="border-bottom:1px solid #ddd;">
                            <td style="padding:10px;">${t.title}</td>
                            <td>${t.student_surname || '-'}</td>
                            <td>${t.my_role}</td>
                            <td>${t.status}</td>
                            <td><button onclick="openThesisModal(${t.id})" style="color:blue; cursor:pointer;">Προβολή</button></td>
                        </tr>`;
                });
                html += '</tbody></table>';
                container.innerHTML = html;
            }
        } catch (e) { console.error(e); }
    }

    // =============================================================
    // SECTION 4: INVITATIONS
    // =============================================================
    window.renderInvitesPage = async function() {
        mainContent.innerHTML = '<h2>Προσκλήσεις Τριμελούς</h2><p>Φόρτωση...</p>';
        try {
            const res = await fetch('../api/instructor.php?action=list_pending_invites');
            const data = await res.json();
            
            if (data.data.length === 0) {
                mainContent.innerHTML = '<h2>Προσκλήσεις</h2><p>Δεν έχετε εκκρεμείς προσκλήσεις.</p>';
                return;
            }

            let html = `<h2>Εισερχόμενες Προσκλήσεις</h2><div style="display:flex; flex-direction:column; gap:10px; max-width:800px;">`;
            data.data.forEach(inv => {
                html += `
                    <div style="background:white; padding:20px; border-left:5px solid #007bff; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        <h4 style="margin-top:0;">${inv.title}</h4>
                        <p><strong>Φοιτητής:</strong> ${inv.first_name} ${inv.last_name}</p>
                        <p>Ημερομηνία: ${new Date(inv.invitation_date).toLocaleDateString()}</p>
                        <div style="margin-top:15px;">
                            <button onclick="respondInvite(${inv.invite_id}, 'accepted')" style="background:#28a745; color:white; border:none; padding:10px 20px; cursor:pointer; margin-right:10px;">Αποδοχή</button>
                            <button onclick="respondInvite(${inv.invite_id}, 'rejected')" style="background:#dc3545; color:white; border:none; padding:10px 20px; cursor:pointer;">Απόρριψη</button>
                        </div>
                    </div>`;
            });
            html += `</div>`;
            mainContent.innerHTML = html;
        } catch (e) { console.error(e); }
    }

    window.respondInvite = async function(inviteId, response) {
        if (!confirm(response === 'accepted' ? "Αποδοχή;" : "Απόρριψη;")) return;

        try {
            const res = await fetch('../api/instructor.php?action=respond_invite', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ invite_id: inviteId, response: response })
            });
            const data = await res.json();
            if (data.success) {
                alert("Ολοκληρώθηκε.");
                renderInvitesPage();
            } else {
                alert("Σφάλμα: " + data.error);
            }
        } catch (e) { console.error(e); }
    }

    // =============================================================
    // SECTION 5: STATISTICS (With Chart.js)
    // =============================================================
    window.renderStatsPage = async function() {
        mainContent.innerHTML = `
            <h2 class="section-title">Στατιστικά Στοιχεία</h2>
            <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:center;">
                
                <div style="background:white; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.1); width:300px;">
                    <h4 style="text-align:center;">(iii) Πλήθος Διπλωματικών</h4>
                    <canvas id="chartCount"></canvas>
                </div>

                <div style="background:white; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.1); width:300px;">
                    <h4 style="text-align:center;">(ii) Μέσος Βαθμός</h4>
                    <canvas id="chartGrade"></canvas>
                </div>

                <div style="background:white; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.1); width:300px;">
                    <h4 style="text-align:center;">(i) Μέσος Χρόνος (Ημέρες)</h4>
                    <canvas id="chartTime"></canvas>
                </div>
            </div>
        `;

        try {
            const res = await fetch('../api/instructor.php?action=get_statistics');
            const data = await res.json();
            
            if (data.success) {
                renderCharts(data.supervisor, data.member);
            }
        } catch (e) { console.error(e); }
    }

    function renderCharts(sup, mem) {
        // Destroy old charts to prevent overlapping
        charts.forEach(c => c.destroy());
        charts = [];

        // Common config
        const labels = ['Επιβλέπων', 'Μέλος Τριμελούς'];
        const colors = ['#007bff', '#17a2b8'];

        // 1. Counts Chart
        charts.push(new Chart(document.getElementById('chartCount'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Πλήθος',
                    data: [sup.count, mem.count],
                    backgroundColor: colors
                }]
            }
        }));

        // 2. Grades Chart
        charts.push(new Chart(document.getElementById('chartGrade'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Βαθμός (0-10)',
                    data: [sup.grade, mem.grade],
                    backgroundColor: ['#28a745', '#ffc107']
                }]
            },
            options: { scales: { y: { beginAtZero: true, max: 10 } } }
        }));

        // 3. Time Chart
        charts.push(new Chart(document.getElementById('chartTime'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ημέρες',
                    data: [sup.days, mem.days],
                    backgroundColor: ['#6c757d', '#dc3545']
                }]
            }
        }));
    }


    // =============================================================
    // GLOBAL HELPERS
    // =============================================================
    
    // Search Student
    window.searchStudent = async function() {
        const query = document.getElementById('student-search-input').value;
        const resultsDiv = document.getElementById('search-results');
        
        if (query.length < 2) { alert("2+ χαρακτήρες"); return; }
        resultsDiv.innerHTML = 'Loading...'; resultsDiv.style.display = 'block';

        const res = await fetch(`../api/instructor.php?action=search_student&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data.data.length === 0) { 
            resultsDiv.innerHTML = '<div style="padding:10px;">Κανένα αποτέλεσμα.</div>'; 
        } else {
            resultsDiv.innerHTML = data.data.map(s => `
                <div onclick="selectStudent(${s.id}, '${s.first_name} ${s.last_name}', '${s.student_am}')" 
                     style="padding:8px; border-bottom:1px solid #eee; cursor:pointer; background:#f9f9f9;">
                    ${s.first_name} ${s.last_name} (${s.student_am})
                </div>`).join('');
        }
    }

    window.selectStudent = function(id, name, am) {
        document.getElementById('sel-student-id').value = id;
        document.getElementById('sel-name').innerText = `${name} (${am})`;
        document.getElementById('selected-student-area').style.display = 'block';
        document.getElementById('search-results').style.display = 'none';
    }

    // Submit Assignment
    window.submitAssignment = async function() {
        const thesisId = document.getElementById('assign-topic-select').value;
        const studentId = document.getElementById('sel-student-id').value;
        if (!thesisId || !studentId) { alert("Επιλέξτε Θέμα και Φοιτητή."); return; }
        if (!confirm("Ανάθεση;")) return;

        const res = await fetch('../api/instructor.php?action=assign_student', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ thesis_id: thesisId, student_id: studentId })
        });
        const d = await res.json();
        if(d.success) { alert("Επιτυχία!"); loadMyTopics(); renderAssignmentPage(); } else alert(d.error);
    }

    // Cancel Assignment
    window.cancelAssignment = async function(thesisId) {
        if (!confirm("Ακύρωση;")) return;
        const res = await fetch('../api/instructor.php?action=unassign_student', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ thesis_id: thesisId })
        });
        const d = await res.json();
        if(d.success) { alert("Ακυρώθηκε."); loadMyTopics(); renderAssignmentPage(); } else alert(d.error);
    }

    // Form Helpers
    window.hideForm = function() { 
        document.getElementById('create-form-container').style.display = 'none'; 
    }
    window.resetAndShowForm = function() { 
        document.getElementById('topic-form').reset(); 
        document.getElementById('topic_id').value = '';
        document.getElementById('create-form-container').style.display = 'block'; 
    }
    window.editTopic = function(id) { 
        const t = currentTopics.find(x => x.id == id);
        if(t) {
            document.getElementById('topic_id').value = t.id;
            document.getElementById('input-title').value = t.title;
            document.getElementById('input-desc').value = t.description;
            document.getElementById('create-form-container').style.display = 'block';
        }
    }
    
    // Modal Helpers
    window.openThesisModal = async function(id) {
        document.getElementById('thesis-modal').style.display = 'block';
        const content = document.getElementById('modal-content');
        content.innerHTML = 'Loading...';
        const res = await fetch(`../api/instructor.php?action=get_thesis_details&id=${id}`);
        const data = await res.json();
        const t = data.thesis;
        content.innerHTML = `
            <h3>${t.title}</h3>
            <p><strong>Φοιτητής:</strong> ${t.first_name} ${t.last_name}</p>
            <p><strong>Κατάσταση:</strong> ${t.status}</p>
            <hr>
            <h4>Ιστορικό</h4>
            <ul>${data.logs.map(l=>`<li>${l.created_at}: ${l.action_description}</li>`).join('')}</ul>
        `;
    }
    window.closeModal = function() { document.getElementById('thesis-modal').style.display = 'none'; }
    
    // Export Helper
    window.exportData = function(fmt) {
        if (!allThesesList.length) { alert("Empty list."); return; }
        let content = (fmt==='json') ? JSON.stringify(allThesesList) : "ID,Title\n" + allThesesList.map(r=>`${r.id},${r.title}`).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `export.${fmt}`; a.click();
    }
});