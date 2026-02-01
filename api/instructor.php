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
            SELECT t.id, t.title, t.description, t.status, t.created_at, t.file_path, t.student_id,
                   u.first_name, u.last_name
            FROM theses t
            LEFT JOIN users u ON t.student_id = u.id
            WHERE t.supervisor_id = ? 
            ORDER BY t.created_at DESC
        ");
        $stmt->execute([$user_id]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        exit;
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'create_topic') {
        $title = $_POST['title'] ?? '';
        $desc  = $_POST['description'] ?? '';
        $filePath = null;

        if (isset($_FILES['pdf_file']) && $_FILES['pdf_file']['error'] === UPLOAD_ERR_OK) {
            $newFileName = uniqid('thesis_') . '.pdf';
            if (!is_dir('../public/uploads/')) mkdir('../public/uploads/', 0777, true);
            if (move_uploaded_file($_FILES['pdf_file']['tmp_name'], '../public/uploads/' . $newFileName)) {
                $filePath = $newFileName;
            }
        }

        $stmt = $pdo->prepare("INSERT INTO theses (title, description, supervisor_id, file_path, status) VALUES (?, ?, ?, ?, 'available')");
        $stmt->execute([$title, $desc, $user_id, $filePath]);
        echo json_encode(['success' => true]);
        exit;
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'update_topic') {
        $id = $_POST['id'] ?? '';
        $title = $_POST['title'] ?? '';
        $desc  = $_POST['description'] ?? '';
        
        if (isset($_FILES['pdf_file']) && $_FILES['pdf_file']['error'] === UPLOAD_ERR_OK) {
            $newFileName = uniqid('thesis_') . '.pdf';
            if (move_uploaded_file($_FILES['pdf_file']['tmp_name'], '../public/uploads/' . $newFileName)) {
                $stmt = $pdo->prepare("UPDATE theses SET title = ?, description = ?, file_path = ? WHERE id = ? AND supervisor_id = ?");
                $stmt->execute([$title, $desc, $newFileName, $id, $user_id]);
            }
        } else {
            $stmt = $pdo->prepare("UPDATE theses SET title = ?, description = ? WHERE id = ? AND supervisor_id = ?");
            $stmt->execute([$title, $desc, $id, $user_id]);
        }
        echo json_encode(['success' => true]);
        exit;
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'delete_topic') {
        $id = $_POST['id'] ?? '';
        $stmt = $pdo->prepare("DELETE FROM theses WHERE id = ? AND supervisor_id = ?");
        $stmt->execute([$id, $user_id]);
        echo json_encode(['success' => true]);
        exit;
    }

    // =================================================================================
    // SECTION 2: ASSIGNMENT LOGIC
    // =================================================================================
    elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_available_topics') {
        $stmt = $pdo->prepare("SELECT id, title FROM theses WHERE supervisor_id = ? AND (student_id IS NULL OR status = 'available')");
        $stmt->execute([$user_id]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        exit;
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'search_student') {
        $term = $_GET['term'] ?? '';
        $stmt = $pdo->prepare("
            SELECT u.id, u.first_name, u.last_name, u.username as email, sp.student_am
            FROM users u
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            WHERE u.role = 'student' AND (u.last_name LIKE ? OR u.first_name LIKE ? OR sp.student_am LIKE ?)
            LIMIT 10
        ");
        $likeTerm = "%$term%";
        $stmt->execute([$likeTerm, $likeTerm, $likeTerm]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        exit;
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'assign_topic') {
        $thesis_id = $_POST['thesis_id'];
        $student_id = $_POST['student_id'];
        
        $update = $pdo->prepare("UPDATE theses SET student_id = ?, status = 'assigned', assigned_at = NOW() WHERE id = ? AND supervisor_id = ?");
        $update->execute([$student_id, $thesis_id, $user_id]);

        if ($update->rowCount() > 0) {
            $pdo->prepare("INSERT INTO thesis_logs (thesis_id, action) VALUES (?, 'Assigned to student by Instructor')")->execute([$thesis_id]);
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Assignment failed.']);
        }
        exit;
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'revoke_assignment') {
        $thesis_id = $_POST['thesis_id'];
        $stmt = $pdo->prepare("UPDATE theses SET student_id = NULL, status='available', assigned_at = NULL WHERE id = ? AND supervisor_id = ?");
        $stmt->execute([$thesis_id, $user_id]);
        $pdo->prepare("INSERT INTO thesis_logs (thesis_id, action) VALUES (?, 'Assignment revoked by Instructor')")->execute([$thesis_id]);
        echo json_encode(['success' => true]);
        exit;
    }

    // =================================================================================
    // SECTION 3: LIST ALL THESES & DETAILS
    // =================================================================================
    elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list_all_theses') {
        $roleFilter = $_GET['role'] ?? 'all';
        $statusFilter = $_GET['status'] ?? 'all';
        
        // Updated to include committee_invites in the check for 'member' role
        $sql = "
            SELECT DISTINCT t.id, t.title, t.status, t.final_grade, t.created_at,
                   u.first_name as student_name, u.last_name as student_surname,
                   CASE 
                       WHEN t.supervisor_id = :uid1 THEN 'supervisor' 
                       ELSE 'member' 
                   END as my_role
            FROM theses t
            LEFT JOIN users u ON t.student_id = u.id
            LEFT JOIN committee_invites ci ON t.id = ci.thesis_id
            WHERE (t.supervisor_id = :uid2 OR (ci.professor_id = :uid3 AND ci.status = 'accepted'))
        ";

        if ($statusFilter !== 'all') {
            $sql .= " AND t.status = :status ";
        }
        
        if ($roleFilter === 'supervisor') {
            $sql .= " AND t.supervisor_id = :uid4 ";
        } elseif ($roleFilter === 'member') {
            $sql .= " AND ci.professor_id = :uid5 ";
        }

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
        exit;
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_thesis_details') {
        $tid = $_GET['id'] ?? 0;
        
        // 1. Thesis Info
        $stmt = $pdo->prepare("
            SELECT t.id, t.title, t.description, t.status, t.final_grade, t.repository_link, t.created_at,
                   u.first_name as student_first, u.last_name as student_last, u.username as student_email,
                   sup.first_name as sup_first, sup.last_name as sup_last
            FROM theses t
            LEFT JOIN users u ON t.student_id = u.id
            LEFT JOIN users sup ON t.supervisor_id = sup.id
            WHERE t.id = ?
        ");
        $stmt->execute([$tid]);
        $thesis = $stmt->fetch();
        
        if (!$thesis) {
            echo json_encode(['success' => false, 'error' => 'Not found']);
            exit;
        }

        // 2. Committee Info (From committee_invites where accepted)
        $stmt = $pdo->prepare("
            SELECT u.first_name, u.last_name, u.username as email, ci.status as invitation_status
            FROM committee_invites ci
            JOIN users u ON ci.professor_id = u.id
            WHERE ci.thesis_id = ? AND ci.status != 'cancelled'
        ");
        $stmt->execute([$tid]);
        $committee = $stmt->fetchAll();
        
        // 3. Logs
        $stmt = $pdo->prepare("SELECT action, timestamp FROM thesis_logs WHERE thesis_id = ? ORDER BY timestamp DESC");
        $stmt->execute([$tid]);
        $logs = $stmt->fetchAll();
        
        echo json_encode([
            'success' => true, 
            'thesis' => $thesis, 
            'committee' => $committee, 
            'logs' => $logs
        ]);
        exit;
    }

    // =================================================================================
    // SECTION 4: INVITATIONS (Handling Student Choices)
    // =================================================================================
    elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list_pending_invites') {
        // Fetch invites from 'committee_invites' table
        $stmt = $pdo->prepare("
            SELECT ci.id as invite_id, ci.created_at as invitation_date, 
                   t.title, u.first_name, u.last_name
            FROM committee_invites ci
            JOIN theses t ON ci.thesis_id = t.id
            LEFT JOIN users u ON t.student_id = u.id
            WHERE ci.professor_id = ? AND ci.status = 'pending'
        ");
        $stmt->execute([$user_id]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        exit;
    }

    elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'respond_invite') {
        $inviteId = $_POST['invite_id'];
        $response = $_POST['response']; // 'accepted' or 'rejected'

        // Update the status in committee_invites
        $stmt = $pdo->prepare("UPDATE committee_invites SET status = ? WHERE id = ? AND professor_id = ?");
        $stmt->execute([$response, $inviteId, $user_id]);

        // Logic: If accepted, check if committee is full (2 members)
        if ($response === 'accepted') {
            $stmt = $pdo->prepare("SELECT thesis_id FROM committee_invites WHERE id = ?");
            $stmt->execute([$inviteId]);
            $thesisId = $stmt->fetchColumn();

            // Count accepted invites for this thesis
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM committee_invites WHERE thesis_id = ? AND status = 'accepted'");
            $stmt->execute([$thesisId]);
            $count = $stmt->fetchColumn();

            // Rule: If 2 members accepted -> Activate Thesis
            if ($count >= 2) {
                // 1. Set Status to Active
                $pdo->prepare("UPDATE theses SET status = 'active', activated_at = NOW() WHERE id = ?")->execute([$thesisId]);
                
                // 2. Log Action
                $pdo->prepare("INSERT INTO thesis_logs (thesis_id, action) VALUES (?, 'Thesis Activated (Committee Filled)')")->execute([$thesisId]);
                
                // 3. Cancel any other pending invites for this thesis
                $pdo->prepare("UPDATE committee_invites SET status = 'cancelled' WHERE thesis_id = ? AND status = 'pending'")->execute([$thesisId]);
                
                // 4. (Optional) Sync to committee_members table if your DB uses it separately
                $pdo->prepare("INSERT INTO committee_members (thesis_id, professor_id) SELECT thesis_id, professor_id FROM committee_invites WHERE thesis_id = ? AND status = 'accepted'")->execute([$thesisId]);
            }
        }
        echo json_encode(['success' => true]);
        exit;
    }

    // =================================================================================
    // SECTION 5: STATS
    // =================================================================================
    elseif ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_stats') {
        $stmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total_count,
                AVG(CASE WHEN status = 'completed' THEN final_grade ELSE NULL END) as avg_grade
            FROM theses 
            WHERE supervisor_id = ?
        ");
        $stmt->execute([$user_id]);
        $statsSupervisor = $stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'supervisor' => [
                'count' => (int)$statsSupervisor['total_count'],
                'grade' => round((float)$statsSupervisor['avg_grade'], 2)
            ]
        ]);
        exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>