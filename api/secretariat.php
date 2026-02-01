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

    // =================================================================================
    // 1. LIST THESES (Active & Under Examination)
    // =================================================================================
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

        // Calculate simple time elapsed string
        foreach ($theses as &$t) {
            $t['time_elapsed'] = '-';
            if ($t['assigned_at']) {
                $d1 = new DateTime($t['assigned_at']);
                $d2 = new DateTime();
                $diff = $d1->diff($d2);
                
                if ($diff->y > 0) $t['time_elapsed'] = $diff->y . ' έτη, ' . $diff->m . ' μήνες';
                elseif ($diff->m > 0) $t['time_elapsed'] = $diff->m . ' μήνες, ' . $diff->d . ' μέρες';
                else $t['time_elapsed'] = $diff->d . ' ημέρες';
            }
        }

        echo json_encode(['success' => true, 'data' => $theses]);
        exit;
    }

    // =================================================================================
    // 2. GET DETAILS (For Modal) - UPDATED
    // =================================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_thesis_details') {
        $id = $_GET['id'] ?? 0;
        
        // A. Basic Info (Thesis + Student + Supervisor)
        // Fetches repository_link, description, final_grade etc. via t.*
        $stmt = $pdo->prepare("
            SELECT t.*, 
                   u.first_name as student_first, u.last_name as student_last, u.username as student_email, sp.student_am,
                   s.first_name as sup_first, s.last_name as sup_last
            FROM theses t
            LEFT JOIN users u ON t.student_id = u.id
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN users s ON t.supervisor_id = s.id
            WHERE t.id = ?
        ");
        $stmt->execute([$id]);
        $thesis = $stmt->fetch();

        if (!$thesis) {
            echo json_encode(['success' => false, 'error' => 'Not found']);
            exit;
        }

        // B. Committee Members (The 2 other members)
        // Fetching from 'committee_members' table using 'professor_id'
        $committee = [];
        try {
            $stmt = $pdo->prepare("
                SELECT u.first_name, u.last_name 
                FROM committee_members cm 
                JOIN users u ON cm.professor_id = u.id 
                WHERE cm.thesis_id = ?
            ");
            $stmt->execute([$id]);
            $committee = $stmt->fetchAll();
        } catch (Exception $e) { 
            // Table might be empty or missing
        }

        // C. Exact Time Elapsed Calculation
        $timeElapsed = 'Μη διαθέσιμο';
        if ($thesis['assigned_at']) {
            $d1 = new DateTime($thesis['assigned_at']);
            $d2 = new DateTime();
            $diff = $d1->diff($d2);
            $timeElapsed = "";
            if ($diff->y > 0) $timeElapsed .= $diff->y . " έτη, ";
            if ($diff->m > 0) $timeElapsed .= $diff->m . " μήνες, ";
            $timeElapsed .= $diff->d . " ημέρες";
        }
        $thesis['time_elapsed_txt'] = $timeElapsed;

        echo json_encode([
            'success' => true, 
            'thesis' => $thesis, 
            'committee' => $committee 
        ]);
        exit;
    }

    // =================================================================================
    // 3. ACTIONS
    // =================================================================================
    
    // Update Protocol (Α.Π.)
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'update_protocol') {
        $in = json_decode(file_get_contents('php://input'), true);
        if (empty($in['protocol'])) { echo json_encode(['success'=>false]); exit; }
        
        $stmt = $pdo->prepare("UPDATE theses SET general_assembly_protocol = ? WHERE id = ?");
        $stmt->execute([$in['protocol'], $in['id']]);
        echo json_encode(['success' => true]);
        exit;
    }

    // Cancel Assignment
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'cancel_assignment') {
        $in = json_decode(file_get_contents('php://input'), true);
        $reason = "Ακύρωση από Γραμματεία. Απόφαση ΓΣ: " . ($in['ga_info'] ?? '-');
        
        $pdo->prepare("
            UPDATE theses 
            SET student_id = NULL, status = 'available', assigned_at = NULL, 
                description = CONCAT(description, '\n[CANCELED: ', ?, ']') 
            WHERE id = ?
        ")->execute([$reason, $in['id']]);
        
        // Clear committee members and invites
        $pdo->prepare("DELETE FROM committee_members WHERE thesis_id = ?")->execute([$in['id']]);
        $pdo->prepare("DELETE FROM committee_invites WHERE thesis_id = ?")->execute([$in['id']]);
        
        echo json_encode(['success' => true]);
        exit;
    }

    // Finalize (Set to Completed)
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'finalize_thesis') {
        $in = json_decode(file_get_contents('php://input'), true);
        
        // Optional Check: Ensure Grade and Link exist before finalizing
        $chk = $pdo->prepare("SELECT final_grade, repository_link FROM theses WHERE id = ?");
        $chk->execute([$in['id']]);
        $t = $chk->fetch();
        
        if (empty($t['final_grade']) || empty($t['repository_link'])) {
            echo json_encode(['success' => false, 'error' => 'Λείπει βαθμός ή σύνδεσμος Νημερτής.']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE theses SET status = 'completed' WHERE id = ?");
        $stmt->execute([$in['id']]);
        echo json_encode(['success' => true]);
        exit;
    }

    // Import Data
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'import_data') {
        if (!isset($_FILES['json_file'])) throw new Exception("No file");
        $json = file_get_contents($_FILES['json_file']['tmp_name']);
        $data = json_decode($json, true);
        if (!$data) throw new Exception("Invalid JSON");

        $pwd = password_hash("12345", PASSWORD_DEFAULT);
        $cnt = 0;
        foreach ($data as $u) {
            if (isset($u['email'], $u['role'])) {
                $stmt = $pdo->prepare("INSERT IGNORE INTO users (username, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$u['email'], $pwd, $u['first_name']??'', $u['last_name']??'', $u['role']]);
                $cnt++;
            }
        }
        echo json_encode(['success' => true, 'count' => $cnt]);
        exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>