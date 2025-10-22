document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const backToHomeBtn = document.getElementById('back-to-home');
    const favoritesBtn = document.getElementById('favorites-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const favoritesSection = document.getElementById('favorites-section');
    const settingsSection = document.getElementById('settings-section');
    const favoritesContainer = document.getElementById('favorites-container');
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logout-btn');
    const favoritesCount = document.getElementById('favorites-count');
    const downloadsCount = document.getElementById('downloads-count');
    const memberDays = document.getElementById('member-days');
    
    // 主题切换元素
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    
    // 修改密码相关元素
    const changePasswordBtn = document.getElementById('change-password-btn');
    const changePasswordModal = document.getElementById('change-password-modal');
    const changePasswordForm = document.getElementById('change-password-form');
    const changePasswordCancel = document.getElementById('change-password-cancel');
    
    // 关于我们相关元素
    const aboutBtn = document.getElementById('about-btn');
    const aboutModal = document.getElementById('about-modal');
    const aboutCloseBtn = document.getElementById('about-close-btn');

    // 检查用户是否登录
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        alert('请先登录！');
        window.location.href = '/';
        return;
    }

    // 显示用户名
    usernameDisplay.textContent = currentUser.username;

    // 初始化主题
    initTheme();

    // 回到主页
    backToHomeBtn.addEventListener('click', function() {
        window.location.href = '/';
    });

    // 退出登录
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('currentUser');
        alert('已退出登录');
        window.location.href = '/';
    });

    // 切换选项
    favoritesBtn.addEventListener('click', function() {
        setActiveTab('favorites');
        loadFavorites();
    });

    settingsBtn.addEventListener('click', function() {
        setActiveTab('settings');
        loadSettings();
    });

    // 主题切换
    themeToggle.addEventListener('click', toggleTheme);

    // 修改密码按钮点击事件
    changePasswordBtn.addEventListener('click', function() {
        changePasswordModal.style.display = 'flex';
        changePasswordForm.reset();
    });

    // 修改密码取消按钮
    changePasswordCancel.addEventListener('click', function() {
        changePasswordModal.style.display = 'none';
    });

    // 修改密码表单提交
    changePasswordForm.addEventListener('submit', function(e) {
        e.preventDefault();
        changePassword();
    });

    // 关于我们按钮点击事件
    aboutBtn.addEventListener('click', function() {
        aboutModal.style.display = 'flex';
    });

    // 关于我们关闭按钮
    aboutCloseBtn.addEventListener('click', function() {
        aboutModal.style.display = 'none';
    });

    // 点击模态框外部关闭
    window.addEventListener('click', function(e) {
        if (e.target === changePasswordModal) {
            changePasswordModal.style.display = 'none';
        }
        if (e.target === aboutModal) {
            aboutModal.style.display = 'none';
        }
    });

    // 设置活动标签页
    function setActiveTab(tab) {
        favoritesBtn.classList.toggle('active', tab === 'favorites');
        settingsBtn.classList.toggle('active', tab === 'settings');
        favoritesSection.classList.toggle('profile-hidden', tab !== 'favorites');
        settingsSection.classList.toggle('profile-hidden', tab !== 'settings');
    }

    // 初始化主题
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeUI(savedTheme);
    }

    // 切换主题
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeUI(newTheme);
    }

    // 更新主题UI
    function updateThemeUI(theme) {
        if (theme === 'dark') {
            themeIcon.textContent = '☀️';
            themeText.textContent = '切换到白天模式';
        } else {
            themeIcon.textContent = '🌙';
            themeText.textContent = '切换到黑夜模式';
        }
    }

    // 修改密码函数
    function changePassword() {
        const oldPassword = document.getElementById('old-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmNewPassword = document.getElementById('confirm-new-password').value;

        if (!oldPassword || !newPassword || !confirmNewPassword) {
            alert('请填写所有密码字段');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            alert('新密码与确认密码不一致');
            return;
        }

        if (newPassword.length < 6) {
            alert('新密码长度至少6位');
            return;
        }

        // 发送修改密码请求
        fetch('/api/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.user_id,
                oldPassword: oldPassword,
                newPassword: newPassword
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('密码修改成功！');
                changePasswordModal.style.display = 'none';
                changePasswordForm.reset();
            } else {
                alert('密码修改失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('修改密码错误:', error);
            alert('修改密码失败，请检查网络连接');
        });
    }

    // 加载收藏列表
    async function loadFavorites() {
        try {
            const response = await fetch(`/api/favorites/${currentUser.user_id}`);
            const data = await response.json();
            
            if (data.success) {
                displayFavorites(data.favorites);
            } else {
                favoritesContainer.innerHTML = '<p class="no-results">加载收藏失败</p>';
            }
        } catch (error) {
            console.error('加载收藏错误:', error);
            favoritesContainer.innerHTML = '<p class="no-results">加载收藏失败</p>';
        }
    }

    // 取消收藏
    async function removeFavorite(index) {
        try {
            const favorites = await getFavorites();
            const removedBook = favorites[index];
            
            const response = await fetch('/api/favorites', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: currentUser.user_id,
                    novel_title: removedBook.novel_title
                })
            });
            
            const data = await response.json();
            if (data.success) {
                loadFavorites();
                alert(`已取消收藏《${removedBook.novel_title}》`);
            }
        } catch (error) {
            console.error('取消收藏错误:', error);
            alert('取消收藏失败');
        }
    }

    // 获取收藏列表
    async function getFavorites() {
        const response = await fetch(`/api/favorites/${currentUser.user_id}`);
        const data = await response.json();
        return data.success ? data.favorites : [];
    }

    // 加载设置界面
    function loadSettings() {
        const favorites = JSON.parse(localStorage.getItem('userFavorites') || '[]');
        const downloadCount = parseInt(localStorage.getItem('userDownloadCount') || '0');
        
        // 更新统计数据
        favoritesCount.textContent = favorites.length;
        downloadsCount.textContent = downloadCount;
        
        // 计算会员天数
        const joinDate = localStorage.getItem('userJoinDate') || new Date().toISOString();
        const joinDay = new Date(joinDate);
        const today = new Date();
        const days = Math.floor((today - joinDay) / (1000 * 60 * 60 * 24)) + 1;
        memberDays.textContent = days;
    }

    // 下载小说
    function downloadNovel(book) {
        if (!book.title) {
            alert('无法获取小说信息');
            return;
        }
        
        // 更新下载计数
        let downloadCount = parseInt(localStorage.getItem('userDownloadCount') || '0');
        downloadCount++;
        localStorage.setItem('userDownloadCount', downloadCount.toString());
        
        const downloadUrl = `/api/download?q=${encodeURIComponent(book.title)}&n=1&token=${currentUser.user_id}`;
        
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${book.title}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        alert(`正在下载《${book.title}》，请稍候...`);
    }

    // 获取默认封面
    function getDefaultCover(title) {
        const colors = ['#6a11cb', '#2575fc', '#27ae60', '#e67e22', '#e74c3c'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140" viewBox="0 0 100 140"><rect width="100" height="140" fill="${color}"/><text x="50" y="70" font-family="Arial" font-size="14" fill="white" text-anchor="middle">${title ? title.substring(0, 2) : '小说'}</text></svg>`;
    }

    // 初始化加载收藏列表
    loadFavorites();
    
    // 设置用户加入日期（如果是第一次）
    if (!localStorage.getItem('userJoinDate')) {
        localStorage.setItem('userJoinDate', new Date().toISOString());
    }
});