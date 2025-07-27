<?php
// api.php

// === НАСТРОЙКИ ПОДКЛЮЧЕНИЯ К БАЗЕ ДАННЫХ ===
$db_host = '127.0.0.1';
$db_port = '3308';
$db_name = 'ghosttruf3';
$db_user = 'ghosttruf3';
$db_pass = 'Vaguvix_45$'; // Убедитесь, что здесь ваш самый свежий пароль
$secret_password = 'kuvalda'; 
// ==========================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-KEY');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $pdo = new PDO("mysql:host=$db_host;port=$db_port;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit();
}

$action = $_GET['action'] ?? '';
$is_post = $_SERVER['REQUEST_METHOD'] === 'POST';

// --- Операции чтения (не требуют пароля) ---
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'get_all_data') {
        try {
            $ratings_stmt = $pdo->query("SELECT * FROM ratings");
            $plans_stmt = $pdo->query("SELECT * FROM plans");
            $keys_stmt = $pdo->query("SELECT id, key_value as `key`, request_count as `count`, UNIX_TIMESTAMP(disabled_until) * 1000 as disabledUntil FROM kp_api_keys");

            $ratings_obj = [];
            foreach ($ratings_stmt->fetchAll(PDO::FETCH_ASSOC) as $row) { $ratings_obj[$row['id']] = $row; }

            $plans_obj = [];
            foreach ($plans_stmt->fetchAll(PDO::FETCH_ASSOC) as $row) { $plans_obj[$row['id']] = $row; }

            $keys_arr = [];
            foreach($keys_stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $row['disabledUntil'] = $row['disabledUntil'] ?? 0;
                $keys_arr[] = $row;
            }

            echo json_encode([
                'ratings' => $ratings_obj, 
                'plans' => $plans_obj,
                'kp_api_keys' => $keys_arr
            ]);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to fetch data: ' . $e->getMessage()]);
        }
    }
}

// --- Операции записи, удаления и импорта (требуют пароль) ---
if ($is_post) {
    if (strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false) {
        $data = json_decode(file_get_contents('php://input'), true);
        $password = $data['password'] ?? null;
    } else {
        $data = $_POST;
        $password = $data['password'] ?? null;
    }
    
    if ($password !== $secret_password) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden: Invalid password']);
        exit();
    }

    $filmId = $data['filmId'] ?? null;

    try {
        switch ($action) {
            case 'save_rating':
                $ratingData = $data['ratingData'];
                $stmt = $pdo->prepare("INSERT INTO ratings (id, movieData, katya, maxim, ratedAt) VALUES (?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE movieData = VALUES(movieData), katya = VALUES(katya), maxim = VALUES(maxim), ratedAt = NOW()");
                $stmt->execute([$filmId, json_encode($ratingData['movieData']), isset($ratingData['katya']) ? json_encode($ratingData['katya']) : null, isset($ratingData['maxim']) ? json_encode($ratingData['maxim']) : null]);
                echo json_encode(['success' => true]);
                break;

            case 'delete_rating':
                $stmt = $pdo->prepare("DELETE FROM ratings WHERE id = ?");
                $stmt->execute([$filmId]);
                echo json_encode(['success' => true]);
                break;

            case 'save_plan':
                $planData = $data['planData'];
                $stmt = $pdo->prepare("INSERT INTO plans (id, movieData, proposedBy, priority, comment, season, episode, progress_percentage, episode_title, proposedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE movieData=VALUES(movieData), proposedBy=VALUES(proposedBy), priority=VALUES(priority), comment=VALUES(comment), season=VALUES(season), episode=VALUES(episode), progress_percentage=VALUES(progress_percentage), episode_title=VALUES(episode_title)");
                $stmt->execute([$filmId, json_encode($planData['movieData']), $planData['proposedBy'], $planData['priority'], $planData['comment'], $planData['season'] ?? null, $planData['episode'] ?? null, $planData['progress_percentage'] ?? null, $planData['episode_title'] ?? null]);
                echo json_encode(['success' => true]);
                break;

            case 'delete_plan':
                $stmt = $pdo->prepare("DELETE FROM plans WHERE id = ?");
                $stmt->execute([$filmId]);
                echo json_encode(['success' => true]);
                break;
            
            case 'add_kp_key':
                $key = $data['key'] ?? '';
                if (empty($key)) throw new Exception("Key cannot be empty.");
                $stmt = $pdo->prepare("INSERT INTO kp_api_keys (key_value) VALUES (?)");
                $stmt->execute([$key]);
                $newId = $pdo->lastInsertId();
                echo json_encode(['success' => true, 'id' => $newId]);
                break;

            case 'delete_kp_key':
                $keyId = $data['keyId'] ?? 0;
                $stmt = $pdo->prepare("DELETE FROM kp_api_keys WHERE id = ?");
                $stmt->execute([$keyId]);
                echo json_encode(['success' => true]);
                break;
            
            case 'update_kp_key':
                $keyId = $data['keyId'] ?? 0;
                $updateData = $data['updateData'] ?? [];
                if (isset($updateData['count'])) {
                    $stmt = $pdo->prepare("UPDATE kp_api_keys SET request_count = request_count + 1 WHERE id = ?");
                    $stmt->execute([$keyId]);
                }
                if (isset($updateData['disabledUntil'])) {
                    $disabledTimestamp = $updateData['disabledUntil'] > 0 ? date('Y-m-d H:i:s', $updateData['disabledUntil'] / 1000) : null;
                    $stmt = $pdo->prepare("UPDATE kp_api_keys SET disabled_until = ? WHERE id = ?");
                    $stmt->execute([$disabledTimestamp, $keyId]);
                }
                echo json_encode(['success' => true]);
                break;

            case 'import_data':
            case 'import_kp_keys':
                $table = $action === 'import_data' ? ($data['table'] ?? '') : 'kp_api_keys';
                if (!in_array($table, ['ratings', 'plans', 'kp_api_keys'])) {
                    throw new Exception("Invalid table name.");
                }
                if (!isset($_FILES['jsonFile']) || $_FILES['jsonFile']['error'] !== UPLOAD_ERR_OK) {
                    throw new Exception("File upload error.");
                }
                $json_content = file_get_contents($_FILES['jsonFile']['tmp_name']);
                $import_data = json_decode($json_content, true);
                if (json_last_error() !== JSON_ERROR_NONE) throw new Exception("Invalid JSON file.");
                
                $pdo->beginTransaction();
                $pdo->exec("TRUNCATE TABLE `$table`");

                if ($table === 'ratings') {
                    $stmt = $pdo->prepare("INSERT INTO ratings (id, movieData, katya, maxim, ratedAt) VALUES (?, ?, ?, ?, ?)");
                    foreach ($import_data as $id => $item) {
                         $ratedAt = isset($item['ratedAt']['seconds']) ? date('Y-m-d H:i:s', $item['ratedAt']['seconds']) : date('Y-m-d H:i:s');
                         $stmt->execute([$id, json_encode($item['movieData']), isset($item['katya']) ? json_encode($item['katya']) : null, isset($item['maxim']) ? json_encode($item['maxim']) : null, $ratedAt]);
                    }
                } elseif ($table === 'plans') {
                    $stmt = $pdo->prepare("INSERT INTO plans (id, movieData, proposedBy, priority, comment, season, episode, progress_percentage, episode_title, proposedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    foreach ($import_data as $id => $item) {
                        $proposedAt = isset($item['proposedAt']['seconds']) ? date('Y-m-d H:i:s', $item['proposedAt']['seconds']) : date('Y-m-d H:i:s');
                        $stmt->execute([$id, json_encode($item['movieData']), $item['proposedBy'], $item['priority'] ?? 0, $item['comment'] ?? null, $item['season'] ?? null, $item['episode'] ?? null, $item['progress_percentage'] ?? null, $item['episode_title'] ?? null, $proposedAt]);
                    }
                } elseif ($table === 'kp_api_keys') {
                    // --- НОВОЕ, БОЛЕЕ НАДЕЖНОЕ РЕШЕНИЕ ДЛЯ УДАЛЕНИЯ ДУБЛИКАТОВ ---
                    $unique_key_items = [];
                    $data_to_loop = is_numeric(implode('', array_keys($import_data))) ? $import_data : array_values($import_data);
                    
                    foreach ($data_to_loop as $item) {
                        if (isset($item['key']) && !empty($item['key'])) {
                            // Используем сам ключ API как ключ массива, чтобы автоматически убрать дубликаты.
                            // Если ключ встретится снова, он просто перезапишет предыдущее значение.
                            $unique_key_items[$item['key']] = $item;
                        }
                    }
                    $final_keys_to_import = array_values($unique_key_items); // Преобразуем обратно в обычный массив для цикла
                    // --- КОНЕЦ НОВОГО РЕШЕНИЯ ---

                    $stmt = $pdo->prepare("INSERT INTO kp_api_keys (key_value, request_count, disabled_until) VALUES (?, ?, ?)");
                    foreach ($final_keys_to_import as $item) { // Используем новый, 100% уникальный массив
                        $disabled = ($item['disabledUntil'] ?? 0) > 0 ? date('Y-m-d H:i:s', $item['disabledUntil'] / 1000) : null;
                        $stmt->execute([$item['key'], $item['count'] ?? 0, $disabled]);
                    }
                    $import_data = $final_keys_to_import; // Обновляем для правильного сообщения
                }
                $pdo->commit();
                echo json_encode(['success' => true, 'message' => "Imported " . count($import_data) . " items into `$table`."]);
                break;
            
            default:
                http_response_code(404);
                echo json_encode(['error' => 'Action not found']);
        }
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Operation failed: ' . $e->getMessage()]);
    }
}
?>