document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    
    // Navigation Logic
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const target = item.getAttribute('href');
            if (target === '#theses') loadThesesList();
            else if (target === '#import') renderImportPage();
        });
    });

    loadThesesList(); // Default load
});

// 1. LIST THESES
async function loadThesesList() {
    const container = document.getElementById('main-content');
    container.innerHTML = '<p>Φόρτωση λίστας...</p>';

    try {
        const res = await fetch('../api/secretariat.php?action=list_theses');
        const data = await res.json();

        if (!data.success) {
            container.innerHTML = '<p style="color:red">Σφάλμα ανάκτησης δεδομένων.</p>';
            return;
        }

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2 class="section-title">Διπλωματικές σε Εξέλιξη</h2>
            </div>
            <div class="card" style="padding:0; overflow:hidden;">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Θέμα</th>
                            <th>Φοιτητής</th>
                            <th>Επιβλέπων</th>
                            <th>Κατάσταση</th>
                            <th>Χρόνος (περ.)</th>
                            <th>Ενέργεια</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (data.data && data.data.length > 0) {
            data.data.forEach(t => {
                let badgeClass = t.status === 'active' ? 'bg-green' : 'bg-orange';
                let statusText = t.status === 'active' ? 'Ενεργή' : 'Υπό Εξέταση';
                
                html += `
                    <tr>
                        <td style="font-weight:600; width:30%;">${t.title}</td>
                        <td>${t.student_first} ${t.student_last}<br><small style="color:#888;">${t.student_am || '-'}</small></td>
                        <td>${t.sup_first} ${t.sup_last}</td>
                        <td><span class="badge ${badgeClass}">${statusText}</span></td>
                        <td>${t.time_elapsed}</td>
                        <td>
                            <button class="btn btn-primary" onclick="openManageModal(${t.id})">
                                <i class="fas fa-eye"></i> Λεπτομέρειες
                            </button>
                        </td>
                    </tr>
                `;
            });
        } else {
            html += `<tr><td colspan="6" style="text-align:center; padding:20px;">Δεν υπάρχουν διπλωματικές σε εξέλιξη.</td></tr>`;
        }

        html += `</tbody></table></div>`;
        container.innerHTML = html;

    } catch (err) { 
        console.error(err); 
        container.innerHTML = '<p style="color:red">Σφάλμα συστήματος.</p>'; 
    }
}

// 2. MANAGE MODAL (details & actions)
async function openManageModal(id) {
    const modal = document.getElementById('manage-modal');
    const content = document.getElementById('modal-content');
    content.innerHTML = '<p>Φόρτωση...</p>';
    modal.style.display = 'flex';

    try {
        const res = await fetch(`../api/secretariat.php?action=get_thesis_details&id=${id}`);
        const data = await res.json();
        
        if (!data.success) {
            content.innerHTML = '<p style="color:red">Δεν βρέθηκαν λεπτομέρειες.</p>';
            return;
        }

        const t = data.thesis;
        const committeeMembers = data.committee || [];

        // Build 3-Member Committee List
        let committeeHtml = '<ul style="padding-left:20px; margin:5px 0;">';
        
        // 1. Supervisor
        committeeHtml += `<li><strong>${t.sup_first} ${t.sup_last}</strong> (Επιβλέπων)</li>`;

        // 2. Members ( join from committee_members table)
        if (committeeMembers.length > 0) {
            committeeMembers.forEach(m => {
                committeeHtml += `<li>${m.first_name} ${m.last_name} (Μέλος)</li>`;
            });
        } else {
            committeeHtml += '<li style="color:#777; font-style:italic;">(Αναμονή για τα υπόλοιπα μέλη)</li>';
        }
        committeeHtml += '</ul>';

        // Repository Link
        let repoHtml = t.repository_link 
            ? `<a href="${t.repository_link}" target="_blank" style="font-weight:bold; color:#2980b9;">${t.repository_link}</a>` 
            : '<span style="color:#999;">Δεν έχει καταχωρηθεί από τον φοιτητή.</span>';

        // Actions Logic
        let actionsHtml = '';

        //CASE A: ACTIVE
        if (t.status === 'active') {
            actionsHtml = `
                <div style="background:#f9f9f9; padding:15px; border-radius:5px; margin-bottom:15px;">
                    <h4 style="margin-top:0;">1. Καταχώρηση ΑΠ Γενικής Συνέλευσης</h4>
                    <div class="input-group">
                        <label>Αριθμός Πρωτοκόλλου ΓΣ (Ανάθεσης):</label>
                        <input type="text" id="protocol-num" class="form-control" value="${t.general_assembly_protocol || ''}" placeholder="π.χ. 15/2024">
                    </div>
                    <button class="btn btn-success" onclick="saveProtocol(${t.id})">Αποθήκευση ΑΠ</button>
                </div>

                <div style="background:#fff5f5; padding:15px; border-radius:5px; border:1px solid #feb2b2;">
                    <h4 style="margin-top:0; color:#c0392b;">2. Ακύρωση Ανάθεσης</h4>
                    <p style="font-size:12px;">Απαιτείται απόφαση ΓΣ.</p>
                    <div class="input-group">
                        <label>Αριθμός/Έτος ΓΣ Ακύρωσης:</label>
                        <input type="text" id="cancel-ga" class="form-control" placeholder="π.χ. 20/2025">
                    </div>
                    <button class="btn btn-danger" onclick="cancelAssignment(${t.id})">Ακύρωση Ανάθεσης</button>
                </div>
            `;
        }

        // CASE B: UNDER EXAMINATION
        else if (t.status === 'under_examination') {
            const hasGrade = t.final_grade !== null;
            const hasRepo = t.repository_link !== null && t.repository_link !== '';
            
            actionsHtml = `
                <div style="background:#e8f5e9; padding:15px; border-radius:5px; border:1px solid #c8e6c9;">
                    <h4 style="margin-top:0;">Ολοκλήρωση Διπλωματικής</h4>
                    <ul style="font-size:13px; margin-bottom:10px;">
                        <li style="color:${hasGrade?'green':'red'}">
                            Βαθμός Καταχωρημένος: <strong>${hasGrade ? t.final_grade : 'ΟΧΙ'}</strong>
                        </li>
                        <li style="color:${hasRepo?'green':'red'}">
                            Σύνδεσμος Νημερτής: <strong>${hasRepo ? 'ΝΑΙ' : 'ΟΧΙ'}</strong>
                        </li>
                    </ul>
                    ${(hasGrade && hasRepo) 
                        ? `<button class="btn btn-success" style="width:100%;" onclick="finalizeThesis(${t.id})"><i class="fas fa-check"></i> Ορισμός ως Περατωμένη</button>`
                        : `<button class="btn btn-secondary" disabled style="opacity:0.6; cursor:not-allowed; width:100%;">Εκκρεμούν Προϋποθέσεις</button>`
                    }
                </div>
            `;
        }

        // Render Content
        content.innerHTML = `
            <h3 style="color:#2c3e50; margin-top:0; border-bottom:1px solid #eee; padding-bottom:10px;">${t.title}</h3>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:15px;">
                <div>
                    <p><strong>Φοιτητής:</strong><br> ${t.student_first} ${t.student_last} (${t.student_am})</p>
                    <p><strong>Κατάσταση:</strong><br> ${t.status === 'active' ? 'Ενεργή' : 'Υπό Εξέταση'}</p>
                </div>
                <div>
                    <p><strong>Χρόνος από Ανάθεση:</strong><br> ${t.time_elapsed_txt}</p>
                    <p><strong>Ημ/νία Ανάθεσης:</strong><br> ${new Date(t.assigned_at).toLocaleDateString()}</p>
                </div>
            </div>

            <div style="background:#f8f9fa; padding:10px; border-radius:5px; margin-bottom:15px;">
                <strong>Περιγραφή:</strong>
                <p style="font-size:0.9em; color:#555; margin:5px 0;">${t.description || '-'}</p>
            </div>

            <div style="margin-bottom:15px; border-left: 4px solid #3498db; padding-left: 10px;">
                <h4 style="margin:0 0 5px 0;">Τριμελής Επιτροπή</h4>
                ${committeeHtml}
            </div>

            <div style="margin-bottom:20px; padding:10px; border:1px dashed #3498db; border-radius:5px; background:#f0f8ff;">
                <strong>Σύνδεσμος Αποθετηρίου (Νημερτής):</strong><br>
                ${repoHtml}
            </div>

            <hr>
            ${actionsHtml}
        `;

    } catch (err) { 
        console.error(err); 
        content.innerHTML = '<p style="color:red">Σφάλμα κατά την εμφάνιση των λεπτομερειών.</p>'; 
    }
}

function closeModal() {
    document.getElementById('manage-modal').style.display = 'none';
}

// 3. ACTION FUNCTIONS
async function saveProtocol(id) {
    const proto = document.getElementById('protocol-num').value;
    if(!proto) return alert("Συμπληρώστε τον ΑΠ.");
    
    try {
        await fetch('../api/secretariat.php?action=update_protocol', {
            method: 'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ id, protocol: proto })
        });
        alert("Αποθηκεύτηκε επιτυχώς!");
    } catch(e) { alert("Σφάλμα."); }
}

async function cancelAssignment(id) {
    const ga = document.getElementById('cancel-ga').value;
    if(!ga) return alert("Απαιτείται Αριθμός/Έτος ΓΣ για την ακύρωση.");
    
    if(!confirm("Είστε σίγουροι για την ακύρωση της ανάθεσης;")) return;

    try {
        await fetch('../api/secretariat.php?action=cancel_assignment', {
            method: 'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ id, ga_info: ga })
        });
        alert("Η ανάθεση ακυρώθηκε.");
        closeModal();
        loadThesesList();
    } catch(e) { alert("Σφάλμα."); }
}

async function finalizeThesis(id) {
    if(!confirm("Οριστική περάτωση διπλωματικής; \nΗ ενέργεια αυτή δεν αναιρείται εύκολα.")) return;

    try {
        const res = await fetch('../api/secretariat.php?action=finalize_thesis', {
            method: 'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        
        if (data.success) {
            alert("Η διπλωματική ολοκληρώθηκε!");
            closeModal();
            loadThesesList();
        } else {
            alert("Σφάλμα: " + (data.error || "Άγνωστο"));
        }
    } catch(e) { alert("Συστημικό Σφάλμα."); }
}

// 4. IMPORT DATA
function renderImportPage() {
    const container = document.getElementById('main-content');
    container.innerHTML = `
        <h2 class="section-title">Εισαγωγή Δεδομένων</h2>
        <div class="card" style="max-width:600px;">
            <p>Επιλέξτε αρχείο JSON με στοιχεία χρηστών (Students, Instructors).</p>
            <input type="file" id="json-file" accept=".json" class="form-control">
            <br><br>
            <button class="btn btn-primary" onclick="uploadJson()">Ανέβασμα & Εισαγωγή</button>
        </div>
    `;
}

async function uploadJson() {
    const fileInput = document.getElementById('json-file');
    if(!fileInput.files[0]) return alert("Επιλέξτε αρχείο.");

    const formData = new FormData();
    formData.append('json_file', fileInput.files[0]);

    try {
        const res = await fetch('../api/secretariat.php?action=import_data', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if(data.success) alert("Επιτυχής εισαγωγή! Εγγραφές: " + data.count);
        else alert("Σφάλμα: " + (data.error || "Invalid Data"));
    } catch(e) { console.error(e); alert("System Error"); }
}