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
    
    // ACTION: List my topics
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

    // ACTION: Create new topic
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

        $stmt = $pdo->prepare("INSERT INTO theses (title, description, supervisor_id, file_path) VALUES (?, ?, ?, ?)");
        $stmt->execute([$title, $desc, $user_id, $filePath]);
        echo json_encode(['success' => true]);
        exit;
    }

    // ACTION: Update existing topic
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

    // ACTION: Delete topic (NEW)
    elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'delete_topic') {
        $id = $_POST['id'] ?? '';

        // Check if topic exists and has no student assigned (optional safety check)
        $check = $pdo->prepare("SELECT status FROM theses WHERE id = ? AND supervisor_id = ?");
        $check->execute([$id, $user_id]);
        $topic = $check->fetch();

        if (!$topic) {
            echo json_encode(['success' => false, 'error' => 'Topic not found']);
            exit;
        }

        // Prevent deleting if assigned (Optional - remove if you want to allow force delete)
        if ($topic['status'] !== 'available' && $topic['status'] !== 'free' && $topic['status'] !== NULL && $topic['status'] !== '') {
             // Αν θες να επιτρέπεις διαγραφή ακόμα κι αν έχει ανατεθεί, σβήσε αυτό το if
             // Αλλά συνήθως πρέπει πρώτα να γίνει revoke.
        }

        $stmt = $pdo->prepare("DELETE FROM theses WHERE id = ? AND supervisor_id = ?");
        $stmt->execute([$id, $user_id]);
        echo json_encode(['success' => true]);
        exit;
    }

    // =================================================================================
    // SECTION 2: ASSIGNMENT LOGIC
    // =================================================================================
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_available_topics') {
        $stmt = $pdo->prepare("SELECT id, title FROM theses WHERE supervisor_id = ? AND student_id IS NULL");
        $stmt->execute([$user_id]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'search_student') {
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

   if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'assign_topic') {
        $thesis_id = $_POST['thesis_id'];
        $student_id = $_POST['student_id'];
        
        $update = $pdo->prepare("
            UPDATE theses 
            SET student_id = ?, status = 'assigned', assigned_at = NOW() 
            WHERE id = ? AND supervisor_id = ?
        ");
        $update->execute([$student_id, $thesis_id, $user_id]);

        if ($update->rowCount() > 0) {
            echo json_encode(['success' => true]);
        } else {
            // Αν δεν άλλαξε τίποτα, σημαίνει ότι δεν βρέθηκε το θέμα ή ήταν ήδη ανατεθειμένο
            echo json_encode(['success' => false, 'error' => 'Η ανάθεση απέτυχε. Ελέγξτε αν το θέμα είναι δικό σας.']);
        }
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'revoke_assignment') {
        $thesis_id = $_POST['thesis_id'];
        $stmt = $pdo->prepare("UPDATE theses SET student_id = NULL, assigned_at = NULL WHERE id = ? AND supervisor_id = ?");
        $stmt->execute([$thesis_id, $user_id]);
        echo json_encode(['success' => true]);
        exit;
    }

    // =================================================================================
    // SECTION 3: STATISTICS
    // =================================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_stats') {
        $stmt = $pdo->prepare("SELECT COUNT(*) as total_count, AVG(final_grade) as avg_grade FROM theses WHERE supervisor_id = ?");
        $stmt->execute([$user_id]);
        $s = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'supervisor' => ['count' => (int)$s['total_count'], 'grade' => round((float)$s['avg_grade'], 2)]]);
        exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>