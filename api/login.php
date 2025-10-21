<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

if(!empty($data->username) && !empty($data->password)) {
    $query = "SELECT id, username, password FROM users WHERE username = :username";
    $stmt = $db->prepare($query);
    $stmt->bindParam(":username", $data->username);
    $stmt->execute();
    
    if($stmt->rowCount() == 1) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $id = $row['id'];
        $username = $row['username'];
        $hashed_password = $row['password'];
        
        if(password_verify($data->password, $hashed_password)) {
            http_response_code(200);
            echo json_encode(array(
                "success" => true,
                "message" => "登录成功",
                "username" => $username,
                "user_id" => $id
            ));
        } else {
            http_response_code(401);
            echo json_encode(array("success" => false, "message" => "密码错误"));
        }
    } else {
        http_response_code(404);
        echo json_encode(array("success" => false, "message" => "用户不存在"));
    }
} else {
    http_response_code(400);
    echo json_encode(array("success" => false, "message" => "请输入用户名和密码"));
}
?>