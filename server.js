const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB连接
let db;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/novel_downloader';

async function connectDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db();
        console.log('✅ 已连接到MongoDB');
        
        // 创建索引
        await db.collection('users').createIndex({ username: 1 }, { unique: true });
        await db.collection('user_favorites').createIndex({ user_id: 1, novel_title: 1 }, { unique: true });
        
    } catch (error) {
        console.error('❌ MongoDB连接失败:', error);
        process.exit(1);
    }
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(__dirname));
app.use('/User%20Profile', express.static(path.join(__dirname, 'User Profile')));

// API配置
const API_KEY = 'a14b5cdff147b1262882db2ca29355bd';
const BASE_URL = 'https://api.xcvts.cn/api/xiaoshuo/axdzs';

// HTTPS请求函数
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const https = require('https');
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

// 页面路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'User Profile', 'profile.html'));
});

// API路由

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: '服务器运行正常',
        timestamp: new Date().toISOString(),
        database: db ? '已连接' : '未连接'
    });
});

// 搜索API
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
        
        const apiUrl = `${BASE_URL}?apiKey=${API_KEY}&q=${encodeURIComponent(query)}`;
        console.log('调用外部API:', apiUrl);
        
        const apiData = await makeRequest(apiUrl);
        console.log('API返回数据:', apiData);
        
        res.json(apiData);
        
    } catch (error) {
        console.error('搜索API错误:', error);
        
        // 降级方案
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

// 用户注册
app.post('/api/register', async (req, res) => {
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
        
        if (username.length < 3 || username.length > 15) {
            return res.json({
                success: false,
                message: '用户名长度应为3-15位'
            });
        }
        
        if (password.length < 6) {
            return res.json({
                success: false,
                message: '密码长度至少6位'
            });
        }
        
        // 检查用户名是否已存在
        const existingUser = await db.collection('users').findOne({ username });
        if (existingUser) {
            return res.json({
                success: false,
                message: '用户名已存在'
            });
        }
        
        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 创建新用户
        const newUser = {
            username,
            password: hashedPassword,
            email: '',
            download_count: 0,
            created_at: new Date(),
            last_login: new Date(),
            join_date: new Date()
        };
        
        const result = await db.collection('users').insertOne(newUser);
        
        res.json({
            success: true,
            message: '注册成功',
            username: username,
            user_id: result.insertedId.toString()
        });
        
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '注册失败' 
        });
    }
});

// 用户登录
app.post('/api/login', async (req, res) => {
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
        const user = await db.collection('users').findOne({ username });
        
        if (!user) {
            return res.json({
                success: false,
                message: '用户不存在'
            });
        }
        
        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.json({
                success: false,
                message: '密码错误'
            });
        }
        
        // 更新最后登录时间
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { last_login: new Date() } }
        );
        
        res.json({
            success: true,
            message: '登录成功',
            username: user.username,
            user_id: user._id.toString()
        });
        
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '登录失败' 
        });
    }
});

// 获取用户收藏
app.get('/api/favorites/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const favorites = await db.collection('user_favorites')
            .find({ user_id: userId })
            .sort({ added_at: -1 })
            .toArray();
        
        res.json({
            success: true,
            favorites: favorites
        });
        
    } catch (error) {
        console.error('获取收藏错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取收藏失败' 
        });
    }
});

// 添加收藏
app.post('/api/favorites', async (req, res) => {
    try {
        const { user_id, novel_title, novel_author, novel_cover } = req.body;
        
        const favorite = {
            user_id,
            novel_title,
            novel_author: novel_author || '未知作者',
            novel_cover: novel_cover || '',
            added_at: new Date()
        };
        
        // 使用upsert避免重复
        const result = await db.collection('user_favorites').updateOne(
            { user_id, novel_title },
            { $set: favorite },
            { upsert: true }
        );
        
        res.json({
            success: true,
            message: '收藏成功'
        });
        
    } catch (error) {
        console.error('添加收藏错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '收藏失败' 
        });
    }
});

// 取消收藏
app.delete('/api/favorites', async (req, res) => {
    try {
        const { user_id, novel_title } = req.body;
        
        await db.collection('user_favorites').deleteOne({
            user_id,
            novel_title
        });
        
        res.json({
            success: true,
            message: '取消收藏成功'
        });
        
    } catch (error) {
        console.error('取消收藏错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '取消收藏失败' 
        });
    }
});

// 修改密码
app.post('/api/change-password', async (req, res) => {
    try {
        const { userId, oldPassword, newPassword } = req.body;
        console.log('🔑 修改密码请求:', userId);

        if (!userId || !oldPassword || !newPassword) {
            return res.json({ 
                success: false, 
                message: '请提供完整的参数' 
            });
        }

        const user = await db.collection('users').findOne({ 
            _id: new ObjectId(userId) 
        });
        
        if (!user) {
            return res.json({ 
                success: false, 
                message: '用户不存在' 
            });
        }

        // 验证旧密码
        const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isOldPasswordValid) {
            return res.json({ 
                success: false, 
                message: '旧密码错误' 
            });
        }

        // 加密新密码
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // 更新密码
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { password: hashedNewPassword } }
        );
        
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

// 下载API
app.get('/api/download', async (req, res) => {
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
        const user = await db.collection('users').findOne({ 
            _id: new ObjectId(token) 
        });
        if (!user) {
            return res.json({ 
                success: false, 
                message: '用户验证失败，请重新登录' 
            });
        }
        
        // 更新下载计数
        await db.collection('users').updateOne(
            { _id: new ObjectId(token) },
            { $inc: { download_count: 1 } }
        );
        
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

// 获取用户统计信息
app.get('/api/user/stats/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const user = await db.collection('users').findOne({ 
            _id: new ObjectId(userId) 
        });
        
        if (!user) {
            return res.json({ 
                success: false, 
                message: '用户不存在' 
            });
        }
        
        // 获取收藏数量
        const favoritesCount = await db.collection('user_favorites')
            .countDocuments({ user_id: userId });
        
        // 计算会员天数
        const joinDate = user.join_date || user.created_at;
        const today = new Date();
        const memberDays = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24)) + 1;
        
        res.json({
            success: true,
            stats: {
                favorites_count: favoritesCount,
                downloads_count: user.download_count || 0,
                member_days: memberDays
            }
        });
        
    } catch (error) {
        console.error('获取用户统计错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取统计信息失败' 
        });
    }
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
async function startServer() {
    await connectDB();
    
    app.listen(PORT, () => {
        console.log('='.repeat(60));
        console.log('🚀 小说下载站服务器启动成功!');
        console.log('📍 访问地址: http://localhost:' + PORT);
        console.log('🗄️  数据库: MongoDB Atlas');
        console.log('⏰ 启动时间: ' + new Date().toLocaleString());
        console.log('='.repeat(60));
    });
}

startServer().catch(console.error);