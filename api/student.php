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
    // ACTION: Get My Thesis Details
    // =========================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_my_thesis') {
        
        $stmt = $pdo->prepare("
            SELECT t.id, t.title, t.description, t.status, t.assigned_at, t.file_path, t.supervisor_id,
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

        $stmtComm = $pdo->prepare("
            SELECT u.first_name, u.last_name
            FROM committee_members cm
            JOIN users u ON cm.professor_id = u.id
            WHERE cm.thesis_id = ?
        ");
        $stmtComm->execute([$thesis['id']]);
        $committee = $stmtComm->fetchAll();

        // Time Calculation
        $time_str = '-';
        if ($thesis['assigned_at']) {
            $start = new DateTime($thesis['assigned_at']);
            $now   = new DateTime();
            $diff  = $start->diff($now);
            
            if ($diff->y == 0 && $diff->m == 0 && $diff->d == 0) {
                if ($diff->h == 0) {
                    $suffix = ($diff->i == 1) ? ' λεπτό' : ' λεπτά';
                    $time_str = $diff->i . $suffix;
                } else {
                    $suffix = ($diff->h == 1) ? ' ώρα' : ' ώρες';
                    $time_str = $diff->h . $suffix;
                }
            } else {
                $parts = [];
                if ($diff->y > 0) {
                    $suffix = ($diff->y == 1) ? ' έτος' : ' έτη';
                    $parts[] = $diff->y . $suffix;
                }
                if ($diff->m > 0) {
                    $suffix = ($diff->m == 1) ? ' μήνας' : ' μήνες';
                    $parts[] = $diff->m . $suffix;
                }
                $suffix = ($diff->d == 1) ? ' ημέρα' : ' ημέρες';
                $parts[] = $diff->d . $suffix;
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
    // ACTION: Get Available Instructors
    // =========================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_available_instructors') {
        $supervisor_id = $_GET['supervisor_id'] ?? 0;
        $stmt = $pdo->prepare("SELECT id, first_name, last_name FROM users WHERE role = 'instructor' AND id != ? ORDER BY last_name ASC");
        $stmt->execute([$supervisor_id]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        exit;
    }

    // =========================================================================
    // ACTION: Get Thesis Invites
    // =========================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_thesis_invites') {
        $thesis_id = $_GET['thesis_id'] ?? 0;
        $stmt = $pdo->prepare("
            SELECT ci.id, ci.professor_id, ci.status, u.first_name, u.last_name
            FROM committee_invites ci
            JOIN users u ON ci.professor_id = u.id
            WHERE ci.thesis_id = ?
            ORDER BY ci.created_at DESC
        ");
        $stmt->execute([$thesis_id]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        exit;
    }

    // =========================================================================
    // ACTION: Send Invites (UPDATED FOR MULTIPLE)
    // =========================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'send_invite') {
        $thesis_id = $_POST['thesis_id'];
        
        // Handle both array (multiple) and string (single) input for robustness
        $prof_ids = $_POST['professor_ids'] ?? [];
        if (!is_array($prof_ids)) {
            // Fallback if frontend sends a single ID not as array
            $prof_ids = [$prof_ids]; 
        }

        // 1. Verify ownership
        $check = $pdo->prepare("SELECT id FROM theses WHERE id = ? AND student_id = ?");
        $check->execute([$thesis_id, $user_id]);
        if (!$check->fetch()) {
            echo json_encode(['success' => false, 'error' => 'Unauthorized action']);
            exit;
        }

        $inserted_count = 0;
        
        // 2. Loop through selected professors
        foreach ($prof_ids as $prof_id) {
            // Skip empty values
            if(empty($prof_id)) continue;

            // Check if already invited (to avoid duplicates)
            $dup = $pdo->prepare("SELECT id FROM committee_invites WHERE thesis_id = ? AND professor_id = ? AND status != 'rejected'");
            $dup->execute([$thesis_id, $prof_id]);
            
            if (!$dup->fetch()) {
                // Insert Invite
                $stmt = $pdo->prepare("INSERT INTO committee_invites (thesis_id, professor_id) VALUES (?, ?)");
                if($stmt->execute([$thesis_id, $prof_id])) {
                    $inserted_count++;
                }
            }
        }

        if ($inserted_count > 0) {
            echo json_encode(['success' => true, 'message' => "$inserted_count προσκλήσεις στάλθηκαν."]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Δεν στάλθηκαν προσκλήσεις (ίσως υπάρχουν ήδη).']);
        }
        exit;
    }

    // =========================================================================
    // ACTION: Get/Update Profile (Standard)
    // =========================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_profile') {
        $stmt = $pdo->prepare("SELECT u.first_name, u.last_name, u.username, sp.* FROM users u LEFT JOIN student_profiles sp ON u.id = sp.user_id WHERE u.id = ?");
        $stmt->execute([$user_id]);
        $profile = $stmt->fetch();
        if($profile) {
            $profile['email_to_show'] = !empty($profile['contact_email']) ? $profile['contact_email'] : $profile['username'];
            echo json_encode(['success' => true, 'data' => $profile]);
        } else echo json_encode(['success' => false]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'update_profile') {
        $input = json_decode(file_get_contents('php://input'), true);
        $stmt = $pdo->prepare("UPDATE student_profiles SET contact_email=?, address=?, phone_mobile=?, phone_landline=? WHERE user_id=?");
        $stmt->execute([$input['email']??'', $input['address']??'', $input['mobile']??'', $input['landline']??'', $user_id]);
        echo json_encode(['success' => true]);
        exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>