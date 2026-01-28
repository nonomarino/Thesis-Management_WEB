<?php
// api/instructor.php
session_start();
header('Content-Type: application/json');
require 'db.php';

// 1. Security Check
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'instructor') {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$user_id = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

try {
    // =================================================================================
    // SECTION 1: TOPIC MANAGEMENT
    // =================================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list_my_topics') {
        $stmt = $pdo->prepare("
            SELECT t.id, t.title, t.description, t.status, t.created_at, 
                   u.first_name, u.last_name
            FROM theses t
            LEFT JOIN users u ON t.student_id = u.id
            WHERE t.supervisor_id = ? 
            ORDER BY t.created_at DESC
        ");
        $stmt->execute([$user_id]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'create_topic') {
        $title = $_POST['title'] ?? '';
        $desc  = $_POST['description'] ?? '';
        $pdfPath = null;
        
        if (isset($_FILES['pdf_file']) && $_FILES['pdf_file']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = '../public/uploads/';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
            $filename = time() . '_' . basename($_FILES['pdf_file']['name']);
            if (move_uploaded_file($_FILES['pdf_file']['tmp_name'], $uploadDir . $filename)) {
                $pdfPath = 'uploads/' . $filename;
            }
        }
        
        if (empty($title)) throw new Exception("Title is required");
        
        $stmt = $pdo->prepare("INSERT INTO theses (supervisor_id, title, description, pdf_path, status) VALUES (?, ?, ?, ?, 'available')");
        $stmt->execute([$user_id, $title, $desc, $pdfPath]);
        echo json_encode(['success' => true]);
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'update_topic') {
        $id = $_POST['topic_id'] ?? null;
        $title = $_POST['title'] ?? '';
        $desc  = $_POST['description'] ?? '';
        
        if (!$id) throw new Exception("ID missing");
        
        $stmt = $pdo->prepare("UPDATE theses SET title = ?, description = ? WHERE id = ? AND supervisor_id = ?");
        $stmt->execute([$title, $desc, $id, $user_id]);
        echo json_encode(['success' => true]);
    }

    // =================================================================================
    // SECTION 2: ASSIGNMENT LOGIC
    // =================================================================================
    elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list_assignable_topics') {
        $stmt = $pdo->prepare("SELECT id, title FROM theses WHERE supervisor_id = ? AND status = 'available'");
        $stmt->execute([$user_id]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'search_student') {
        $q = $_GET['q'] ?? '';
        if (strlen($q) < 2) { echo json_encode(['success' => true, 'data' => []]); exit; }
        
        $term = "%$q%";
        $stmt = $pdo->prepare("
            SELECT u.id, u.first_name, u.last_name, sp.student_am 
            FROM users u 
            LEFT JOIN student_profiles sp ON u.id = sp.user_id 
            WHERE u.role = 'student' 
            AND (u.last_name LIKE ? OR u.first_name LIKE ? OR sp.student_am LIKE ?)
            LIMIT 10
        ");
        $stmt->execute([$term, $term, $term]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'assign_student') {
        $input = json_decode(file_get_contents('php://input'), true);
        $thesisId = $input['thesis_id'];
        $studentId = $input['student_id'];
        
        $check = $pdo->prepare("SELECT id FROM theses WHERE student_id = ? AND status != 'cancelled'");
        $check->execute([$studentId]);
        if ($check->rowCount() > 0) throw new Exception("Student already assigned.");
        
        $stmt = $pdo->prepare("UPDATE theses SET student_id = ?, status = 'under_assignment', assigned_at = NOW() WHERE id = ? AND supervisor_id = ? AND status = 'available'");
        $stmt->execute([$studentId, $thesisId, $user_id]);
        
        if ($stmt->rowCount() === 0) throw new Exception("Assignment failed.");
        echo json_encode(['success' => true]);
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'unassign_student') {
        $input = json_decode(file_get_contents('php://input'), true);
        $thesisId = $input['thesis_id'];
        
        $stmt = $pdo->prepare("UPDATE theses SET student_id = NULL, status = 'available', assigned_at = NULL WHERE id = ? AND supervisor_id = ? AND status = 'under_assignment'");
        $stmt->execute([$thesisId, $user_id]);
        
        if ($stmt->rowCount() === 0) throw new Exception("Cancel failed.");
        echo json_encode(['success' => true]);
    }

    // =================================================================================
    // SECTION 3: FULL LIST & DETAILS
    // =================================================================================
    elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list_all_theses') {
        $roleFilter = $_GET['role'] ?? 'all';
        $statusFilter = $_GET['status'] ?? 'all';
        
        $sql = "
            SELECT DISTINCT t.id, t.title, t.status, t.final_grade, t.created_at,
                   u.first_name as student_name, u.last_name as student_surname,
                   CASE WHEN t.supervisor_id = :uid1 THEN 'supervisor' ELSE 'member' END as my_role
            FROM theses t
            LEFT JOIN users u ON t.student_id = u.id
            LEFT JOIN committee_members cm ON t.id = cm.thesis_id
            WHERE (t.supervisor_id = :uid2 OR cm.professor_id = :uid3)
        ";
        
        if ($statusFilter !== 'all') $sql .= " AND t.status = :status ";
        
        if ($roleFilter === 'supervisor') $sql .= " AND t.supervisor_id = :uid4 ";
        elseif ($roleFilter === 'member') $sql .= " AND cm.professor_id = :uid5 ";
        
        $sql .= " ORDER BY t.created_at DESC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':uid1', $user_id); 
        $stmt->bindValue(':uid2', $user_id); 
        $stmt->bindValue(':uid3', $user_id);
        
        if ($statusFilter !== 'all') $stmt->bindValue(':status', $statusFilter);
        if ($roleFilter === 'supervisor') $stmt->bindValue(':uid4', $user_id);
        if ($roleFilter === 'member') $stmt->bindValue(':uid5', $user_id);
        
        $stmt->execute();
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_thesis_details') {
        $tid = $_GET['id'] ?? 0;
        
        // Thesis Info
        $stmt = $pdo->prepare("SELECT t.*, u.first_name, u.last_name, u.email as student_email, sup.first_name as sup_name, sup.last_name as sup_surname FROM theses t LEFT JOIN users u ON t.student_id = u.id JOIN users sup ON t.supervisor_id = sup.id WHERE t.id = ?");
        $stmt->execute([$tid]);
        $thesis = $stmt->fetch();
        if (!$thesis) throw new Exception("Thesis not found");
        
        // Committee
        $stmt = $pdo->prepare("SELECT u.first_name, u.last_name, u.email FROM committee_members cm JOIN users u ON cm.professor_id = u.id WHERE cm.thesis_id = ?");
        $stmt->execute([$tid]);
        $committee = $stmt->fetchAll();
        
        // Logs
        $stmt = $pdo->prepare("SELECT * FROM thesis_logs WHERE thesis_id = ? ORDER BY created_at DESC");
        $stmt->execute([$tid]);
        $logs = $stmt->fetchAll();
        
        echo json_encode(['success' => true, 'thesis' => $thesis, 'committee' => $committee, 'logs' => $logs]);
    }

    // =================================================================================
    // SECTION 4: INVITATIONS
    // =================================================================================
    elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list_pending_invites') {
        $stmt = $pdo->prepare("
            SELECT cm.id as invite_id, cm.invitation_date, 
                   t.title, u.first_name, u.last_name
            FROM committee_members cm
            JOIN theses t ON cm.thesis_id = t.id
            JOIN users u ON t.student_id = u.id
            WHERE cm.professor_id = ? AND cm.invitation_status = 'pending'
        ");
        $stmt->execute([$user_id]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'respond_invite') {
        $input = json_decode(file_get_contents('php://input'), true);
        $inviteId = $input['invite_id'];
        $response = $input['response']; // 'accepted' or 'rejected'

        $stmt = $pdo->prepare("UPDATE committee_members SET invitation_status = ?, response_date = NOW() WHERE id = ? AND professor_id = ?");
        $stmt->execute([$response, $inviteId, $user_id]);

        if ($stmt->rowCount() === 0) throw new Exception("Update failed.");

        // If Accepted, check if thesis should become active (2 members + supervisor)
        if ($response === 'accepted') {
            $stmt = $pdo->prepare("SELECT thesis_id FROM committee_members WHERE id = ?");
            $stmt->execute([$inviteId]);
            $thesisId = $stmt->fetchColumn();

            $stmt = $pdo->prepare("SELECT COUNT(*) FROM committee_members WHERE thesis_id = ? AND invitation_status = 'accepted'");
            $stmt->execute([$thesisId]);
            $count = $stmt->fetchColumn();

            if ($count >= 2) {
                $pdo->prepare("UPDATE theses SET status = 'active', activated_at = NOW() WHERE id = ?")->execute([$thesisId]);
            }
        }
        echo json_encode(['success' => true]);
    }

    // =================================================================================
    // SECTION 5: STATISTICS (Detailed Logic)
    // =================================================================================
    elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_statistics') {
        
        // A. Statistics as SUPERVISOR
        // i. Count, ii. Avg Grade (Completed only), iii. Avg Days (Completed only)
        // Note: Using DATEDIFF between submission and assignment
        $stmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total_count,
                AVG(CASE WHEN status = 'completed' THEN final_grade ELSE NULL END) as avg_grade,
                AVG(CASE 
                    WHEN status = 'completed' AND assigned_at IS NOT NULL 
                    THEN DATEDIFF(COALESCE((SELECT submitted_at FROM thesis_grades WHERE thesis_id = theses.id LIMIT 1), NOW()), assigned_at) 
                    ELSE NULL 
                END) as avg_days
            FROM theses 
            WHERE supervisor_id = ?
        ");
        $stmt->execute([$user_id]);
        $statsSupervisor = $stmt->fetch(PDO::FETCH_ASSOC);

        // B. Statistics as COMMITTEE MEMBER
        $stmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total_count,
                AVG(CASE WHEN t.status = 'completed' THEN t.final_grade ELSE NULL END) as avg_grade,
                AVG(CASE 
                    WHEN t.status = 'completed' AND t.assigned_at IS NOT NULL 
                    THEN DATEDIFF(COALESCE((SELECT submitted_at FROM thesis_grades WHERE thesis_id = t.id LIMIT 1), NOW()), t.assigned_at) 
                    ELSE NULL 
                END) as avg_days
            FROM committee_members cm
            JOIN theses t ON cm.thesis_id = t.id
            WHERE cm.professor_id = ?
        ");
        $stmt->execute([$user_id]);
        $statsMember = $stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'supervisor' => [
                'count' => (int)$statsSupervisor['total_count'],
                'grade' => round((float)$statsSupervisor['avg_grade'], 2),
                'days'  => round((float)$statsSupervisor['avg_days'], 1)
            ],
            'member' => [
                'count' => (int)$statsMember['total_count'],
                'grade' => round((float)$statsMember['avg_grade'], 2),
                'days'  => round((float)$statsMember['avg_days'], 1)
            ]
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>