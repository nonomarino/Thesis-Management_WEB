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
    // ACTION: Get My Thesis Details (ΠΡΟΒΟΛΗ ΘΕΜΑΤΟΣ)
    // =========================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_my_thesis') {
        
        // 1. Fetch Thesis & Supervisor
        $stmt = $pdo->prepare("
            SELECT t.id, t.title, t.description, t.status, t.assigned_at, t.file_path,
                   u.first_name AS sup_first, u.last_name AS sup_last
            FROM theses t
            LEFT JOIN users u ON t.supervisor_id = u.id
            WHERE t.student_id = ?
            LIMIT 1
        ");
        $stmt->execute([$user_id]);
        $thesis = $stmt->fetch();

        if (!$thesis) {
            echo json_encode(['success' => true, 'thesis' => null]);
            exit;
        }

        // 2. Fetch Committee Members
        $stmtComm = $pdo->prepare("
            SELECT u.first_name, u.last_name
            FROM committee_members cm
            JOIN users u ON cm.professor_id = u.id
            WHERE cm.thesis_id = ?
        ");
        $stmtComm->execute([$thesis['id']]);
        $committee = $stmtComm->fetchAll();

        // 3. Calculate Time Elapsed (Χρόνος από ανάθεση)
        $time_str = '-';
        if ($thesis['assigned_at']) {
            $start = new DateTime($thesis['assigned_at']);
            $now   = new DateTime();
            $diff  = $start->diff($now);

            // Create string like "0 έτη, 3 μήνες, 12 ημέρες"
            $parts = [];
            if ($diff->y > 0) $parts[] = $diff->y . ' έτη';
            if ($diff->m > 0) $parts[] = $diff->m . ' μήνες';
            $parts[] = $diff->d . ' ημέρες'; // Always show days
            
            $time_str = implode(', ', $parts);
        }

        echo json_encode([
            'success'      => true,
            'thesis'       => $thesis,
            'committee'    => $committee,
            'time_elapsed' => $time_str
        ]);
        exit;
    }

    // ... (Τα υπόλοιπα actions: get_profile, update_profile παραμένουν ίδια) ...
    // Αν θέλεις να στα ξαναγράψω πες μου, αλλιώς κράτα τα όπως ήταν στο προηγούμενο.
    
    // =========================================================================
    // ACTION: Get Profile Data (Copy-Paste από πριν για να είναι πλήρες το αρχείο)
    // =========================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_profile') {
        $stmt = $pdo->prepare("
            SELECT u.first_name, u.last_name, u.username,
                   sp.student_am, sp.address, sp.phone_mobile, sp.phone_landline, sp.contact_email
            FROM users u
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            WHERE u.id = ?
        ");
        $stmt->execute([$user_id]);
        $profile = $stmt->fetch();

        if ($profile) {
            $display_email = !empty($profile['contact_email']) ? $profile['contact_email'] : $profile['username'];
            $profile['email_to_show'] = $display_email;
            echo json_encode(['success' => true, 'data' => $profile]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Profile not found']);
        }
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'update_profile') {
        $input = json_decode(file_get_contents('php://input'), true);
        $email = $input['email'] ?? '';
        $address = $input['address'] ?? '';
        $mobile = $input['mobile'] ?? '';
        $landline = $input['landline'] ?? '';

        $stmtProfile = $pdo->prepare("UPDATE student_profiles SET contact_email=?, address=?, phone_mobile=?, phone_landline=? WHERE user_id=?");
        try {
            $stmtProfile->execute([$email, $address, $mobile, $landline, $user_id]);
            echo json_encode(['success' => true]);
        } catch (Exception $ex) {
            echo json_encode(['success' => false, 'error' => $ex->getMessage()]);
        }
        exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>