const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API配置
const API_KEY = 'a14b5cdff147b1262882db2ca29355bd';
const BASE_URL = 'https://api.xcvts.cn/api/xiaoshuo/axdzs';

// 静态文件服务
app.use(express.static(__dirname));
app.use('/User%20Profile', express.static(path.join(__dirname, 'User Profile')));

console.log('✅ 服务器配置完成');

// 内存数据库
const users = new Map();
let nextId = 3;

// 初始化示例用户
users.set(1, { 
    id: 1, 
    username: 'admin', 
    password: 'admin123', 
    email: 'admin@example.com', 
    download_count: 0,
    created_at: new Date(),
    last_login: new Date()
});
users.set(2, { 
    id: 2, 
    username: 'test', 
    password: 'test123', 
    email: 'test@example.com', 
    download_count: 0,
    created_at: new Date(),
    last_login: new Date()
});

// 页面路由
app.get('/', (req, res) => {
    console.log('📄 访问主页');
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/profile', (req, res) => {
    console.log('👤 访问个人资料页');
    res.sendFile(path.join(__dirname, 'User Profile', 'profile.html'));
});

app.get('/User%20Profile/profile.html', (req, res) => {
    console.log('👤 访问个人资料页 (旧路径)');
    res.sendFile(path.join(__dirname, 'User Profile', 'profile.html'));
});

// HTTPS请求函数
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData);
                } catch (error) {
                    reject(new Error('解析JSON失败: ' + error.message));
                }
            });
            
        }).on('error', (error) => {
            reject(new Error('请求失败: ' + error.message));
        });
    });
}

// API路由

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: '服务器运行正常',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// 搜索API - 修复版本
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        console.log('🔍 搜索请求:', query);
        
        if (!query) {
            return res.json({
                status: 'error',
                message: '请输入搜索关键词'
            });
        }
        
        // 构建API请求URL
        const apiUrl = `${BASE_URL}?apiKey=${API_KEY}&q=${encodeURIComponent(query)}`;
        console.log('调用外部API:', apiUrl);
        
        // 调用真实API
        const apiData = await makeRequest(apiUrl);
        console.log('API返回数据:', apiData);
        
        // 返回API数据
        res.json(apiData);
        
    } catch (error) {
        console.error('搜索API错误:', error);
        
        // 降级方案：返回模拟数据
        const mockResults = {
            status: 'success',
            count: 3,
            results: [
                {
                    title: '斗破苍穹',
                    author: '天蚕土豆',
                    cover: '',
                    source: '起点中文网'
                },
                {
                    title: '凡人修仙传', 
                    author: '忘语',
                    cover: '',
                    source: '起点中文网'
                },
                {
                    title: '全职高手',
                    author: '蝴蝶蓝',
                    cover: '',
                    source: '起点中文网'
                }
            ]
        };
        
        res.json(mockResults);
    }
});

// 登录API
app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('🔐 登录请求:', username);
        
        if (!username || !password) {
            return res.json({
                success: false,
                message: '请输入用户名和密码'
            });
        }
        
        // 查找用户
        const user = Array.from(users.values()).find(u => u.username === username);
        
        if (!user) {
            return res.json({
                success: false,
                message: '用户不存在'
            });
        }
        
        if (password !== user.password) {
            return res.json({
                success: false,
                message: '密码错误'
            });
        }
        
        // 更新最后登录时间
        user.last_login = new Date();
        
        res.json({
            success: true,
            message: '登录成功',
            username: user.username,
            user_id: user.id
        });
        
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '登录失败' 
        });
    }
});

// 注册API
app.post('/api/register', (req, res) => {
    try {
        const { username, password, confirmPassword } = req.body;
        console.log('📝 注册请求:', username);
        
        if (!username || !password || !confirmPassword) {
            return res.json({
                success: false,
                message: '请填写完整信息'
            });
        }
        
        if (password !== confirmPassword) {
            return res.json({
                success: false,
                message: '两次输入的密码不一致'
            });
        }
        
        // 检查用户名是否已存在
        const existingUser = Array.from(users.values()).find(u => u.username === username);
        if (existingUser) {
            return res.json({
                success: false,
                message: '用户名已存在'
            });
        }
        
        // 创建新用户
        const newUser = {
            id: nextId++,
            username,
            password,
            email: '',
            download_count: 0,
            created_at: new Date(),
            last_login: new Date()
        };
        
        users.set(newUser.id, newUser);
        
        res.json({
            success: true,
            message: '注册成功',
            username: username,
            user_id: newUser.id
        });
        
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '注册失败' 
        });
    }
});

// 下载API
app.get('/api/download', (req, res) => {
    try {
        const { q, n, token } = req.query;
        console.log('📥 下载请求:', q);
        
        if (!q || !n) {
            return res.json({
                success: false,
                message: '缺少必要的查询参数'
            });
        }
        
        // 检查用户是否登录
        if (!token) {
            return res.json({ 
                success: false, 
                message: '请先登录后再下载' 
            });
        }
        
        // 用户验证
        const user = users.get(parseInt(token));
        if (!user) {
            return res.json({ 
                success: false, 
                message: '用户验证失败，请重新登录' 
            });
        }
        
        // 更新下载计数
        user.download_count = (user.download_count || 0) + 1;
        
        // 构建下载URL
        const downloadUrl = `${BASE_URL}?apiKey=${API_KEY}&q=${encodeURIComponent(q)}&n=${n}`;
        console.log('下载重定向:', downloadUrl);
        
        // 重定向到下载链接
        res.redirect(downloadUrl);
        
    } catch (error) {
        console.error('下载错误:', error);
        res.status(500).json({ 
            success: false,
            message: '下载失败' 
        });
    }
});

// 修改密码API
app.post('/api/change-password', (req, res) => {
    try {
        const { userId, oldPassword, newPassword } = req.body;
        console.log('🔑 修改密码请求:', userId);

        if (!userId || !oldPassword || !newPassword) {
            return res.json({ 
                success: false, 
                message: '请提供完整的参数' 
            });
        }

        const user = users.get(parseInt(userId));
        
        if (!user) {
            return res.json({ 
                success: false, 
                message: '用户不存在' 
            });
        }

        // 验证旧密码
        if (oldPassword !== user.password) {
            return res.json({ 
                success: false, 
                message: '旧密码错误' 
            });
        }

        // 更新密码
        user.password = newPassword;
        
        res.json({
            success: true,
            message: '密码修改成功'
        });

    } catch (error) {
        console.error('修改密码错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '修改密码失败' 
        });
    }
});

// 调试API - 获取所有用户
app.get('/api/debug/users', (req, res) => {
    res.json({
        success: true,
        users: Array.from(users.values())
    });
});

// 404处理
app.use((req, res) => {
    console.log('❌ 404 - 未找到:', req.url);
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>页面未找到 - 小说下载站</title>
            <style>
                body { 
                    font-family: 'Microsoft YaHei', sans-serif; 
                    text-align: center; 
                    padding: 50px; 
                    background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
                    color: white;
                }
                .container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: rgba(255,255,255,0.1); 
                    padding: 30px; 
                    border-radius: 15px; 
                }
                a { 
                    color: #fff; 
                    text-decoration: underline; 
                    display: inline-block;
                    margin-top: 20px;
                    padding: 10px 20px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 5px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>404 - 页面未找到</h1>
                <p>请求的页面 <strong>${req.url}</strong> 不存在。</p>
                <a href="/">返回首页</a>
            </div>
        </body>
        </html>
    `);
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('💥 服务器错误:', err);
    res.status(500).json({
        success: false,
        message: '服务器内部错误'
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 小说下载站服务器启动成功!');
    console.log('📍 访问地址: http://localhost:' + PORT);
    console.log('📁 服务目录: ' + __dirname);
    console.log('⏰ 启动时间: ' + new Date().toLocaleString());
    console.log('='.repeat(60));
    console.log('测试账户信息:');
    console.log('  👤 admin / admin123');
    console.log('  👤 test / test123');
    console.log('='.repeat(60));
});

console.log('✅ server.js 加载完成');