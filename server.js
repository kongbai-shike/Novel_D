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
const API_KEY = process.env.API_KEY || 'a14b5cdff147b1262882db2ca29355bd';
const BASE_URL = 'https://api.xcvts.cn/api/xiaoshuo/axdzs';

// 静态文件服务 - 修复路径问题
app.use(express.static(__dirname));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// 显式处理各种静态文件类型
app.get(['*.css', '*.js', '*.html', '*.png', '*.jpg', '*.svg', '*.ico'], (req, res) => {
  const filePath = path.join(__dirname, req.path);
  
  // 设置正确的Content-Type
  const ext = path.extname(req.path);
  const contentTypes = {
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.html': 'text/html',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  
  res.setHeader('Content-Type', contentTypes[ext] || 'text/plain');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.log(`文件未找到: ${req.path}`);
      res.status(404).send('文件未找到');
    }
  });
});

// 处理个人资料目录
app.use('/User%20Profile', express.static(path.join(__dirname, 'User Profile')));

// 页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'User Profile', 'profile.html'));
});

app.get('/User%20Profile/profile.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'User Profile', 'profile.html'));
});

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

// 数据库连接（简化版，用于演示）
let dbClient = null;

async function initDatabase() {
  try {
    // 在Vercel环境中使用环境变量连接数据库
    if (process.env.POSTGRES_URL) {
      dbClient = createClient({
        connectionString: process.env.POSTGRES_URL
      });
      await dbClient.connect();
      
      // 创建users表（如果不存在）
      await dbClient.sql`
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
    } else {
      console.log('⚠️  没有数据库连接，使用内存存储');
      // 使用内存存储作为fallback
      dbClient = {
        users: new Map(),
        nextId: 1
      };
    }
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    // 使用内存存储作为fallback
    dbClient = {
      users: new Map(),
      nextId: 1
    };
  }
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
    
    // 内存存储版本
    if (dbClient.users) {
      const user = Array.from(dbClient.users.values()).find(u => u.username === username);
      
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
      
      // 更新最后登录时间
      user.last_login = new Date();
      
      res.json({
        success: true,
        message: '登录成功',
        username: user.username,
        user_id: user.id
      });
    } 
    // PostgreSQL版本
    else {
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
      
      res.json({
        success: true,
        message: '登录成功',
        username: user.username,
        user_id: user.id
      });
    }
    
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
    
    // 内存存储版本
    if (dbClient.users) {
      // 检查用户名是否已存在
      const existingUser = Array.from(dbClient.users.values()).find(u => u.username === username);
      if (existingUser) {
        return res.status(409).json({ 
          success: false, 
          message: '用户名已存在' 
        });
      }
      
      // 创建新用户
      const newUser = {
        id: dbClient.nextId++,
        username,
        password,
        email: '',
        download_count: 0,
        created_at: new Date(),
        last_login: new Date()
      };
      
      dbClient.users.set(newUser.id, newUser);
      
      res.status(201).json({
        success: true,
        message: '注册成功',
        username: username,
        user_id: newUser.id
      });
    } 
    // PostgreSQL版本
    else {
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
    }
    
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
            return res.status(400).json({ 
                status: 'error',
                message: '缺少查询参数 q' 
            });
        }
        
        console.log(`搜索小说: ${query}`);
        
        // 构建API请求URL
        const apiUrl = `${BASE_URL}?apiKey=${API_KEY}&q=${encodeURIComponent(query)}`;
        
        // 发送请求到原始API
        const data = await makeRequest(apiUrl);
        
        // 返回数据给前端
        res.json(data);
    } catch (error) {
        console.error('搜索代理错误:', error);
        res.status(500).json({ 
            status: 'error',
            message: '搜索失败: ' + error.message 
        });
    }
});

// 下载路由
app.get('/api/download', async (req, res) => {
    try {
        const { q, n, token } = req.query;
        
        if (!q || !n) {
            return res.status(400).json({ 
                success: false,
                message: '缺少必要的查询参数' 
            });
        }
        
        // 检查用户是否登录
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: '请先登录后再下载' 
            });
        }
        
        // 内存存储版本的用户验证
        if (dbClient.users) {
          const user = dbClient.users.get(parseInt(token));
          if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: '用户验证失败，请重新登录' 
            });
          }
          // 更新下载计数
          user.download_count = (user.download_count || 0) + 1;
        } 
        // PostgreSQL版本的用户验证
        else {
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
        }
        
        // 构建下载URL
        const downloadUrl = `${BASE_URL}?apiKey=${API_KEY}&q=${encodeURIComponent(q)}&n=${n}`;
        
        console.log(`下载重定向: ${downloadUrl}`);
        
        // 重定向到下载链接
        res.redirect(downloadUrl);
    } catch (error) {
        console.error('下载代理错误:', error);
        res.status(500).json({ 
            success: false,
            message: '下载失败: ' + error.message 
        });
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

    // 内存存储版本
    if (dbClient.users) {
      const user = dbClient.users.get(parseInt(userId));
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: '用户不存在' 
        });
      }

      // 验证旧密码
      if (oldPassword !== user.password) {
        return res.status(401).json({ 
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
    }
    // PostgreSQL版本
    else {
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
    }

  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '修改密码失败: ' + error.message 
    });
  }
});

// 健康检查路由
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '服务器运行正常',
    timestamp: new Date().toISOString()
  });
});

// 404处理
app.use('*', (req, res) => {
  const requestedPath = req.originalUrl;
  
  // 如果是API请求，返回JSON错误
  if (requestedPath.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `API端点未找到: ${requestedPath}`
    });
  }
  
  // 否则返回HTML页面
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
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404 - 页面未找到</h1>
        <p>请求的页面 <strong>${requestedPath}</strong> 不存在。</p>
        <p><a href="/">返回首页</a></p>
      </div>
    </body>
    </html>
  `);
});

// 启动服务器
async function startServer() {
    try {
        await initDatabase();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
            console.log(`📁 静态文件服务目录: ${__dirname}`);
            console.log(`🔑 API密钥状态: ${API_KEY ? '已设置' : '未设置'}`);
        });
    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

startServer();

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到SIGTERM信号，正在关闭服务器...');
    if (dbClient && dbClient.end) {
        dbClient.end();
    }
    process.exit(0);
});

// 导出app给Vercel使用
module.exports = app;