const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API配置
const API_KEY = process.env.API_KEY || 'a14b5cdff147b1262882db2ca29355bd';
const BASE_URL = 'https://api.xcvts.cn/api/xiaoshuo/axdzs';

// 简单的内存数据库
const users = new Map();
let nextId = 3;

// 初始化示例用户
users.set(1, { id: 1, username: 'admin', password: 'admin123', email: 'admin@example.com', download_count: 0 });
users.set(2, { id: 2, username: 'test', password: 'test123', email: 'test@example.com', download_count: 0 });

// 静态文件服务
app.use(express.static(__dirname));

// 页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'User Profile', 'profile.html'));
});

// HTTPS 请求函数
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

// API 路由
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名和密码不能为空' 
      });
    }
    
    const user = Array.from(users.values()).find(u => u.username === username);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }
    
    if (password !== user.password) {
      return res.status(401).json({ 
        success: false, 
        message: '密码错误' 
      });
    }
    
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
      message: '服务器内部错误' 
    });
  }
});

app.post('/api/register', (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;
    
    if (!username || !password || !confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '请输入完整的注册信息' 
      });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '两次输入的密码不一致' 
      });
    }
    
    const existingUser = Array.from(users.values()).find(u => u.username === username);
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: '用户名已存在' 
      });
    }
    
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
    
    res.status(201).json({
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

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query) {
      return res.status(400).json({ 
        status: 'error',
        message: '缺少查询参数 q' 
      });
    }
    
    const apiUrl = `${BASE_URL}?apiKey=${API_KEY}&q=${encodeURIComponent(query)}`;
    const data = await makeRequest(apiUrl);
    
    res.json(data);
  } catch (error) {
    console.error('搜索错误:', error);
    res.status(500).json({ 
      status: 'error',
      message: '搜索失败' 
    });
  }
});

app.get('/api/download', (req, res) => {
  try {
    const { q, n, token } = req.query;
    
    if (!q || !n) {
      return res.status(400).json({ 
        success: false,
        message: '缺少必要的查询参数' 
      });
    }
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: '请先登录后再下载' 
      });
    }
    
    const user = users.get(parseInt(token));
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: '用户验证失败，请重新登录' 
      });
    }
    
    user.download_count = (user.download_count || 0) + 1;
    
    const downloadUrl = `${BASE_URL}?apiKey=${API_KEY}&q=${encodeURIComponent(q)}&n=${n}`;
    res.redirect(downloadUrl);
    
  } catch (error) {
    console.error('下载错误:', error);
    res.status(500).json({ 
      success: false,
      message: '下载失败' 
    });
  }
});

app.post('/api/change-password', (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供完整的参数' 
      });
    }

    const user = users.get(parseInt(userId));
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    if (oldPassword !== user.password) {
      return res.status(401).json({ 
        success: false, 
        message: '旧密码错误' 
      });
    }

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

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '服务器运行正常',
    timestamp: new Date().toISOString()
  });
});

// 导出给 Vercel
module.exports = app;
