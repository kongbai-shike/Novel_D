<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

if(!empty($data->username) && !empty($data->password) && !empty($data->confirmPassword)) {
    
    if($data->password !== $data->confirmPassword) {
        http_response_code(400);
        echo json_encode(array("success" => false, "message" => "两次输入的密码不一致"));
        exit;
    }
    
    // 检查用户是否已存在
    $check_query = "SELECT id FROM users WHERE username = :username";
    $check_stmt = $db->prepare($check_query);
    $check_stmt->bindParam(":username", $data->username);
    $check_stmt->execute();
    
    if($check_stmt->rowCount() > 0) {
        http_response_code(409);
        echo json_encode(array("success" => false, "message" => "用户名已存在"));
        exit;
    }
    
    // 创建新用户
    $query = "INSERT INTO users SET username=:username, password=:password, email=:email";
    $stmt = $db->prepare($query);
    
    $hashed_password = password_hash($data->password, PASSWORD_DEFAULT);
    $email = !empty($data->email) ? $data->email : "";
    
    $stmt->bindParam(":username", $data->username);
    $stmt->bindParam(":password", $hashed_password);
    $stmt->bindParam(":email", $email);
    
    if($stmt->execute()) {
        http_response_code(201);
        echo json_encode(array(
            "success" => true,
            "message" => "注册成功",
            "username" => $data->username
        ));
    } else {
        http_response_code(503);
        echo json_encode(array("success" => false, "message" => "注册失败"));
    }
} else {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "请输入完整的注册信息"));
}
?>