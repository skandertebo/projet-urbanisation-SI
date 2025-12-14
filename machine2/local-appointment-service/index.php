<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dataDir = __DIR__ . '/data';
$appointmentsFile = $dataDir . '/appointments.json';

// Créer le répertoire si nécessaire
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}

// Charger les rendez-vous
function loadAppointments() {
    global $appointmentsFile;
    if (file_exists($appointmentsFile)) {
        $content = file_get_contents($appointmentsFile);
        return json_decode($content, true) ?: [];
    }
    return [];
}

// Sauvegarder les rendez-vous
function saveAppointments($appointments) {
    global $appointmentsFile;
    file_put_contents($appointmentsFile, json_encode($appointments, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Health check
if ($path === '/health' || $path === '/health.php') {
    echo json_encode(['status' => 'OK', 'service' => 'local-appointment-service']);
    exit();
}

// Route: GET /api/appointments
if ($method === 'GET' && $path === '/api/appointments') {
    $appointments = loadAppointments();
    echo json_encode($appointments);
    exit();
}

// Route: GET /api/appointments/{id}
if ($method === 'GET' && preg_match('#^/api/appointments/(\d+)$#', $path, $matches)) {
    $id = $matches[1];
    $appointments = loadAppointments();
    foreach ($appointments as $appointment) {
        if ($appointment['id'] == $id) {
            echo json_encode($appointment);
            exit();
        }
    }
    http_response_code(404);
    echo json_encode(['error' => 'Rendez-vous non trouvé']);
    exit();
}

// Route: POST /api/appointments
if ($method === 'POST' && $path === '/api/appointments') {
    $input = json_decode(file_get_contents('php://input'), true);
    $appointments = loadAppointments();
    
    $newAppointment = [
        'id' => count($appointments) + 1,
        'patientId' => $input['patientId'] ?? null,
        'patientCin' => $input['patientCin'] ?? null,
        'patientName' => $input['patientName'] ?? null,
        'doctorId' => $input['doctorId'] ?? null,
        'doctorName' => $input['doctorName'] ?? null,
        'date' => $input['date'] ?? date('c'),
        'time' => $input['time'] ?? '',
        'reason' => $input['reason'] ?? '',
        'status' => $input['status'] ?? 'scheduled',
        'createdAt' => date('c')
    ];
    
    $appointments[] = $newAppointment;
    saveAppointments($appointments);
    
    http_response_code(201);
    echo json_encode($newAppointment);
    exit();
}

// Route: POST /api/appointments/{id}/end - Terminer un rendez-vous
if ($method === 'POST' && preg_match('#^/api/appointments/(\d+)/end$#', $path, $matches)) {
    $id = (int)$matches[1];
    $input = json_decode(file_get_contents('php://input'), true);
    $appointments = loadAppointments();
    
    $foundIndex = -1;
    foreach ($appointments as $index => $appointment) {
        if ($appointment['id'] == $id) {
            $foundIndex = $index;
            break;
        }
    }
    
    if ($foundIndex === -1) {
        http_response_code(404);
        echo json_encode(['error' => 'Rendez-vous non trouvé']);
        exit();
    }
    
    $appointment = $appointments[$foundIndex];
    
    // Actes médicaux fournis ou générés par défaut
    $acts = $input['acts'] ?? [
        [
            'code' => 'CONS-CARDIO',
            'label' => 'Consultation cardiologie',
            'category' => 'consultation',
            'price' => 80.00
        ],
        [
            'code' => 'ECG-12D',
            'label' => 'Électrocardiogramme 12 dérivations',
            'category' => 'examen',
            'price' => 45.00
        ]
    ];
    
    // Mettre à jour le rendez-vous
    $appointments[$foundIndex]['status'] = 'completed';
    $appointments[$foundIndex]['endedAt'] = date('c');
    $appointments[$foundIndex]['acts'] = $acts;
    $appointments[$foundIndex]['diagnosis'] = $input['diagnosis'] ?? null;
    $appointments[$foundIndex]['notes'] = $input['notes'] ?? null;
    
    saveAppointments($appointments);
    
    // Construire la réponse
    $response = [
        'appointmentId' => $id,
        'status' => 'completed',
        'endedAt' => $appointments[$foundIndex]['endedAt'],
        'patient' => [
            'id' => $appointment['patientId'],
            'cin' => $appointment['patientCin'],
            'name' => $appointment['patientName']
        ],
        'doctor' => [
            'id' => $appointment['doctorId'],
            'name' => $appointment['doctorName']
        ],
        'acts' => $acts,
        'totalAmount' => array_reduce($acts, function($sum, $act) {
            return $sum + ($act['price'] ?? 0);
        }, 0),
        'diagnosis' => $appointments[$foundIndex]['diagnosis'],
        'notes' => $appointments[$foundIndex]['notes']
    ];
    
    echo json_encode($response);
    exit();
}

// Route par défaut
http_response_code(404);
echo json_encode(['error' => 'Endpoint non trouvé']);


