<?php
// api/student.php
session_start();
header('Content-Type: application/json');
require 'db.php';

// Check Auth
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'student') {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$user_id = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

try {
    
    // =========================================================================
    // ACTION: Get My Thesis Details (Updated table name: thesis_exam)
    // =========================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_my_thesis') {
        
        // Fetch Thesis, Supervisor AND Exam Details
        $stmt = $pdo->prepare("
            SELECT t.id, t.title, t.description, t.status, t.assigned_at, t.file_path, t.supervisor_id,
                   t.draft_file_path, t.external_links,
                   te.exam_date, te.exam_method, te.exam_location,
                   u.first_name AS sup_first, u.last_name AS sup_last
            FROM theses t
            LEFT JOIN users u ON t.supervisor_id = u.id
            LEFT JOIN thesis_exam te ON t.id = te.thesis_id  -- Changed table name here
            WHERE t.student_id = ?
            LIMIT 1
        ");
        $stmt->execute([$user_id]);
        $thesis = $stmt->fetch();

        if (!$thesis) {
            echo json_encode(['success' => true, 'thesis' => null]);
            exit;
        }

        // Fetch Committee
        $stmtComm = $pdo->prepare("
            SELECT u.first_name, u.last_name
            FROM committee_members cm
            JOIN users u ON cm.professor_id = u.id
            WHERE cm.thesis_id = ?
        ");
        $stmtComm->execute([$thesis['id']]);
        $committee = $stmtComm->fetchAll();

        // Time Calc
        $time_str = '-';
        if ($thesis['assigned_at']) {
            $start = new DateTime($thesis['assigned_at']);
            $now   = new DateTime();
            $diff  = $start->diff($now);
            
            if ($diff->y == 0 && $diff->m == 0 && $diff->d == 0) {
                $time_str = ($diff->h == 0) ? ($diff->i . (($diff->i==1)?' λεπτό':' λεπτά')) : ($diff->h . (($diff->h==1)?' ώρα':' ώρες'));
            } else {
                $parts = [];
                if($diff->y > 0) $parts[] = $diff->y . (($diff->y==1)?' έτος':' έτη');
                if($diff->m > 0) $parts[] = $diff->m . (($diff->m==1)?' μήνας':' μήνες');
                $parts[] = $diff->d . (($diff->d==1)?' ημέρα':' ημέρες');
                $time_str = implode(', ', $parts);
            }
        }

        echo json_encode([
            'success'      => true,
            'thesis'       => $thesis,
            'committee'    => $committee,
            'time_elapsed' => $time_str
        ]);
        exit;
    }

    // =========================================================================
    // ACTION: Save Examination Details (Updated table name: thesis_exam)
    // =========================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'save_exam_details') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $thesis_id = $input['thesis_id'];
        $exam_date = $input['examination_date'];
        $exam_method = $input['examination_method'];
        $exam_loc = $input['examination_location'];

        // Verify ownership
        $check = $pdo->prepare("SELECT id FROM theses WHERE id = ? AND student_id = ?");
        $check->execute([$thesis_id, $user_id]);
        if (!$check->fetch()) { echo json_encode(['success' => false, 'error' => 'Unauthorized']); exit; }

        // Check if exam record exists in thesis_exam
        $exists = $pdo->prepare("SELECT id FROM thesis_exam WHERE thesis_id = ?");
        $exists->execute([$thesis_id]);
        $examRow = $exists->fetch();

        if ($examRow) {
            // UPDATE
            $stmt = $pdo->prepare("UPDATE thesis_exam SET exam_date=?, exam_method=?, exam_location=? WHERE thesis_id=?");
            $stmt->execute([$exam_date, $exam_method, $exam_loc, $thesis_id]);
        } else {
            // INSERT
            $stmt = $pdo->prepare("INSERT INTO thesis_exam (thesis_id, exam_date, exam_method, exam_location) VALUES (?, ?, ?, ?)");
            $stmt->execute([$thesis_id, $exam_date, $exam_method, $exam_loc]);
        }
        
        echo json_encode(['success' => true]);
        exit;
    }

    // =========================================================================
    // (Other Actions Remain Unchanged)
    // =========================================================================

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'upload_draft') {
        $thesis_id = $_POST['thesis_id'];
        $check = $pdo->prepare("SELECT id FROM theses WHERE id = ? AND student_id = ?");
        $check->execute([$thesis_id, $user_id]);
        if (!$check->fetch()) { echo json_encode(['success' => false, 'error' => 'Unauthorized']); exit; }

        if (isset($_FILES['draft_file']) && $_FILES['draft_file']['error'] === UPLOAD_ERR_OK) {
            $ext = pathinfo($_FILES['draft_file']['name'], PATHINFO_EXTENSION);
            $timestamp = date('Ymd-Hi'); $randomHash = substr(uniqid(), -5);
            $newFileName = "DRAFT_thesis{$thesis_id}_{$timestamp}_{$randomHash}." . $ext;
            if (move_uploaded_file($_FILES['draft_file']['tmp_name'], '../public/uploads/' . $newFileName)) {
                $pdo->prepare("UPDATE theses SET draft_file_path = ? WHERE id = ?")->execute([$newFileName, $thesis_id]);
                echo json_encode(['success' => true, 'file_path' => $newFileName]);
            } else echo json_encode(['success' => false, 'error' => 'Upload failed']);
        } else echo json_encode(['success' => false, 'error' => 'No file']);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'save_links') {
        $data = json_decode(file_get_contents('php://input'), true);
        $check = $pdo->prepare("SELECT id FROM theses WHERE id = ? AND student_id = ?");
        $check->execute([$data['thesis_id'], $user_id]);
        if (!$check->fetch()) { echo json_encode(['success' => false, 'error' => 'Unauthorized']); exit; }
        $pdo->prepare("UPDATE theses SET external_links = ? WHERE id = ?")->execute([$data['external_links'], $data['thesis_id']]);
        echo json_encode(['success' => true]); exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_available_instructors') {
        $supervisor_id = $_GET['supervisor_id'] ?? 0;
        $stmt = $pdo->prepare("SELECT id, first_name, last_name FROM users WHERE role = 'instructor' AND id != ? ORDER BY last_name ASC");
        $stmt->execute([$supervisor_id]); echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]); exit;
    }
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_thesis_invites') {
        $thesis_id = $_GET['thesis_id'] ?? 0;
        $stmt = $pdo->prepare("SELECT ci.id, ci.professor_id, ci.status, u.first_name, u.last_name FROM committee_invites ci JOIN users u ON ci.professor_id = u.id WHERE ci.thesis_id = ? ORDER BY ci.created_at DESC");
        $stmt->execute([$thesis_id]); echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]); exit;
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'send_invite') {
        $thesis_id = $_POST['thesis_id']; $prof_ids = $_POST['professor_ids'] ?? []; if (!is_array($prof_ids)) $prof_ids = [$prof_ids]; 
        $inserted_count = 0;
        foreach ($prof_ids as $prof_id) {
            if(empty($prof_id)) continue;
            $dup = $pdo->prepare("SELECT id FROM committee_invites WHERE thesis_id = ? AND professor_id = ? AND status != 'rejected'");
            $dup->execute([$thesis_id, $prof_id]);
            if (!$dup->fetch()) {
                if($pdo->prepare("INSERT INTO committee_invites (thesis_id, professor_id) VALUES (?, ?)")->execute([$thesis_id, $prof_id])) $inserted_count++;
            }
        }
        echo json_encode(['success' => true, 'message' => "$inserted_count invites sent."]); exit;
    }
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_profile') {
        $stmt = $pdo->prepare("SELECT u.first_name, u.last_name, u.username, sp.* FROM users u LEFT JOIN student_profiles sp ON u.id = sp.user_id WHERE u.id = ?");
        $stmt->execute([$user_id]); $p = $stmt->fetch();
        if($p) { $p['email_to_show'] = !empty($p['contact_email']) ? $p['contact_email'] : $p['username']; echo json_encode(['success' => true, 'data' => $p]); } else echo json_encode(['success' => false]); exit;
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'update_profile') {
        $input = json_decode(file_get_contents('php://input'), true);
        $pdo->prepare("UPDATE student_profiles SET contact_email=?, address=?, phone_mobile=?, phone_landline=? WHERE user_id=?")->execute([$input['email']??'', $input['address']??'', $input['mobile']??'', $input['landline']??'', $user_id]);
        echo json_encode(['success' => true]); exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>