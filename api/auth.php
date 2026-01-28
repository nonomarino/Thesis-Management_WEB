<?php
// api/auth.php
session_start();
header('Content-Type: application/json'); // Always return JSON
require 'db.php';

// Helper to send JSON response
function sendJson($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// 1. LOGIN (POST)
if ($method === 'POST') {
    // Read JSON input from the frontend
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['username']) || !isset($input['password'])) {
        sendJson(['error' => 'Missing credentials'], 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute([$input['username']]);
    $user = $stmt->fetch();

    if ($user && password_verify($input['password'], $user['password'])) {
        // Success: Set Session
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['role']    = $user['role'];
        $_SESSION['name']    = $user['first_name'] . ' ' . $user['last_name'];
        
        sendJson(['success' => true, 'role' => $user['role']]);
    } else {
        sendJson(['error' => 'Invalid username or password'], 401);
    }
}

// 2. LOGOUT (GET ?action=logout)
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'logout') {
    session_destroy();
    sendJson(['success' => true]);
}

// 3. CHECK SESSION (GET ?action=check)
// Used by frontend to see if user is already logged in
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'check') {
    if (isset($_SESSION['user_id'])) {
        sendJson(['logged_in' => true, 'user' => $_SESSION]);
    } else {
        sendJson(['logged_in' => false]);
    }
}
?>