const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const { createClient } = require('@vercel/postgres');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API配置
const API_KEY = process.env.API_KEY;
const BASE_URL = 'https://api.xcvts.cn/api/xiaoshuo/axdzs';

// 初始化数据库
async function initDatabase() {
  try {
    const client = createClient();
    await client.connect();

    // 创建users表
    await client.sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        download_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✅ 数据库初始化成功');
    return client;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    return null;
  }
}

let dbClient;

// 使用Node.js内置https模块
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

// 用户登录路由
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名和密码不能为空' 
      });
    }
    
    // 查询用户
    const result = await dbClient.sql`
      SELECT id, username, password FROM users WHERE username = ${username}
    `;
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }
    
    const user = result.rows[0];
    
    // 验证密码（简化版，实际应该使用加密）
    if (password !== user.password) {
      return res.status(401).json({ 
        success: false, 
        message: '密码错误' 
      });
    }
    
    // 更新最后登录时间
    await dbClient.sql`
      UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ${user.id}
    `;
    
    // 登录成功
    res.json({
      success: true,
      message: '登录成功',
      username: user.username,
      user_id: user.id
    });
    
  } catch (error) {
    console.error('登录错误详情:', error);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误: ' + error.message 
    });
  }
});

// 用户注册路由
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;
    
    if (!username || !password || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '请输入完整的注册信息' 
      });
    }
    
    // 验证密码一致性
    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '两次输入的密码不一致' 
      });
    }
    
    // 检查用户名是否已存在
    const existingResult = await dbClient.sql`
      SELECT id FROM users WHERE username = ${username}
    `;
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: '用户名已存在' 
      });
    }
    
    // 创建新用户
    const result = await dbClient.sql`
      INSERT INTO users (username, password, email) 
      VALUES (${username}, ${password}, '')
      RETURNING id
    `;
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      username: username,
      user_id: result.rows[0].id
    });
    
  } catch (error) {
    console.error('注册错误详情:', error);
    res.status(500).json({ 
      success: false, 
      message: '注册失败: ' + error.message 
    });
  }
});

// 搜索路由
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        
        if (!query) {
            return res.status(400).json({ error: '缺少查询参数 q' });
        }
        
        // 构建API请求URL
        const apiUrl = `${BASE_URL}?apiKey=${API_KEY}&q=${encodeURIComponent(query)}`;
        
        // 发送请求到原始API
        const data = await makeRequest(apiUrl);
        
        // 返回数据给前端
        res.json(data);
    } catch (error) {
        console.error('代理服务器错误:', error);
        res.status(500).json({ error: '服务器内部错误: ' + error.message });
    }
});

// 下载路由
app.get('/api/download', async (req, res) => {
    try {
        const { q, n, token } = req.query;
        
        if (!q || !n) {
            return res.status(400).json({ error: '缺少必要的查询参数' });
        }
        
        // 检查用户是否登录
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: '请先登录后再下载' 
            });
        }
        
        // 验证用户是否存在
        const userResult = await dbClient.sql`
          SELECT id FROM users WHERE id = ${token}
        `;
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: '用户验证失败，请重新登录' 
            });
        }
        
        // 增加用户下载次数
        await dbClient.sql`
          UPDATE users SET download_count = download_count + 1 WHERE id = ${token}
        `;
        
        // 构建下载URL
        const downloadUrl = `${BASE_URL}?apiKey=${API_KEY}&q=${encodeURIComponent(q)}&n=${n}`;
        
        // 重定向到下载链接
        res.redirect(downloadUrl);
    } catch (error) {
        console.error('下载代理错误:', error);
        res.status(500).json({ error: '下载失败: ' + error.message });
    }
});

// 修改密码路由
app.post('/api/change-password', async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供完整的参数' 
      });
    }

    // 检查旧密码是否正确
    const userResult = await dbClient.sql`
      SELECT id, password FROM users WHERE id = ${userId}
    `;

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    const user = userResult.rows[0];

    // 验证旧密码
    if (oldPassword !== user.password) {
      return res.status(401).json({ 
        success: false, 
        message: '旧密码错误' 
      });
    }

    // 更新密码
    await dbClient.sql`
      UPDATE users SET password = ${newPassword} WHERE id = ${userId}
    `;

    res.json({
      success: true,
      message: '密码修改成功'
    });

  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '修改密码失败: ' + error.message 
    });
  }
});

// 提供静态文件
app.use(express.static('.'));

// 根路径返回首页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
async function startServer() {
    dbClient = await initDatabase();
    
    if (!dbClient) {
        console.log('❌ 数据库初始化失败，服务器无法启动');
        return;
    }
    
    app.listen(PORT, () => {
        console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    });
}

startServer();

// 导出app给Vercel使用
module.exports = app;