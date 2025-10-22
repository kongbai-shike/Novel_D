document.addEventListener('DOMContentLoaded', function() {
    // 初始化主题
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // 获取DOM元素
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const resultsContainer = document.getElementById('results-container');
    const backToTopBtn = document.getElementById('back-to-top');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginCancel = document.getElementById('login-cancel');
    const registerCancel = document.getElementById('register-cancel');
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');

    // 用户状态
    let currentUser = null;
    let currentSearchResults = [];

    // 初始化
    initAuth();
    loadSearchHistory();

    // 搜索功能
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // 回到顶部功能
    backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // 登录/注册模态框功能
    loginBtn.addEventListener('click', function() {
        loginModal.style.display = 'flex';
    });

    registerBtn.addEventListener('click', function() {
        registerModal.style.display = 'flex';
    });

    loginCancel.addEventListener('click', function() {
        loginModal.style.display = 'none';
    });

    registerCancel.addEventListener('click', function() {
        registerModal.style.display = 'none';
    });

    switchToRegister.addEventListener('click', function() {
        loginModal.style.display = 'none';
        registerModal.style.display = 'flex';
    });

    switchToLogin.addEventListener('click', function() {
        registerModal.style.display = 'none';
        loginModal.style.display = 'flex';
    });

    // 点击模态框外部关闭
    window.addEventListener('click', function(e) {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
        }
        if (e.target === registerModal) {
            registerModal.style.display = 'none';
        }
    });

    // 登录表单提交
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        loginUser();
    });

    // 注册表单提交
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        registerUser();
    });

    // 初始化认证状态
    function initAuth() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            updateAuthUI();
        }
    }

    // 更新认证UI
    function updateAuthUI() {
        if (currentUser) {
            loginBtn.textContent = currentUser.username;
            loginBtn.onclick = function() {
                // 跳转到个人界面
                window.location.href = '/profile';
            };
            registerBtn.textContent = '退出';
            registerBtn.onclick = logoutUser;
        } else {
            loginBtn.textContent = '登录';
            loginBtn.onclick = function() {
                loginModal.style.display = 'flex';
            };
            registerBtn.textContent = '注册';
            registerBtn.onclick = function() {
                registerModal.style.display = 'flex';
            };
        }
    }

    // 用户登录
    function loginUser() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            alert('请输入用户名和密码');
            return;
        }

        fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentUser = {
                    username: data.username,
                    user_id: data.user_id
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateAuthUI();
                loginModal.style.display = 'none';
                alert('登录成功！');
            } else {
                alert('登录失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('登录错误:', error);
            alert('登录失败，请检查网络连接');
        });
    }

    // 用户注册
    function registerUser() {
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        if (!username || !password || !confirmPassword) {
            alert('请填写完整信息');
            return;
        }

        if (password !== confirmPassword) {
            alert('两次输入的密码不一致');
            return;
        }

        fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password,
                confirmPassword: confirmPassword
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('注册成功！请登录');
                registerModal.style.display = 'none';
                loginModal.style.display = 'flex';
            } else {
                alert('注册失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('注册错误:', error);
            alert('注册失败，请检查网络连接');
        });
    }

    // 用户退出
    function logoutUser() {
        currentUser = null;
        localStorage.removeItem('currentUser');
        updateAuthUI();
        alert('已退出登录');
    }

    // 执行搜索
    function performSearch() {
        const query = searchInput.value.trim();
        
        if (!query) {
            alert('请输入要搜索的小说名称');
            return;
        }
        
        // 显示加载状态
        showLoading();
        
        console.log('开始搜索:', query);
        
        // 调用后端搜索API
        fetch(`/api/search?q=${encodeURIComponent(query)}`)
            .then(response => {
                console.log('收到响应:', response.status);
                if (!response.ok) {
                    throw new Error('网络请求失败: ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                console.log('搜索数据:', data);
                hideLoading();
                
                if (data.status === 'success' && data.count > 0) {
                    currentSearchResults = data.results;
                    displayResults(currentSearchResults);
                    saveSearchHistory(query, currentSearchResults);
                } else {
                    alert('未找到相关小说，请尝试其他关键词');
                    resultsContainer.innerHTML = '<p class="no-results">未找到相关小说</p>';
                }
            })
            .catch(error => {
                hideLoading();
                console.error('搜索错误:', error);
                alert('搜索失败: ' + error.message);
                resultsContainer.innerHTML = '<p class="no-results">搜索失败，请稍后重试</p>';
            });
    }

    // 显示加载状态
    function showLoading() {
        searchBtn.disabled = true;
        searchBtn.textContent = '搜索中...';
    }

    // 隐藏加载状态
    function hideLoading() {
        searchBtn.disabled = false;
        searchBtn.textContent = '搜索';
    }

    // 显示搜索结果
    function displayResults(results) {
        console.log('显示结果:', results);
        resultsContainer.innerHTML = '';
        
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">未找到相关小说</p>';
            return;
        }
        
        results.forEach((item, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            // 使用API返回的封面图片，如果没有则使用默认封面
            const coverUrl = item.cover || getDefaultCover(item.title);
            
            // 检查是否已收藏
            const isFavorited = checkIfFavorited(item.title);
            
            resultItem.innerHTML = `
                <div class="book-info">
                    <div class="book-cover">
                        <img src="${coverUrl}" alt="${item.title}" onerror="this.src='${getDefaultCover(item.title)}'">
                    </div>
                    <div class="book-details">
                        <div class="book-title">${item.title || '未知书名'}</div>
                        <div class="book-author">作者: ${item.author || '未知作者'}</div>
                        ${item.source ? `<div class="book-source">来源: ${item.source}</div>` : ''}
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-index="${index}">
                        ${isFavorited ? '❤️' : '🤍'}
                    </button>
                    <button class="download-btn-small" data-index="${index}">下载</button>
                </div>
            `;
            
            resultsContainer.appendChild(resultItem);
        });
        
        // 添加下载按钮事件
        document.querySelectorAll('.download-btn-small').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = this.getAttribute('data-index');
                downloadNovel(currentSearchResults[index]);
            });
        });
        
        // 添加收藏按钮事件
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = this.getAttribute('data-index');
                toggleFavorite(currentSearchResults[index], this);
            });
        });
    }

    // 获取默认封面（当API没有返回封面时使用）
    function getDefaultCover(title) {
        const colors = ['#6a11cb', '#2575fc', '#27ae60', '#e67e22', '#e74c3c'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140" viewBox="0 0 100 140"><rect width="100" height="140" fill="${color}"/><text x="50" y="70" font-family="Arial" font-size="14" fill="white" text-anchor="middle">${title ? title.substring(0, 2) : '小说'}</text></svg>`;
    }

    // 下载小说
    function downloadNovel(book) {
        if (!currentUser) {
            alert('请先登录后再下载小说！');
            loginModal.style.display = 'flex';
            return;
        }
        
        if (!book.title) {
            alert('无法获取小说信息');
            return;
        }
        
        // 创建下载链接（携带用户token）
        const downloadUrl = `/api/download?q=${encodeURIComponent(book.title)}&n=1&token=${currentUser.user_id}`;
        
        // 创建一个隐藏的a标签触发下载
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${book.title}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // 显示下载提示
        alert(`正在下载《${book.title}》，请稍候...`);
    }

    // 检查是否已收藏
    function checkIfFavorited(bookTitle) {
        const favorites = JSON.parse(localStorage.getItem('userFavorites') || '[]');
        return favorites.some(fav => fav.title === bookTitle);
    }

    // 切换收藏状态
    function toggleFavorite(book, button) {
        if (!currentUser) {
            alert('请先登录后再收藏小说！');
            loginModal.style.display = 'flex';
            return;
        }
        
        let favorites = JSON.parse(localStorage.getItem('userFavorites') || '[]');
        const existingIndex = favorites.findIndex(fav => fav.title === book.title);
        
        if (existingIndex !== -1) {
            // 取消收藏
            favorites.splice(existingIndex, 1);
            button.classList.remove('favorited');
            button.textContent = '🤍';
        } else {
            // 添加收藏
            favorites.push({
                title: book.title,
                author: book.author || '未知作者',
                cover: book.cover || getDefaultCover(book.title),
                addedAt: new Date().toISOString()
            });
            button.classList.add('favorited');
            button.textContent = '❤️';
        }
        
        localStorage.setItem('userFavorites', JSON.stringify(favorites));
    }

    // 保存搜索历史到本地存储
    function saveSearchHistory(query, results) {
        const searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        
        // 避免重复
        const existingIndex = searchHistory.findIndex(item => item.query === query);
        if (existingIndex !== -1) {
            searchHistory.splice(existingIndex, 1);
        }
        
        // 添加到开头
        searchHistory.unshift({
            query: query,
            results: results.slice(0, 5), // 只保存前5个结果
            timestamp: new Date().toISOString()
        });
        
        // 只保留最近10次搜索
        if (searchHistory.length > 10) {
            searchHistory.splice(10);
        }
        
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    }

    // 加载搜索历史
    function loadSearchHistory() {
        const searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        if (searchHistory.length > 0) {
            // 显示最近一次搜索的结果
            const lastSearch = searchHistory[0];
            currentSearchResults = lastSearch.results;
            displayResults(currentSearchResults);
        }
    }
});