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
        tabThesis.classList.add('active'); tabProfile.classList.remove('active');
        if(viewThesis) viewThesis.classList.remove('hidden');
        if(viewProfile) viewProfile.classList.add('hidden');
        if(viewManage) viewManage.classList.add('hidden'); 
        loadMyThesis(); 
    });

    tabProfile.addEventListener('click', () => {
        tabProfile.classList.add('active'); tabThesis.classList.remove('active');
        if(viewProfile) viewProfile.classList.remove('hidden');
        if(viewThesis) viewThesis.classList.add('hidden');
        if(viewManage) viewManage.classList.add('hidden'); 
        loadProfile(); 
    });

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
    fetch('../api/auth.php?action=check').then(res=>res.json()).then(data=>{ if(data.user) document.getElementById('user-name').textContent = data.user.name; });
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
        
        if (!data.success) { contentDiv.innerHTML = `<p style="color:red">Error loading data.</p>`; return; }
        
        currentThesisData = data.thesis; 
        const t = data.thesis;

        if (!t) { 
            contentDiv.innerHTML = `<div style="text-align:center; padding:40px; color:#777;"><p>Δεν σας έχει ανατεθεί θέμα.</p></div>`; 
            return; 
        }

        // Status Handling
        let statusText = t.status;
        let badgeClass = 'bg-gray';
        if(t.status === 'assigned') { statusText = 'Υπό Ανάθεση'; badgeClass = 'bg-gray'; }
        else if(t.status === 'active') { statusText = 'Ενεργή'; badgeClass = 'bg-blue'; }
        else if(t.status === 'under_examination') { statusText = 'Υπό Εξέταση'; badgeClass = 'bg-orange'; }
        else if(t.status === 'completed') { statusText = 'Περατωμένη'; badgeClass = 'bg-green'; }

        // Committee List
        let committeeHtml = `<ul style="margin:5px 0; padding-left:20px;"><li><strong>${t.sup_first} ${t.sup_last}</strong> (Επιβλέπων)</li>`;
        if (data.committee && data.committee.length > 0) {
            data.committee.forEach(m => committeeHtml += `<li>${m.first_name} ${m.last_name} (Μέλος)</li>`);
        } else {
            committeeHtml += `<li><em>Δεν έχουν οριστεί επιπλέον μέλη ακόμα.</em></li>`;
        }
        committeeHtml += '</ul>';

        // File Display
        let fileHtml = t.file_path ? `<a href="../public/uploads/${t.file_path}" target="_blank" style="color:#007bff;"><i class="fas fa-paperclip"></i> ${t.file_path}</a>` : `<span style="color:#777;">Κανένα αρχείο</span>`;

        // Exam report and Nemertes link
        let examReportHtml = '';
        let nemertesFormHtml = '';

        // Εμφάνιση Πρακτικού & Νημερτή ΜΟΝΟ αν υπάρχει βαθμός
        if (t.final_grade) {
            
            // 1. Button Display HTML Report
            examReportHtml = `
                <div style="margin-top:20px; padding:15px; background:#fff3e0; border:1px solid #ffe0b2; border-radius:5px;">
                    <h4 style="margin-top:0; color:#e65100;"><i class="fas fa-certificate"></i> Αποτελέσματα Εξέτασης</h4>
                    <p>Η εξέταση ολοκληρώθηκε. Ο τελικός βαθμός σας είναι: <strong style="font-size:18px;">${t.final_grade}</strong></p>
                    <button class="btn btn-primary" onclick="viewExamReport(${t.id})">
                        <i class="fas fa-file-alt"></i> Προβολή Πρακτικού Εξέτασης (HTML)
                    </button>
                </div>
            `;

            // 2. Display Nemertes Form
            if (t.status === 'under_examination' || t.repository_link) {
                let existingLink = t.repository_link || '';
                let isLocked = t.status === 'completed' ? 'disabled' : '';
                let btnDisplay = t.status === 'completed' ? 'none' : 'inline-block';

                nemertesFormHtml = `
                    <div style="margin-top:20px; padding:15px; background:#e8f5e9; border:1px solid #c8e6c9; border-radius:5px;">
                        <h4 style="margin-top:0; color:#2e7d32;"><i class="fas fa-book"></i> Κατάθεση στο Νημερτής</h4>
                        <p style="font-size:13px;">Παρακαλώ καταχωρήστε τον σύνδεσμο της διπλωματικής σας από το αποθετήριο.</p>
                        <div class="input-group">
                            <input type="url" id="nemertes-link" class="custom-input" value="${existingLink}" placeholder="https://nemertes.library.upatras.gr/..." ${isLocked}>
                            <button class="btn btn-success" onclick="saveNemertesLink(${t.id})" style="margin-top:10px; display:${btnDisplay}">
                                <i class="fas fa-save"></i> Αποθήκευση
                            </button>
                        </div>
                    </div>
                `;
            }
        }
        // ------------------------------------------------

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

            ${examReportHtml}
            ${nemertesFormHtml}

            <div style="text-align:right; margin-top:30px; border-top:1px solid #eee; padding-top:20px;">
                <button class="btn btn-primary" onclick="renderManageThesisPage()"><i class="fas fa-cog"></i> Διαχείριση / Ενέργειες</button>
            </div>
        `;
    } catch (err) { console.error(err); }
}

//  Save Nemertes Link 
window.saveNemertesLink = async function(id) {
    const link = document.getElementById('nemertes-link').value;
    if(!link) return alert("Παρακαλώ εισάγετε τον σύνδεσμο.");

    try {
        const res = await fetch('../api/student.php?action=save_nemertes', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ thesis_id: id, repository_link: link })
        });
        const data = await res.json();
        if(data.success) { alert("Αποθηκεύτηκε!"); loadMyThesis(); }
        else alert("Σφάλμα: " + data.error);
    } catch(e) { console.error(e); }
}

// HTML Report
window.viewExamReport = async function(id) {
    const win = window.open('', '_blank');
    win.document.write('<p>Φόρτωση Πρακτικού...</p>');

    try {
        const res = await fetch(`../api/student.php?action=get_exam_report&thesis_id=${id}`);
        const data = await res.json();
        
        if(!data.success) { win.document.body.innerHTML = 'Error'; return; }

        const t = data.thesis;
        const grades = data.grades || []; 

        let gradesHtml = '';
        grades.forEach(g => {
            gradesHtml += `<tr><td style="padding:10px; border-bottom:1px solid #eee;">${g.first_name} ${g.last_name}</td><td style="padding:10px; border-bottom:1px solid #eee; font-weight:bold;">${g.grade}</td></tr>`;
        });

        const reportHtml = `
            <html>
            <head>
                <title>Πρακτικό Εξέτασης - ${t.title}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                    .title { font-size: 18px; font-weight: bold; text-align: center; margin: 20px 0; }
                    .info-table { width: 100%; margin-bottom: 30px; border-collapse: collapse; }
                    .info-table td { padding: 8px; vertical-align: top; }
                    .grades-table { width: 100%; border: 1px solid #333; border-collapse: collapse; margin-top: 20px; }
                    .grades-table th { background: #f0f0f0; border: 1px solid #333; padding: 10px; text-align: left; }
                    .grades-table td { border: 1px solid #333; padding: 10px; }
                    .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>ΠΑΝΕΠΙΣΤΗΜΙΟ ΠΑΤΡΩΝ</h2>
                    <h3>ΤΜΗΜΑ ΜΗΧΑΝΙΚΩΝ Η/Υ & ΠΛΗΡΟΦΟΡΙΚΗΣ</h3>
                    <p>ΠΡΑΚΤΙΚΟ ΕΞΕΤΑΣΗΣ ΔΙΠΛΩΜΑΤΙΚΗΣ ΕΡΓΑΣΙΑΣ</p>
                </div>

                <p>Σήμερα, <strong>${new Date().toLocaleDateString('el-GR')}</strong>, συνήλθε η Τριμελής Εξεταστική Επιτροπή.</p>
                
                <table class="info-table">
                    <tr><td width="30%"><strong>Ονοματεπώνυμο Φοιτητή:</strong></td><td>${t.student_first} ${t.student_last}</td></tr>
                    <tr><td><strong>Αριθμός Μητρώου:</strong></td><td>${t.student_am || '-'}</td></tr>
                    <tr><td><strong>Τίτλος Θέματος:</strong></td><td>${t.title}</td></tr>
                    <tr><td><strong>Αρ. Πρωτ. ΓΣ Ανάθεσης:</strong></td><td>${t.general_assembly_protocol || '<span style="color:red">[Εκκρεμεί από Γραμματεία]</span>'}</td></tr>
                </table>

                <p>Η Επιτροπή εξέτασε τον φοιτητή και βαθμολόγησε ως εξής:</p>

                <table class="grades-table">
                    <thead><tr><th>Μέλος Επιτροπής</th><th>Βαθμός</th></tr></thead>
                    <tbody>
                        ${gradesHtml}
                        <tr style="background:#f9f9f9;">
                            <td style="text-align:right;"><strong>ΤΕΛΙΚΟΣ ΒΑΘΜΟΣ (Μ.Ο.):</strong></td>
                            <td style="font-size:18px; font-weight:bold;">${t.final_grade}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="footer">
                    <div>Ο Επιβλέπων<br><br>(Υπογραφή)</div>
                    <div>Τα Μέλη<br><br>(Υπογραφές)</div>
                </div>
            </body>
            </html>
        `;
        
        win.document.write(reportHtml);

    } catch(e) { win.document.body.innerHTML = 'System Error'; }
}

// MANAGE THESIS PAGE
window.renderManageThesisPage = async function() {
    if (!currentThesisData) return;

    document.getElementById('view-thesis').classList.add('hidden');
    document.getElementById('view-manage-thesis').classList.remove('hidden');

    const manageContent = document.getElementById('manage-content');
    manageContent.innerHTML = '<p>Φόρτωση...</p>';

    //CASE 1: Assigned
    if (currentThesisData.status === 'assigned') {
        try {
            const invitesRes = await fetch(`../api/student.php?action=get_thesis_invites&thesis_id=${currentThesisData.id}&t=` + Date.now());
            const invitesData = await invitesRes.json();
            const existingIds = (invitesData.data || []).map(i => i.professor_id);
            const instructorsRes = await fetch(`../api/student.php?action=get_available_instructors&supervisor_id=${currentThesisData.supervisor_id}`);
            const instructorsData = await instructorsRes.json();

            let listHtml = '';
            if (instructorsData.success && instructorsData.data) {
                const available = instructorsData.data.filter(inst => !existingIds.includes(inst.id));
                if (available.length > 0) {
                    available.forEach(inst => {
                        listHtml += `<label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid #eee; cursor:pointer;" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='white'"><input type="checkbox" value="${inst.id}" class="prof-checkbox" style="transform:scale(1.2);"><span style="color:#2c3e50; font-weight:500;">${inst.last_name} ${inst.first_name}</span></label>`;
                    });
                } else { listHtml = '<div style="padding:15px; color:#777; font-style:italic;">Δεν υπάρχουν άλλοι διαθέσιμοι καθηγητές.</div>'; }
            }

            let invitesTableHtml = '';
            if (invitesData.data && invitesData.data.length > 0) {
                invitesTableHtml = `<div style="margin-top:30px;"><h4 style="color:#2c3e50; margin-bottom:10px;">Απεσταλμένες Προσκλήσεις</h4><table style="width:100%; border-collapse:collapse; font-size:14px; box-shadow:0 2px 5px rgba(0,0,0,0.05);"><thead style="background:#f8f9fa; text-align:left;"><tr><th style="padding:10px; border-bottom:2px solid #eee;">Καθηγητής</th><th style="padding:10px; border-bottom:2px solid #eee;">Κατάσταση</th></tr></thead><tbody>`;
                invitesData.data.forEach(inv => {
                    let statusColor = inv.status === 'accepted' ? '#27ae60' : (inv.status === 'rejected' ? '#e74c3c' : '#f39c12');
                    let statusLabel = inv.status === 'accepted' ? 'Αποδέχτηκε' : (inv.status === 'rejected' ? 'Απέρριψε' : 'Εκκρεμεί');
                    invitesTableHtml += `<tr style="border-bottom:1px solid #eee; background:white;"><td style="padding:10px;">${inv.last_name} ${inv.first_name}</td><td style="padding:10px;"><span style="color:${statusColor}; font-weight:bold;">${statusLabel}</span></td></tr>`;
                });
                invitesTableHtml += '</tbody></table></div>';
            }

            manageContent.innerHTML = `<h2 class="section-title">Συγκρότηση Τριμελούς Επιτροπής</h2><div style="background:#e3f2fd; padding:15px; border-radius:8px; border-left:5px solid #2196f3; margin-bottom:25px;"><strong>Επιλογή Μελών:</strong> Παρακαλώ επιλέξτε τους καθηγητές που επιθυμείτε να προσκαλέσετε.</div><div class="card" style="border:1px solid #eee; box-shadow:none; background:#fafafa; padding:0; overflow:hidden;"><div style="padding:15px; background:#f1f2f6; border-bottom:1px solid #ddd; font-weight:600; color:#555;">Διαθέσιμοι Καθηγητές</div><div style="max-height: 250px; overflow-y: auto; background:white;">${listHtml}</div><div style="padding:15px; background:#f9f9f9; border-top:1px solid #ddd; text-align:right;"><button class="btn btn-primary" onclick="sendCommitteeInvites()"><i class="fas fa-paper-plane"></i> Αποστολή</button></div></div>${invitesTableHtml}`;
        } catch (err) { console.error(err); manageContent.innerHTML = '<p style="color:red">Σφάλμα φόρτωσης.</p>'; }
    }

    //CASE 2: Under Examination
    else if (currentThesisData.status === 'under_examination') {
        const draftFile = currentThesisData.draft_file_path;
        const links = currentThesisData.external_links || '';
        
        const examDate = currentThesisData.exam_date ? currentThesisData.exam_date.replace(' ', 'T') : '';
        const examMethod = currentThesisData.exam_method || 'in_person';
        const examLoc = currentThesisData.exam_location || '';

        let draftDisplayHtml = draftFile ? `<div style="margin-bottom:15px; padding:10px; background:#e8f5e9; border:1px solid #c8e6c9; border-radius:5px; display:flex; align-items:center; gap:10px;"><i class="fas fa-check-circle" style="color:#2e7d32;"></i><span style="flex:1; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${draftFile}">Έχει αναρτηθεί: <strong>${draftFile}</strong></span><a href="../public/uploads/${draftFile}" target="_blank" class="btn btn-secondary" style="font-size:12px; padding:5px 10px;">Προβολή</a></div>` : '';

        manageContent.innerHTML = `
            <h2 class="section-title">Υλικό & Προγραμματισμός Εξέτασης</h2>
            <div style="background:#fff3cd; padding:15px; border-radius:8px; border-left:5px solid #ffc107; margin-bottom:25px; color:#856404;"><strong>Κατάσταση: Υπό Εξέταση.</strong> Προετοιμασία για την παρουσίαση.</div>

            <div style="display:flex; gap:20px; align-items:stretch; margin-bottom:20px; flex-wrap:wrap;">
                
                <div class="card" style="flex:1; min-width:300px; margin-bottom:0;">
                    <h3 style="margin-top:0; font-size:18px; border-bottom:1px solid #eee; padding-bottom:10px;">Πρόχειρο Κείμενο (PDF)</h3>
                    ${draftDisplayHtml}
                    <div style="margin-top:15px;">
                        <input type="file" id="draft-file-input" class="custom-input" accept=".pdf,.doc,.docx" style="padding:8px;">
                        <div style="font-size:12px; color:#666; margin-top:5px;">Επιλέξτε αρχείο για αντικατάσταση.</div>
                    </div>
                </div>

                <div class="card" style="flex:1; min-width:300px; margin-bottom:0;">
                    <h3 style="margin-top:0; font-size:18px; border-bottom:1px solid #eee; padding-bottom:10px;">Συνοδευτικό Υλικό (Links)</h3>
                    <textarea id="external-links-input" class="custom-input" rows="4" placeholder="Google Drive, GitHub..." style="resize:vertical;">${links}</textarea>
                </div>

            </div>

            <div class="card">
                <h3 style="margin-top:0; font-size:18px; border-bottom:1px solid #eee; padding-bottom:10px;">Προγραμματισμός Παρουσίασης</h3>
                <p style="font-size:13px; color:#666; margin-bottom:15px;">Καταχωρήστε τα στοιχεία που συμφωνήθηκαν με την επιτροπή.</p>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                    <div class="input-group">
                        <label>Ημερομηνία & Ώρα</label>
                        <input type="datetime-local" id="exam-date" class="custom-input" value="${examDate}">
                    </div>

                    <div class="input-group">
                        <label>Τρόπος Εξέτασης</label>
                        <select id="exam-method" class="custom-input" onchange="toggleExamMethodFields()">
                            <option value="in_person" ${examMethod === 'in_person' ? 'selected' : ''}>Δια ζώσης</option>
                            <option value="online" ${examMethod === 'online' ? 'selected' : ''}>Διαδικτυακά (Online)</option>
                        </select>
                    </div>
                </div>

                <div class="input-group">
                    <label id="exam-loc-label">${examMethod === 'online' ? 'Σύνδεσμος (Link) Συνάντησης' : 'Αίθουσα Εξέτασης'}</label>
                    <input type="text" id="exam-location" class="custom-input" placeholder="${examMethod === 'online' ? 'π.χ. https://zoom.us/...' : 'π.χ. Β1'}" value="${examLoc}">
                </div>

                <div style="text-align:right; margin-top:30px; border-top:1px solid #eee; padding-top:20px;">
                    <button class="btn btn-primary" onclick="saveAllUnderExamData()" style="padding: 12px 30px; font-size: 16px;">
                        <i class="fas fa-save"></i> Αποθήκευση Όλων
                    </button>
                </div>
            </div>
        `;
    } else {
        manageContent.innerHTML = `<h2 class="section-title">Διαχείριση Διπλωματικής</h2><p>Κατάσταση: <strong>${currentThesisData.status}</strong>. Καμία ενέργεια διαθέσιμη.</p>`;
    }
}

// Helper Functions

window.toggleExamMethodFields = function() {
    const method = document.getElementById('exam-method').value;
    const label = document.getElementById('exam-loc-label');
    const input = document.getElementById('exam-location');
    
    if (method === 'online') {
        label.textContent = 'Σύνδεσμος (Link) Συνάντησης';
        input.placeholder = 'π.χ. https://zoom.us/...';
    } else {
        label.textContent = 'Αίθουσα Εξέτασης';
        input.placeholder = 'π.χ. Β1';
    }
}

window.saveAllUnderExamData = async function() {
    // 1. Gather Data
    const fileInput = document.getElementById('draft-file-input');
    const links = document.getElementById('external-links-input').value;
    const date = document.getElementById('exam-date').value;
    const method = document.getElementById('exam-method').value;
    const loc = document.getElementById('exam-location').value;

    // Validation for Exam Fields (Required)
    if(!date || !loc) {
        alert("Παρακαλώ συμπληρώστε τα υποχρεωτικά πεδία της εξέτασης (Ημερομηνία, Τοποθεσία).");
        return;
    }

    // Indicate loading state
    const btn = document.querySelector('button[onclick="saveAllUnderExamData()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Αποθήκευση...';
    btn.disabled = true;

    try {
        // 1: Upload File (Only if selected)
        if (fileInput.files.length > 0) {
            const fd = new FormData();
            fd.append('thesis_id', currentThesisData.id);
            fd.append('draft_file', fileInput.files[0]);
            
            const resFile = await fetch('../api/student.php?action=upload_draft', { method: 'POST', body: fd });
            const dataFile = await resFile.json();
            if(!dataFile.success) throw new Error("File Upload Failed: " + dataFile.error);
        }

        // 2: Save Links
        const resLinks = await fetch('../api/student.php?action=save_links', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ thesis_id: currentThesisData.id, external_links: links })
        });
        const dataLinks = await resLinks.json();
        if(!dataLinks.success) throw new Error("Links Save Failed");

        // 3: Save Exam Details
        const resExam = await fetch('../api/student.php?action=save_exam_details', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                thesis_id: currentThesisData.id,
                examination_date: date,
                examination_method: method,
                examination_location: loc
            })
        });
        const dataExam = await resExam.json();
        if(!dataExam.success) throw new Error("Exam Details Save Failed");

        // SUCCESS
        alert("Όλα τα στοιχεία αποθηκεύτηκαν επιτυχώς!");
        renderManageThesisPage(); // Refresh UI

    } catch (err) {
        console.error(err);
        alert("Σφάλμα: " + err.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

window.sendCommitteeInvites = async function() {
    const checkboxes = document.querySelectorAll('.prof-checkbox:checked');
    if (checkboxes.length === 0) { alert("Παρακαλώ επιλέξτε τουλάχιστον έναν καθηγητή."); return; }
    if(!confirm(`Να σταλούν προσκλήσεις σε ${checkboxes.length} καθηγητές;`)) return;
    const formData = new FormData();
    formData.append('thesis_id', currentThesisData.id);
    checkboxes.forEach(cb => { formData.append('professor_ids[]', cb.value); });
    try {
        const res = await fetch('../api/student.php?action=send_invite', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) { alert(data.message || "Οι προσκλήσεις στάλθηκαν επιτυχώς!"); renderManageThesisPage(); } 
        else { alert("Σφάλμα: " + (data.error || 'Άγνωστο')); }
    } catch (err) { console.error(err); alert("System error."); }
}