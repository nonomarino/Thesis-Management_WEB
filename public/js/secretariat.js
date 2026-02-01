// public/js/secretariat.js

document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    const mainContent = document.getElementById('main-content');

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

    // Default Load
    loadThesesList();
});

// ==========================================
// 1. LIST THESES (Active & Under Exam)
// ==========================================
async function loadThesesList() {
    const container = document.getElementById('main-content');
    container.innerHTML = '<p>Φόρτωση λίστας...</p>';

    try {
        const res = await fetch('../api/secretariat.php?action=list_theses');
        const data = await res.json();

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
                            <th>Χρόνος</th>
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
                                <i class="fas fa-cog"></i> Διαχείριση
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
        container.innerHTML = '<p style="color:red">Σφάλμα φόρτωσης.</p>';
    }
}

// ==========================================
// 2. MANAGE MODAL & ACTIONS
// ==========================================
async function openManageModal(id) {
    const modal = document.getElementById('manage-modal');
    const content = document.getElementById('modal-content');
    content.innerHTML = 'Φόρτωση...';
    modal.style.display = 'flex';

    try {
        const res = await fetch(`../api/secretariat.php?action=get_thesis_details&id=${id}`);
        const data = await res.json();
        const t = data.thesis;

        let actionsHtml = '';

        // --- CASE A: ACTIVE (ΕΝΕΡΓΗ) ---
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

        // --- CASE B: UNDER EXAMINATION (ΥΠΟ ΕΞΕΤΑΣΗ) ---
        else if (t.status === 'under_examination') {
            const hasGrade = t.final_grade !== null;
            const hasRepo = t.repository_link !== null && t.repository_link !== '';
            
            actionsHtml = `
                <div style="background:#e8f5e9; padding:15px; border-radius:5px;">
                    <h4 style="margin-top:0;">Ολοκλήρωση Διπλωματικής</h4>
                    <ul style="font-size:13px;">
                        <li style="color:${hasGrade?'green':'red'}">Βαθμός Καταχωρημένος: <strong>${hasGrade ? t.final_grade : 'ΟΧΙ'}</strong></li>
                        <li style="color:${hasRepo?'green':'red'}">Σύνδεσμος Νημερτής: <strong>${hasRepo ? 'ΝΑΙ' : 'ΟΧΙ'}</strong></li>
                    </ul>
                    ${(hasGrade && hasRepo) 
                        ? `<button class="btn btn-success" onclick="finalizeThesis(${t.id})">Ορισμός ως Περατωμένη</button>`
                        : `<button class="btn btn-secondary" disabled style="opacity:0.6; cursor:not-allowed;">Εκκρεμούν Προϋποθέσεις</button>`
                    }
                </div>
            `;
        }

        content.innerHTML = `
            <h3 style="color:#2c3e50;">${t.title}</h3>
            <p><strong>Φοιτητής:</strong> ${t.student_first} ${t.student_last} (${t.student_am})</p>
            <hr>
            ${actionsHtml}
        `;

    } catch (err) {
        console.error(err);
        content.innerHTML = 'Σφάλμα.';
    }
}

function closeModal() {
    document.getElementById('manage-modal').style.display = 'none';
}

// --- ACTIONS IMPLEMENTATION ---

async function saveProtocol(id) {
    const proto = document.getElementById('protocol-num').value;
    if(!proto) return alert("Συμπληρώστε τον ΑΠ.");
    
    await fetch('../api/secretariat.php?action=update_protocol', {
        method: 'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id, protocol: proto })
    });
    alert("Αποθηκεύτηκε!");
}

async function cancelAssignment(id) {
    const ga = document.getElementById('cancel-ga').value;
    if(!ga) return alert("Απαιτείται Αριθμός/Έτος ΓΣ για την ακύρωση.");
    
    if(!confirm("Είστε σίγουροι για την ακύρωση της ανάθεσης;")) return;

    await fetch('../api/secretariat.php?action=cancel_assignment', {
        method: 'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id, ga_info: ga })
    });
    alert("Η ανάθεση ακυρώθηκε.");
    closeModal();
    loadThesesList();
}

async function finalizeThesis(id) {
    if(!confirm("Οριστική περάτωση διπλωματικής;")) return;

    await fetch('../api/secretariat.php?action=finalize_thesis', {
        method: 'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id })
    });
    alert("Η διπλωματική ολοκληρώθηκε!");
    closeModal();
    loadThesesList();
}

// ==========================================
// 3. IMPORT DATA (JSON)
// ==========================================
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
        if(data.success) alert("Επιτυχής εισαγωγή!");
        else alert("Σφάλμα: " + data.error);
    } catch(e) { console.error(e); alert("System Error"); }
}