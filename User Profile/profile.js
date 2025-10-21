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
    const oldPasswordInput = document.getElementById('old-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmNewPasswordInput = document.getElementById('confirm-new-password');
    
    // 关于我们相关元素
    const aboutBtn = document.getElementById('about-btn');
    const aboutModal = document.getElementById('about-modal');
    const aboutCloseBtn = document.getElementById('about-close-btn');

    // 检查用户是否登录
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        alert('请先登录！');
        window.location.href = '../index.html';
        return;
    }

    // 显示用户名
    usernameDisplay.textContent = currentUser.username;

    // 初始化主题
    initTheme();

    // 回到主页
    backToHomeBtn.addEventListener('click', function() {
        window.location.href = '../index.html';
    });

    // 退出登录
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('currentUser');
        alert('已退出登录');
        window.location.href = '../index.html';
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
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function() {
            changePasswordModal.style.display = 'flex';
            // 清空表单
            changePasswordForm.reset();
        });
    }

    // 修改密码取消按钮
    if (changePasswordCancel) {
        changePasswordCancel.addEventListener('click', function() {
            changePasswordModal.style.display = 'none';
        });
    }

    // 修改密码表单提交
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            changePassword();
        });
    }

    // 关于我们按钮点击事件
    if (aboutBtn) {
        aboutBtn.addEventListener('click', function() {
            aboutModal.style.display = 'flex';
        });
    }

    // 关于我们关闭按钮
    if (aboutCloseBtn) {
        aboutCloseBtn.addEventListener('click', function() {
            aboutModal.style.display = 'none';
        });
    }

    // 新密码输入时实时验证
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', validatePassword);
    }

    // 确认新密码输入时实时验证
    if (confirmNewPasswordInput) {
        confirmNewPasswordInput.addEventListener('input', validatePasswordMatch);
    }

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
        // 更新按钮状态
        favoritesBtn.classList.toggle('active', tab === 'favorites');
        settingsBtn.classList.toggle('active', tab === 'settings');
        
        // 更新内容显示
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
        const oldPassword = oldPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmNewPassword = confirmNewPasswordInput.value;

        // 基础验证
        if (!oldPassword || !newPassword || !confirmNewPassword) {
            alert('请填写所有密码字段');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            alert('新密码与确认密码不一致');
            return;
        }

        if (oldPassword === newPassword) {
            alert('新密码不能与旧密码相同');
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

    // 密码强度验证
    function validatePassword() {
        const password = newPasswordInput.value;
        // 这里可以添加更复杂的密码强度验证逻辑
    }

    // 密码匹配验证
    function validatePasswordMatch() {
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmNewPasswordInput.value;
        
        if (confirmPassword && newPassword !== confirmPassword) {
            confirmNewPasswordInput.style.borderColor = '#e74c3c';
        } else {
            confirmNewPasswordInput.style.borderColor = '';
        }
    }

    // 加载收藏列表
    function loadFavorites() {
        const favorites = JSON.parse(localStorage.getItem('userFavorites') || '[]');
        displayFavorites(favorites);
    }

    // 显示收藏列表
    function displayFavorites(favorites) {
        favoritesContainer.innerHTML = '';
        
        if (favorites.length === 0) {
            favoritesContainer.innerHTML = '<p class="no-results">暂无收藏的小说</p>';
            return;
        }
        
        favorites.forEach((book, index) => {
            const favoriteItem = document.createElement('div');
            favoriteItem.className = 'result-item';
            
            favoriteItem.innerHTML = `
                <div class="book-info">
                    <div class="book-cover">
                        <img src="${book.cover}" alt="${book.title}" onerror="this.src='${getDefaultCover(book.title)}'">
                    </div>
                    <div class="book-details">
                        <div class="book-title">${book.title}</div>
                        <div class="book-author">作者: ${book.author}</div>
                        <div class="book-added">
                            收藏于: ${new Date(book.addedAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="profile-favorite-btn favorited" data-index="${index}">❤️</button>
                    <button class="download-btn-small" data-title="${book.title}">下载</button>
                </div>
            `;
            
            favoritesContainer.appendChild(favoriteItem);
        });
        
        // 为收藏列表中的下载按钮添加事件
        document.querySelectorAll('#favorites-container .download-btn-small').forEach(btn => {
            btn.addEventListener('click', function() {
                const title = this.getAttribute('data-title');
                downloadNovel({ title: title });
            });
        });
        
        // 为收藏列表中的收藏按钮添加事件（取消收藏）
        document.querySelectorAll('#favorites-container .profile-favorite-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = this.getAttribute('data-index');
                removeFavorite(index, this);
            });
        });
    }

    // 取消收藏
    function removeFavorite(index, button) {
        let favorites = JSON.parse(localStorage.getItem('userFavorites') || '[]');
        favorites.splice(index, 1);
        localStorage.setItem('userFavorites', JSON.stringify(favorites));
        
        // 重新加载收藏列表
        loadFavorites();
    }

    // 加载设置界面
    function loadSettings() {
        const favorites = JSON.parse(localStorage.getItem('userFavorites') || '[]');
        const downloadCount = parseInt(localStorage.getItem('userDownloadCount') || '0');
        const joinDate = localStorage.getItem('userJoinDate') || new Date().toISOString();
        
        // 更新统计数据
        favoritesCount.textContent = favorites.length;
        downloadsCount.textContent = downloadCount;
        
        // 计算会员天数
        const joinDay = new Date(joinDate);
        const today = new Date();
        const days = Math.floor((today - joinDay) / (1000 * 60 * 60 * 24)) + 1;
        memberDays.textContent = days;
        
        // 添加设置按钮事件
        setupSettingButtons();
    }

    // 设置按钮事件
    function setupSettingButtons() {
        document.getElementById('view-profile-btn').addEventListener('click', function() {
            alert('个人信息功能开发中...');
        });
        
        document.getElementById('download-settings-btn').addEventListener('click', function() {
            alert('下载设置功能开发中...');
        });
        
        document.getElementById('privacy-settings-btn').addEventListener('click', function() {
            alert('隐私设置功能开发中...');
        });
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

    // 获取默认封面（与主界面相同）
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