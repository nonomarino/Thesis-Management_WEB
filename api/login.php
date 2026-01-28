<?php
// api/login.php
session_start();
header('Content-Type: application/json');
require_once 'db.php';

// Λήψη δεδομένων JSON
$input = json_decode(file_get_contents('php://input'), true);
$username = $input['username'] ?? '';
$password = $input['password'] ?? '';

if (!$username || !$password) {
    echo json_encode(['status' => 'error', 'message' => 'Συμπληρώστε όλα τα πεδία']);
    exit;
}

try {
    // Ψάχνουμε τον χρήστη
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    $valid = false;
    if ($user) {
        // 1. Έλεγχος Hash (Κανονικός τρόπος)
        if (password_verify($password, $user['password'])) {
            $valid = true;
        } 
        // 2. Έλεγχος Plain Text (ΜΟΝΟ ΓΙΑ DEVELOPMENT - Για να δουλέψει το '12345')
        elseif ($password === $user['password']) {
            $valid = true;
        }
    }

    if ($valid) {
        // Αποθήκευση στο Session (Server-side μνήμη)
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['full_name'] = $user['first_name'] . ' ' . $user['last_name'];

        echo json_encode(['status' => 'success']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Λάθος στοιχεία εισόδου']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>