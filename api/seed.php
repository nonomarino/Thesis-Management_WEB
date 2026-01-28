<?php
// api/seed.php
require 'db.php';

// Default password for everyone: "12345"
$password = password_hash("12345", PASSWORD_DEFAULT);

echo "<h2>Seeding Database...</h2>";

try {
    $pdo->beginTransaction();

    // 1. Create 5 Instructors
    $instructors = [
        ['prof1@univ.gr', 'Nikolaos', 'Avouris'],
        ['prof2@univ.gr', 'Andreas', 'Komninos'],
        ['prof3@univ.gr', 'John', 'Garofalakis'],
        ['prof4@univ.gr', 'Vasileios', 'Megalooikonomou'],
        ['prof5@univ.gr', 'Sotiris', 'Nikoletseas']
    ];

    foreach ($instructors as $inst) {
        $stmt = $pdo->prepare("INSERT IGNORE INTO users (username, password, first_name, last_name, role) VALUES (?, ?, ?, ?, 'instructor')");
        $stmt->execute([$inst[0], $password, $inst[1], $inst[2]]);
        echo "Created Instructor: {$inst[0]}<br>";
    }

    // 2. Create Secretariat
    $stmt = $pdo->prepare("INSERT IGNORE INTO users (username, password, first_name, last_name, role) VALUES (?, ?, ?, ?, 'secretariat')");
    $stmt->execute(['admin@univ.gr', $password, 'Grammateia', 'Department']);
    echo "Created Secretariat: admin@univ.gr<br>";

    // 3. Create 10 Students
    for ($i = 1; $i <= 10; $i++) {
        $email = "student{$i}@upatras.gr";
        $fname = "StudentName{$i}";
        $lname = "StudentLast{$i}";
        
        // Insert User
        $stmt = $pdo->prepare("INSERT IGNORE INTO users (username, password, first_name, last_name, role) VALUES (?, ?, ?, ?, 'student')");
        $stmt->execute([$email, $password, $fname, $lname]);
        $user_id = $pdo->lastInsertId();

        // If user was inserted (not duplicate), add profile
        if ($user_id) {
            $am = "up" . (1000 + $i);
            $stmtProfile = $pdo->prepare("INSERT INTO student_profiles (user_id, student_am, address, phone_mobile) VALUES (?, ?, 'Patras City', '6900000000')");
            $stmtProfile->execute([$user_id, $am]);
            echo "Created Student: $email (AM: $am)<br>";
        }
    }

    $pdo->commit();
    echo "<h3>Success! You can now log in with password '12345'.</h3>";

} catch (Exception $e) {
    $pdo->rollBack();
    echo "Error: " . $e->getMessage();
}
?>