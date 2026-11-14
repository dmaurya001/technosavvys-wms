<?php
/**
 * TECHNOSAVVYS WMS - UNIFIED REST API CONTROLLER (HOSTINGER / PHP / MYSQL)
 */

require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? trim($_GET['action']) : '';

// Helper to read raw JSON input
function getJsonInput() {
    $raw = file_get_contents('php://input');
    return !empty($raw) ? json_decode($raw, true) : [];
}

try {
    switch ($action) {

        // ---------------------------------------------------------------------
        // 1. HEALTH CHECK
        // ---------------------------------------------------------------------
        case 'health':
        case '':
            $stmt = $pdo->query("SELECT 1 AS ok");
            $res = $stmt->fetch();
            echo json_encode([
                'success' => true,
                'status'  => 'Technosavvys WMS Database API is online',
                'database'=> 'Connected (MySQL / Hostinger)',
                'timestamp' => date('c'),
            ]);
            break;

        // ---------------------------------------------------------------------
        // 2. WORKSHOPS (GET, POST, DELETE)
        // ---------------------------------------------------------------------
        case 'workshops':
            if ($method === 'GET') {
                $stmt = $pdo->query("SELECT * FROM workshops ORDER BY created_at DESC");
                $workshops = $stmt->fetchAll();

                // Fetch sessions for all workshops
                $sessStmt = $pdo->query("SELECT * FROM workshop_sessions ORDER BY date ASC, start_time ASC");
                $allSessions = $sessStmt->fetchAll();

                $sessMap = [];
                foreach ($allSessions as $s) {
                    $wsId = $s['workshop_id'];
                    if (!isset($sessMap[$wsId])) $sessMap[$wsId] = [];
                    $sessMap[$wsId][] = [
                        'id'           => $s['id'],
                        'workshopId'   => $s['workshop_id'],
                        'sessionTitle' => $s['session_title'],
                        'date'         => $s['date'],
                        'startTime'    => $s['start_time'],
                        'endTime'      => $s['end_time'],
                        'location'     => $s['location'],
                        'status'       => $s['status'],
                        'isActive'     => ($s['status'] !== 'Completed' && $s['status'] !== 'Cancelled'),
                        'qrToken'      => $s['qr_token'],
                    ];
                }

                $formatted = [];
                foreach ($workshops as $w) {
                    $wsId = $w['id'];
                    $tags = json_decode($w['tags'] ?? '[]', true) ?: ['Workshop'];
                    $sessions = isset($sessMap[$wsId]) ? $sessMap[$wsId] : [];

                    $formatted[] = [
                        'id'            => $w['id'],
                        'title'         => $w['title'],
                        'category'      => $w['category'],
                        'trainer'       => $w['trainer'],
                        'trainerRole'   => $w['trainer_role'],
                        'date'          => $w['date'],
                        'time'          => $w['time'],
                        'duration'      => $w['duration'],
                        'location'      => $w['location'],
                        'capacity'      => (int)$w['capacity'],
                        'price'         => (float)$w['price'],
                        'status'        => $w['status'],
                        'description'   => $w['description'],
                        'tags'          => $tags,
                        'enrolledCount' => (int)$w['enrolled_count'],
                        'sessions'      => $sessions,
                    ];
                }

                echo json_encode(['success' => true, 'count' => count($formatted), 'workshops' => $formatted]);
                break;
            }

            if ($method === 'POST') {
                $data = getJsonInput();
                if (empty($data['title'])) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Title is required']);
                    exit();
                }

                $id = !empty($data['id']) ? $data['id'] : 'WS-' . rand(1000, 9999);
                $title = $data['title'];
                $category = $data['category'] ?? 'Technology';
                $trainer = $data['trainer'] ?? 'Lead Instructor';
                $trainerRole = $data['trainerRole'] ?? 'Senior Principal Instructor';
                $date = $data['date'] ?? date('Y-m-d');
                $time = $data['time'] ?? '10:00 AM - 05:00 PM';
                $duration = $data['duration'] ?? '6 Hours';
                $location = $data['location'] ?? 'Campus / Virtual Lab';
                $capacity = isset($data['capacity']) ? (int)$data['capacity'] : 60;
                $price = isset($data['price']) ? (float)$data['price'] : 0.00;
                $status = $data['status'] ?? 'Ongoing';
                $description = $data['description'] ?? '';
                $tags = json_encode($data['tags'] ?? ['Workshop']);
                $enrolledCount = isset($data['enrolledCount']) ? (int)$data['enrolledCount'] : 0;

                $sql = "INSERT INTO workshops (id, title, category, trainer, trainer_role, date, time, duration, location, capacity, price, status, description, tags, enrolled_count)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                          title=VALUES(title), category=VALUES(category), trainer=VALUES(trainer), trainer_role=VALUES(trainer_role),
                          date=VALUES(date), time=VALUES(time), duration=VALUES(duration), location=VALUES(location),
                          capacity=VALUES(capacity), price=VALUES(price), status=VALUES(status), description=VALUES(description),
                          tags=VALUES(tags), enrolled_count=VALUES(enrolled_count)";
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$id, $title, $category, $trainer, $trainerRole, $date, $time, $duration, $location, $capacity, $price, $status, $description, $tags, $enrolledCount]);

                // Insert sessions
                if (!empty($data['sessions']) && is_array($data['sessions'])) {
                    $sessStmt = $pdo->prepare("INSERT INTO workshop_sessions (id, workshop_id, session_title, date, start_time, end_time, location, status, qr_token)
                                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                              ON DUPLICATE KEY UPDATE
                                                session_title=VALUES(session_title), date=VALUES(date), start_time=VALUES(start_time),
                                                end_time=VALUES(end_time), location=VALUES(location), status=VALUES(status), qr_token=VALUES(qr_token)");
                    foreach ($data['sessions'] as $s) {
                        $sId = !empty($s['id']) ? $s['id'] : 'SESS-' . $id . '-' . rand(1, 99);
                        $sTitle = $s['sessionTitle'] ?? 'Session 1';
                        $sDate = $s['date'] ?? $date;
                        $sStart = $s['startTime'] ?? '10:00 AM';
                        $sEnd = $s['endTime'] ?? '05:00 PM';
                        $sLoc = $s['location'] ?? $location;
                        $sStat = $s['status'] ?? 'Scheduled';
                        $sQr = !empty($s['qrToken']) ? $s['qrToken'] : 'PERM-' . $id . '-' . $sId;
                        $sessStmt->execute([$sId, $id, $sTitle, $sDate, $sStart, $sEnd, $sLoc, $sStat, $sQr]);
                    }
                }

                echo json_encode(['success' => true, 'workshop' => $data]);
                break;
            }

            if ($method === 'DELETE') {
                $id = $_GET['id'] ?? '';
                if (empty($id) || $id === 'all') {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Valid workshop ID required']);
                    exit();
                }

                // Cascade delete via foreign keys or manual cascade
                $delAtt = $pdo->prepare("DELETE FROM attendance_records WHERE workshop_id = ?");
                $delAtt->execute([$id]);

                $delCert = $pdo->prepare("DELETE FROM certificates WHERE workshop_id = ?");
                $delCert->execute([$id]);

                $delSess = $pdo->prepare("DELETE FROM workshop_sessions WHERE workshop_id = ?");
                $delSess->execute([$id]);

                $delWs = $pdo->prepare("DELETE FROM workshops WHERE id = ?");
                $delWs->execute([$id]);

                echo json_encode(['success' => true, 'deletedId' => $id]);
                break;
            }
            break;

        // ---------------------------------------------------------------------
        // 3. ATTENDANCE (GET, UPDATE STATUS)
        // ---------------------------------------------------------------------
        case 'attendance':
            if ($method === 'GET') {
                $workshopId = $_GET['workshopId'] ?? '';
                $sessionId = $_GET['sessionId'] ?? '';

                $sql = "SELECT * FROM attendance_records WHERE 1=1";
                $params = [];
                if (!empty($workshopId)) {
                    $sql .= " AND workshop_id = ?";
                    $params[] = $workshopId;
                }
                if (!empty($sessionId)) {
                    $sql .= " AND session_id = ?";
                    $params[] = $sessionId;
                }
                $sql .= " ORDER BY created_at DESC";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $records = $stmt->fetchAll();

                $mapped = [];
                foreach ($records as $r) {
                    $mapped[] = [
                        'id'             => $r['id'],
                        'workshopId'     => $r['workshop_id'],
                        'workshopTitle'  => $r['workshop_title'],
                        'sessionId'      => $r['session_id'],
                        'sessionTitle'   => $r['session_title'],
                        'studentId'      => $r['student_id'],
                        'studentName'    => $r['student_name'],
                        'studentEmail'   => $r['student_email'],
                        'studentPhone'   => $r['student_phone'],
                        'studentCourse'  => $r['student_course'],
                        'date'           => $r['date'],
                        'time'           => $r['time'],
                        'serverTimestamp'=> $r['server_timestamp'],
                        'status'         => $r['status'],
                        'checkInMethod'  => $r['check_in_method'],
                        'notes'          => $r['notes'],
                    ];
                }

                echo json_encode(['success' => true, 'count' => count($mapped), 'attendance' => $mapped]);
                break;
            }

            if ($method === 'POST') {
                $data = getJsonInput();
                $id = $data['id'] ?? '';
                $status = $data['status'] ?? '';

                if (empty($id) || empty($status)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'id and status required']);
                    exit();
                }

                $stmt = $pdo->prepare("UPDATE attendance_records SET status = ? WHERE id = ?");
                $stmt->execute([$status, $id]);

                echo json_encode(['success' => true, 'id' => $id, 'status' => $status]);
                break;
            }
            break;

        // ---------------------------------------------------------------------
        // 4. CHECK-IN (POST FROM PUBLIC QR CHECK-IN PAGE)
        // ---------------------------------------------------------------------
        case 'check-in':
            if ($method === 'POST') {
                $data = getJsonInput();
                $name = trim($data['name'] ?? '');
                $email = strtolower(trim($data['email'] ?? ''));
                $phone = trim($data['phone'] ?? '');
                $course = trim($data['course'] ?? 'ADCA');
                $sessionId = trim($data['sessionId'] ?? '');
                $workshopId = trim($data['workshopId'] ?? '');

                if (empty($name) || empty($email) || empty($sessionId)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
                    exit();
                }

                // Check duplicate check-in
                $checkStmt = $pdo->prepare("SELECT id FROM attendance_records WHERE student_email = ? AND session_id = ?");
                $checkStmt->execute([$email, $sessionId]);
                if ($checkStmt->fetch()) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'Attendance already submitted for this session.',
                        'status'  => 'ALREADY_SUBMITTED'
                    ]);
                    exit();
                }

                // Find workshop details
                $wsStmt = $pdo->prepare("SELECT title FROM workshops WHERE id = ?");
                $wsStmt->execute([$workshopId]);
                $ws = $wsStmt->fetch();
                $wsTitle = $ws ? $ws['title'] : ($data['workshopTitle'] ?? 'Workshop');

                // Find session title
                $sessStmt = $pdo->prepare("SELECT session_title FROM workshop_sessions WHERE id = ?");
                $sessStmt->execute([$sessionId]);
                $sess = $sessStmt->fetch();
                $sessTitle = $sess ? $sess['session_title'] : 'Session 1';

                $id = 'ATT-' . rand(100000, 999999);
                $date = date('Y-m-d');
                $time = date('h:i a');
                $serverTimestamp = date('c');
                $status = 'PENDING_REVIEW';

                // Save attendance
                $ins = $pdo->prepare("INSERT INTO attendance_records 
                    (id, workshop_id, workshop_title, session_id, session_title, student_name, student_email, student_phone, student_course, date, time, server_timestamp, status, check_in_method, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $ins->execute([
                    $id, $workshopId, $wsTitle, $sessionId, $sessTitle,
                    $name, $email, $phone, $course, $date, $time, $serverTimestamp,
                    $status, 'QR Scan', 'Verified Permanent Session QR. Awaiting Admin Approval.'
                ]);

                // Also register student record
                $stuIns = $pdo->prepare("INSERT INTO students (id, name, email, phone, course, total_attended)
                    VALUES (?, ?, ?, ?, ?, 1)
                    ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone), total_attended=total_attended+1");
                $stuId = 'STU-' . substr(md5($email), 0, 8);
                $stuIns->execute([$stuId, $name, $email, $phone, $course]);

                echo json_encode([
                    'success' => true,
                    'recordId' => $id,
                    'status' => $status,
                    'message' => 'Check-in submitted successfully.'
                ]);
                break;
            }
            break;

        // ---------------------------------------------------------------------
        // 5. CERTIFICATES (GET, ISSUE)
        // ---------------------------------------------------------------------
        case 'certificates':
            if ($method === 'GET') {
                $email = strtolower(trim($_GET['email'] ?? ''));
                $code = trim($_GET['code'] ?? '');

                if (!empty($email)) {
                    $stmt = $pdo->prepare("SELECT * FROM certificates WHERE LOWER(student_email) = ? ORDER BY created_at DESC");
                    $stmt->execute([$email]);
                    $certs = $stmt->fetchAll();
                } elseif (!empty($code)) {
                    $stmt = $pdo->prepare("SELECT * FROM certificates WHERE verification_code = ? OR certificate_no = ?");
                    $stmt->execute([$code, $code]);
                    $certs = $stmt->fetchAll();
                } else {
                    $stmt = $pdo->query("SELECT * FROM certificates ORDER BY created_at DESC LIMIT 100");
                    $certs = $stmt->fetchAll();
                }

                $formatted = [];
                foreach ($certs as $c) {
                    $formatted[] = [
                        'certificateNo'   => $c['certificate_no'],
                        'studentName'     => $c['student_name'],
                        'studentEmail'    => $c['student_email'],
                        'studentPhone'    => $c['student_phone'],
                        'studentCourse'   => $c['student_course'],
                        'workshopId'      => $c['workshop_id'],
                        'workshopTitle'   => $c['workshop_title'],
                        'issueDate'       => $c['issue_date'],
                        'trainerName'     => $c['trainer_name'],
                        'grade'           => $c['grade'],
                        'verificationCode'=> $c['verification_code'],
                        'score'           => $c['score'],
                    ];
                }

                echo json_encode(['success' => true, 'count' => count($formatted), 'certificates' => $formatted]);
                break;
            }

            if ($method === 'POST') {
                $data = getJsonInput();
                $certNo = $data['certificateNo'] ?? ('TECH-' . date('Y') . '-' . rand(1000, 9999));
                $name = $data['studentName'] ?? '';
                $email = strtolower($data['studentEmail'] ?? '');
                $phone = $data['studentPhone'] ?? '';
                $course = $data['studentCourse'] ?? '';
                $wsId = $data['workshopId'] ?? '';
                $wsTitle = $data['workshopTitle'] ?? 'Workshop';
                $date = $data['issueDate'] ?? date('Y-m-d');
                $trainer = $data['trainerName'] ?? 'Lead Instructor';
                $grade = $data['grade'] ?? 'DISTINCTION';
                $code = $data['verificationCode'] ?? ('VRF-' . rand(100000, 999999));
                $score = $data['score'] ?? '95%';

                $stmt = $pdo->prepare("INSERT INTO certificates 
                    (certificate_no, student_name, student_email, student_phone, student_course, workshop_id, workshop_title, issue_date, trainer_name, grade, verification_code, score)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE student_name=VALUES(student_name), workshop_title=VALUES(workshop_title), grade=VALUES(grade)");
                
                $stmt->execute([$certNo, $name, $email, $phone, $course, $wsId, $wsTitle, $date, $trainer, $grade, $code, $score]);

                echo json_encode(['success' => true, 'certificateNo' => $certNo, 'verificationCode' => $code]);
                break;
            }
            break;

        default:
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Action not found: ' . htmlspecialchars($action)]);
            break;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

