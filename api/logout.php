<?php
// api/logout.php
session_start();
session_destroy(); // Καθαρίζει τη μνήμη του Server
header('Content-Type: application/json');
echo json_encode(['status' => 'success']);
?>