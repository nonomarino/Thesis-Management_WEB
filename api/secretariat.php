<?php
// api/secretariat.php
session_start();
header('Content-Type: application/json');
require 'db.php';

// 1. Security Check
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'secretariat') {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$action = $_GET['action'] ?? '';

try {

    // LIST THESES (Active or Under Examination)
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list_theses') {
        $stmt = $pdo->prepare("
            SELECT t.id, t.title, t.status, t.assigned_at,
                   u.first_name as student_first, u.last_name as student_last, sp.student_am,
                   s.first_name as sup_first, s.last_name as sup_last
            FROM theses t
            LEFT JOIN users u ON t.student_id = u.id
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN users s ON t.supervisor_id = s.id
            WHERE t.status IN ('active', 'under_examination')
            ORDER BY t.assigned_at DESC
        ");
        $stmt->execute();
        $theses = $stmt->fetchAll();

        // Calculate Time Elapsed
        foreach ($theses as &$t) {
            $t['time_elapsed'] = '-';
            if ($t['assigned_at']) {
                $diff = (new DateTime($t['assigned_at']))->diff(new DateTime());
                $t['time_elapsed'] = ($diff->y > 0 ? $diff->y.' έτη, ' : '') . $diff->m . ' μήνες';
            }
        }

        echo json_encode(['success' => true, 'data' => $theses]);
        exit;
    }

    // GET DETAILS
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_thesis_details') {
        $id = $_GET['id'] ?? 0;
        $stmt = $pdo->prepare("
            SELECT t.*, 
                   u.first_name as student_first, u.last_name as student_last, sp.student_am
            FROM theses t
            LEFT JOIN users u ON t.student_id = u.id
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            WHERE t.id = ?
        ");
        $stmt->execute([$id]);
        $thesis = $stmt->fetch();
        
        echo json_encode(['success' => true, 'thesis' => $thesis]);
        exit;
    }

    // UPDATE PROTOCOL (ΑΠ ΓΣ)
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'update_protocol') {
        $in = json_decode(file_get_contents('php://input'), true);
        
        // Ensure column exists or handle generically (assuming column exists based on requirement)
        // Note: You might need to add `general_assembly_protocol` column to your DB if not there.
        // SQL: ALTER TABLE theses ADD COLUMN general_assembly_protocol VARCHAR(50) NULL;
        
        $stmt = $pdo->prepare("UPDATE theses SET general_assembly_protocol = ? WHERE id = ?");
        $stmt->execute([$in['protocol'], $in['id']]);
        echo json_encode(['success' => true]);
        exit;
    }

    // CANCEL ASSIGNMENT
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'cancel_assignment') {
        $in = json_decode(file_get_contents('php://input'), true);
        $reason = "Ακύρωση από Γραμματεία. Απόφαση ΓΣ: " . $in['ga_info'];

        // Reset to available, remove student, log reason
        // Assuming there is a field for log or just status change
        // We will simple unassign.
        
        $stmt = $pdo->prepare("
            UPDATE theses 
            SET student_id = NULL, status = 'available', assigned_at = NULL,
                description = CONCAT(description, '\n[ΙΣΤΟΡΙΚΟ: ', ? , ']') 
            WHERE id = ?
        ");
        $stmt->execute([$reason, $in['id']]);
        echo json_encode(['success' => true]);
        exit;
    }

    // FINALIZE THESIS
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'finalize_thesis') {
        $in = json_decode(file_get_contents('php://input'), true);
        
        // Double check conditions server-side
        $chk = $pdo->prepare("SELECT final_grade, repository_link FROM theses WHERE id = ?");
        $chk->execute([$in['id']]);
        $t = $chk->fetch();

        if (!$t['final_grade'] || !$t['repository_link']) {
            echo json_encode(['success' => false, 'error' => 'Missing grade or repo link']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE theses SET status = 'completed' WHERE id = ?");
        $stmt->execute([$in['id']]);
        echo json_encode(['success' => true]);
        exit;
    }

    // IMPORT DATA (Simple Implementation)
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'import_data') {
        if (!isset($_FILES['json_file'])) throw new Exception("No file uploaded");
        
        $json = file_get_contents($_FILES['json_file']['tmp_name']);
        $data = json_decode($json, true);

        if (!$data) throw new Exception("Invalid JSON");

        // Example JSON structure expectation: [{"role": "student", "email": "...", "first": "...", "last": "..."}]
        $pwd = password_hash("12345", PASSWORD_DEFAULT);
        $count = 0;

        foreach ($data as $user) {
            // Basic insert logic - adapt to your JSON structure
            if (isset($user['email']) && isset($user['role'])) {
                $stmt = $pdo->prepare("INSERT IGNORE INTO users (username, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$user['email'], $pwd, $user['first_name']??'', $user['last_name']??'', $user['role']]);
                $count++;
            }
        }

        echo json_encode(['success' => true, 'count' => $count]);
        exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>