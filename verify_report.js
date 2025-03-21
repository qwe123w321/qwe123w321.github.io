import { 
    auth, 
    db, 
    storage, 
    onAuthStateChanged, 
    doc, 
    getDoc, 
    collection,
    signOut
} from './firebase-config.js';

// 从统一的 App Check 模块导入需要的函数
import { 
    checkAppCheckStatus,
    getAppCheckToken,
    installXHRInterceptor,
    runFullDiagnostics
} from './app-check-module.js';

// 全局变量
let currentReportId = null;
let currentPage = 1;
let reportsPerPage = 12;
let totalReports = 0;
let isProcessingAuthChange = false;

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    console.log('開始初始化管理後台頁面...');
    
    // 检查 App Check 状态
    setTimeout(async () => {
        console.log('正在檢查 App Check 狀態...');
        try {
            const result = await checkAppCheckStatus();
            if (result.success) {
                console.log('App Check 驗證成功！');
                // 安装XHR拦截器来添加App Check令牌
                installXHRInterceptor();
            } else {
                console.error('App Check 驗證失敗，可能導致未經驗證的請求錯誤');
                // 添加错误提示
                addAppCheckWarning();
            }
        } catch (error) {
            console.error('檢查 App Check 狀態時發生錯誤:', error);
        }
    }, 1000);
    
    // 初始化页面元素
    initializePage();
    
    // 设置认证状态监听器
    setupAuthStateListener();
});

// 初始化页面元素
function initializePage() {
    console.log('開始初始化頁面');
    
    // 检查DOM元素是否正确获取
    if (!document.getElementById('loginSection')) console.error('無法找到loginSection元素');
    if (!document.getElementById('main-content')) console.error('無法找到mainContent元素');
    if (!document.getElementById('logoutButton')) console.error('無法找到logoutButton元素');
    if (!document.getElementById('userStatus')) console.error('無法找到userStatus元素');
    
    // 登录按钮事件
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
        console.log('已綁定登入按鈕事件');
    }
    
    // 登出按钮事件
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
        console.log('已綁定登出按鈕事件');
    }
    
    // 返回列表按钮事件
    const backToListBtn = document.getElementById('backToList');
    if (backToListBtn) {
        backToListBtn.addEventListener('click', function() {
            document.getElementById('report-detail').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
        });
        console.log('已綁定返回列表按鈕事件');
    }
    
    // 标签页切换事件
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // 切换标签页样式
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 切换内容区
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.classList.remove('active'));
            
            const targetContent = document.getElementById(`${tabId}-tab`);
            if (targetContent) {
                targetContent.classList.add('active');
                
                // 根据标签页加载相应数据
                if (tabId === 'statistics') {
                    loadStatistics();
                } else if (tabId === 'history') {
                    loadHistory();
                } else if (tabId === 'frequentReports') {
                    loadFrequentReports();
                } else if (tabId === 'verification') {
                    loadVerificationRequests();
                } else if (tabId === 'report') {
                    loadReports();
                } else if (tabId === 'businessApproval') {
                    loadBusinessApprovalRequests();
                }
            } else {
                console.error(`找不到標籤頁內容元素: ${tabId}-tab`);
            }
        });
    });
    console.log('已綁定標籤頁切換事件');
    
    // 应用过滤按钮事件
    const applyFiltersBtn = document.getElementById('applyFilters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', function() {
            currentPage = 1;
            loadReports();
        });
        console.log('已綁定應用過濾按鈕事件');
    }
    
    // 提交处理按钮事件
    const submitActionBtn = document.getElementById('submitAction');
    if (submitActionBtn) {
        submitActionBtn.addEventListener('click', handleReportAction);
        console.log('已綁定提交處理按鈕事件');
    }
    
    // 取消处理按钮事件
    const cancelActionBtn = document.getElementById('cancelAction');
    if (cancelActionBtn) {
        cancelActionBtn.addEventListener('click', function() {
            document.getElementById('report-detail').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
        });
        console.log('已綁定取消處理按鈕事件');
    }
    
    // 设置表单提交事件
    const reportRulesForm = document.getElementById('reportRulesForm');
    if (reportRulesForm) {
        reportRulesForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveSettings('reportRules');
        });
        console.log('已綁定報告規則表單提交事件');
    }
    
    const automationForm = document.getElementById('automationForm');
    if (automationForm) {
        automationForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveSettings('automation');
        });
        console.log('已綁定自動化表單提交事件');
    }
    
    const messageTemplateForm = document.getElementById('messageTemplateForm');
    if (messageTemplateForm) {
        messageTemplateForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveSettings('messageTemplates');
        });
        console.log('已綁定消息模板表單提交事件');
    }
    
    // 图片查看事件
    const lightboxClose = document.querySelector('.lightbox .close');
    if (lightboxClose) {
        lightboxClose.addEventListener('click', function() {
            document.getElementById('imageLightbox').style.display = 'none';
        });
        console.log('已綁定燈箱關閉事件');
    }
    
    // 设置Enter键登录
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                handleLogin();
            }
        });
        console.log('已設置Enter鍵登入');
    }
    
    // 添加店家审核标签页点击处理
    const businessApprovalTab = document.querySelector('.tab[data-tab="businessApproval"]');
    if (businessApprovalTab) {
        businessApprovalTab.addEventListener('click', function() {
            loadBusinessApprovalRequests();
        });
        console.log('已設置店家審核標籤頁點擊事件');
    }
    
    // 初始化管理员申请按钮
    initAdminButtons();
    
    console.log('頁面初始化完成');
}

// 设置认证状态监听器
function setupAuthStateListener() {
    console.log('設置認證狀態監聽器');
    
    let isProcessingAuthChange = false;
    
    auth.onAuthStateChanged(user => {
        if (isProcessingAuthChange) {
            console.log('正在處理認證狀態變更，忽略重複事件');
            return;
        }
        
        isProcessingAuthChange = true;
        console.log(`認證狀態變更: ${user ? '已登入 ' + user.email : '已登出'}`);
        
        try {
            if (user) {
                onLoginSuccess(user);
            } else {
                onLogout();
            }
        } catch (error) {
            console.error('處理認證狀態變更時出錯:', error);
        }
        
        // 延迟重置处理标记，避免处理多次快速触发的事件
        setTimeout(() => {
            isProcessingAuthChange = false;
        }, 500);
    });
}

// 添加 App Check 警告
function addAppCheckWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'alert alert-warning alert-dismissible fade show mt-3';
    warningDiv.id = 'appCheckWarning';
    warningDiv.innerHTML = `
        <strong>注意:</strong> App Check 驗證未完成，這可能導致請求被拒絕。
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="關閉"></button>
        <div class="mt-2">
            <button class="btn btn-sm btn-warning" id="retryAppCheck">重試 App Check 驗證</button>
        </div>
    `;
    
    // 添加到登录表单前
    const loginSection = document.getElementById('loginSection');
    if (loginSection) {
        loginSection.parentNode.insertBefore(warningDiv, loginSection);
        
        // 添加重试按钮事件
        setTimeout(() => {
            const retryBtn = document.getElementById('retryAppCheck');
            if (retryBtn) {
                retryBtn.addEventListener('click', async function() {
                    this.disabled = true;
                    this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 驗證中...';
                    
                    const result = await checkAppCheckStatus();
                    if (result.success) {
                        // 移除警告并显示成功消息
                        document.getElementById('appCheckWarning').remove();
                        showSuccess('App Check 驗證成功！您現在可以嘗試登入。');
                    } else {
                        // 更新警告
                        this.disabled = false;
                        this.textContent = '重試 App Check 驗證';
                        showError('App Check 驗證仍然失敗，請刷新頁面或檢查網絡連接。');
                    }
                });
            }
        }, 100);
    }
}

// 显示成功消息
function showSuccess(message) {
    const successAlert = document.createElement('div');
    successAlert.className = 'alert alert-success mt-3';
    successAlert.textContent = message;
    
    // 清除之前的错误消息
    clearErrorMessage();
    
    // 插入成功消息
    const loginSection = document.getElementById('loginSection');
    if (loginSection) {
        loginSection.parentNode.insertBefore(successAlert, loginSection);
    }
    
    // 5秒后自动移除
    setTimeout(() => {
        successAlert.remove();
    }, 5000);
}

// 初始化管理员申请按钮
function initAdminButtons() {
    console.log('初始化管理員申請按鈕');
    
    const adminButton = document.getElementById('adminButton');
    const adminKeyModal = document.getElementById('adminKeyModal');
    const cancelAdminKey = document.getElementById('cancelAdminKey');
    const submitAdminKey = document.getElementById('submitAdminKey');
    
    if (adminButton && adminKeyModal) {
        adminButton.addEventListener('click', function() {
            console.log('點擊管理員申請按鈕');
            adminKeyModal.style.display = 'block';
        });
        
        if (cancelAdminKey) {
            cancelAdminKey.addEventListener('click', function() {
                adminKeyModal.style.display = 'none';
            });
        }
        
        if (submitAdminKey) {
            submitAdminKey.addEventListener('click', function() {
                applyForAdmin();
            });
        }
        
        console.log('管理員申請按鈕初始化完成');
    } else {
        console.log('找不到管理員申請按鈕或對話框');
    }
}

// 管理员申请功能(续)
async function applyForAdmin() {
    const adminKeyError = document.getElementById('adminKeyError');
    const submitAdminKey = document.getElementById('submitAdminKey');
    
    try {
        if (!auth.currentUser) {
            throw new Error('請先登入');
        }
        
        // 显示处理中状态
        submitAdminKey.disabled = true;
        submitAdminKey.innerHTML = '<div class="loading-spinner"></div> 處理中...';
        
        if (adminKeyError) adminKeyError.style.display = 'none';
        
        console.log('嘗試申請管理員權限');
        
        // 检查用户是否已有管理员权限
        const adminDoc = await db.collection('admins').doc(auth.currentUser.uid).get();
        if (adminDoc.exists) {
            throw new Error('您已具有管理員權限');
        }
        
        // 创建管理员请求
        await db.collection('adminRequests').add({
            userId: auth.currentUser.uid,
            email: auth.currentUser.email,
            status: 'pending',
            ipAddress: '自動檢測', // 实际应用中可使用函数获取
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 显示成功提示
        document.getElementById('adminKeyModal').style.display = 'none';
        const adminSuccessModal = document.getElementById('adminSuccessModal');
        if (adminSuccessModal) {
            adminSuccessModal.style.display = 'block';
            
            // 自动重载倒计时
            let countdown = 3;
            const countdownElem = document.getElementById('reloadCountdown');
            if (countdownElem) {
                const timer = setInterval(() => {
                    countdown--;
                    countdownElem.textContent = countdown;
                    if (countdown <= 0) {
                        clearInterval(timer);
                        window.location.reload();
                    }
                }, 1000);
            }
            
            // 立即重载按钮
            const reloadNow = document.getElementById('reloadNow');
            if (reloadNow) {
                reloadNow.addEventListener('click', () => {
                    window.location.reload();
                });
            }
        } else {
            alert('申請成功！請等待審核。');
            window.location.reload();
        }
        
    } catch (error) {
        console.error('申請管理員權限失敗:', error);
        
        if (adminKeyError) {
            adminKeyError.textContent = error.message;
            adminKeyError.style.display = 'block';
        } else {
            alert('申請失敗: ' + error.message);
        }
        
    } finally {
        // 恢复按钮状态
        if (submitAdminKey) {
            submitAdminKey.disabled = false;
            submitAdminKey.textContent = '確認申請';
        }
    }
}

// 处理登录动作
async function handleLogin() {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    
    if (!email || !password) {
        showError('請填寫郵箱和密碼');
        return;
    }
    
    try {
        // 显示登录中状态
        const loginButton = document.getElementById('loginButton');
        loginButton.innerHTML = '<div class="loading-spinner"></div> 登入中...';
        loginButton.disabled = true;
        document.getElementById('errorMessage').style.display = 'none';
        
        console.log('嘗試登入:', email);
        
        // 检查App Check是否初始化
        if (!window.APP_CHECK_INITIALIZED) {
            throw new Error('App Check尚未初始化，無法登入');
        }
        
        // 确保使用真实的App Check
        try {
            const appCheck = firebase.appCheck();
            const token = await appCheck.getToken();
            console.log('登入前已獲取有效的App Check令牌');
        } catch (appCheckError) {
            console.error('登入前無法獲取App Check令牌:', appCheckError);
            throw new Error('安全驗證失敗，請刷新頁面重試');
        }
        
        // 设置认证持久性
        try {
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            console.log('成功設置認證持久性為 LOCAL');
        } catch (persistenceError) {
            console.error('設置認證持久性失敗:', persistenceError);
            // 继续尝试登录，持久性错误不一定会阻止登录流程
        }
        
        // 尝试登录
        console.log('開始執行登入...');
        
        // 设置登录超时
        const loginPromise = auth.signInWithEmailAndPassword(email, password);
        const loginTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('登入請求超時')), 15000);
        });
        
        const userCredential = await Promise.race([loginPromise, loginTimeout]);
        console.log('登入成功:', userCredential.user.email);
        
        // 清除输入字段
        document.getElementById('emailInput').value = '';
        document.getElementById('passwordInput').value = '';
        
    } catch (error) {
        console.error('登入錯誤:', error);
        
        // 显示错误消息
        showError(getErrorMessage(error));
        
        // 重置登录按钮
        const loginButton = document.getElementById('loginButton');
        loginButton.textContent = '登入';
        loginButton.disabled = false;
    }
}

// 处理登出
async function handleLogout() {
    try {
        const logoutButton = document.getElementById('logoutButton');
        logoutButton.innerHTML = '<div class="loading-spinner"></div> 登出中...';
        logoutButton.disabled = true;
        
        console.log('嘗試登出');
        await auth.signOut();
        console.log('登出成功');
        
        // onAuthStateChanged 会处理其余的操作
    } catch (error) {
        console.error('登出錯誤:', error);
        alert('登出時發生錯誤: ' + error.message);
        
        // 重置登出按钮
        const logoutButton = document.getElementById('logoutButton');
        logoutButton.textContent = '登出';
        logoutButton.disabled = false;
    }
}

// 登录成功
function onLoginSuccess(user) {
    try {
        console.log('登入成功處理開始，用戶郵箱:', user.email);
        
        // 更新用户界面
        document.getElementById('userStatus').textContent = `已登入: ${user.email}`;
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('logoutButton').style.display = 'block';
        document.getElementById('main-content').style.display = 'block';
        
        // 检查用户是否为管理员
        checkAdminStatus(user.uid);
        
        // 初始化活动标签页
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const tabId = activeTab.getAttribute('data-tab');
            console.log(`初始化活動標籤頁: ${tabId}`);
            
            // 使用 setTimeout 确保 UI 已更新
            setTimeout(() => {
                if (tabId === 'report') {
                    console.log("延遲加載報告");
                    loadReports();
                } else if (tabId === 'verification') {
                    loadVerificationRequests();
                } else if (tabId === 'businessApproval') {
                    loadBusinessApprovalRequests();
                } else if (tabId === 'statistics') {
                    loadStatistics();
                }
            }, 500);
        }
        
        // 重置登录按钮
        const loginButton = document.getElementById('loginButton');
        if (loginButton) {
            loginButton.textContent = '登入';
            loginButton.disabled = false;
        }
        
        console.log('登入成功處理完成');
    } catch (error) {
        console.error('登入成功處理出錯:', error);
        
        // 确保界面正确显示，即使出错
        document.getElementById('userStatus').textContent = `已登入: ${user.email}`;
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('logoutButton').style.display = 'block';
        document.getElementById('main-content').style.display = 'block';
        
        if (document.getElementById('loginButton')) {
            document.getElementById('loginButton').textContent = '登入';
            document.getElementById('loginButton').disabled = false;
        }
    }
}

// 添加检查管理员状态的函数
async function checkAdminStatus(userId) {
    try {
        const adminDoc = await db.collection('admins').doc(userId).get();
        
        if (adminDoc.exists) {
            console.log('用戶已是管理員');
            // 更新用户状态显示
            document.getElementById('userStatus').innerHTML = `${document.getElementById('userStatus').textContent} <span style="color: #4CAF50; font-weight: bold; margin-left: 5px;">[管理員]</span>`;
            
            // 隐藏申请管理员按钮
            if (document.getElementById('adminButton')) {
                document.getElementById('adminButton').style.display = 'none';
            }
        } else {
            console.log('用戶不是管理員，顯示申請按鈕');
            if (document.getElementById('adminButton')) {
                document.getElementById('adminButton').style.display = 'inline-block';
            }
        }
    } catch (error) {
        console.error('檢查管理員狀態失敗:', error);
    }
}

// 登出成功处理函数
function onLogout() {
    console.log('執行登出後處理');
    
    // 更新界面
    document.getElementById('userStatus').textContent = '';
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('logoutButton').style.display = 'none';
    document.getElementById('main-content').style.display = 'none';
    
    // 隐藏所有可能开启的详情页面
    if (document.getElementById('report-detail')) {
        document.getElementById('report-detail').style.display = 'none';
    }
    
    if (document.getElementById('verification-detail')) {
        document.getElementById('verification-detail').style.display = 'none';
    }
    
    if (document.getElementById('business-approval-detail')) {
        document.getElementById('business-approval-detail').style.display = 'none';
    }
    
    // 重置登出按钮
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.textContent = '登出';
        logoutButton.disabled = false;
    }
    
    console.log('登出後處理完成');
}

// 显示错误信息
function showError(message) {
    // 先清除之前的错误消息
    clearErrorMessage();
    
    // 创建错误提示
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-danger login-error-alert mt-3';
    errorAlert.role = 'alert';
    
    // 插入到登录表单之前
    const loginForm = document.getElementById('businessLoginForm') || document.querySelector('form');
    if (loginForm) {
        loginForm.parentNode.insertBefore(errorAlert, loginForm);
    } else {
        // 如果找不到表单，添加到其他地方
        const possibleParent = document.querySelector('.login-section') || 
                            document.querySelector('.container') || 
                            document.body;
        possibleParent.prepend(errorAlert);
    }
    
    // 设置错误消息，支持HTML
    errorAlert.innerHTML = message;
}

// 清除错误消息
function clearErrorMessage() {
    const errorAlert = document.querySelector('.login-error-alert');
    if (errorAlert) {
        errorAlert.remove();
    }
}

// 简化的检查错误消息并返回用户友好的消息
function getErrorMessage(error) {
    switch(error.code) {
        case 'auth/invalid-email':
            return '無效的郵箱格式';
        case 'auth/user-disabled':
            return '此用戶已被禁用';
        case 'auth/user-not-found':
            return '找不到對應的用戶';
        case 'auth/wrong-password':
            return '密碼錯誤';
        case 'auth/too-many-requests':
            return '嘗試登入次數過多，請稍後再試';
        case 'auth/network-request-failed':
            return '網絡連接失敗，請檢查您的網絡連接並重試';
        default:
            return `登入失敗: ${error.message}`;
    }
}

// 加载报告列表
async function loadReports() {
    try {
        // 显示加载中
        const reportsContainer = document.getElementById('reports-container');
        reportsContainer.innerHTML = '';
        document.getElementById('reports-loading').style.display = 'flex';
        
        console.log("開始載入報告數據...");
        
        // 获取过滤条件
        const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;
        const sortBy = document.getElementById('sortBy').value;
        
        // 构建查询
        let query = db.collection('reports');
        
        // 尝试先获取文档计数，测试权限
        try {
            const testDoc = await db.collection('reports').limit(1).get();
            console.log("成功獲取報告測試數據");
        } catch (permError) {
            console.error("報告集合權限測試失敗:", permError);
            // 显示权限错误但不登出用户
            document.getElementById('reports-loading').style.display = 'none';
            reportsContainer.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px;">
                    <h3>權限錯誤</h3>
                    <p>您沒有權限查看報告數據。請確保您有適當的權限或聯繫管理員。</p>
                    <p>技術錯誤: ${permError.message}</p>
                </div>`;
            return;
        }
        
        // 应用状态过滤
        if (statusFilter !== 'all') {
            query = query.where('status', '==', statusFilter);
        }
        
        // 应用类型过滤
        if (typeFilter !== 'all') {
            query = query.where('reasons', 'array-contains', typeFilter);
        }
        
        // 应用排序
        switch (sortBy) {
            case 'newest':
                query = query.orderBy('createdAt', 'desc');
                break;
            case 'oldest':
                query = query.orderBy('createdAt', 'asc');
                break;
            case 'severity':
                // 假设有严重度字段
                query = query.orderBy('severity', 'desc');
                break;
            case 'reporterCredit':
                // 这个可能需要多段处理，先获取所有数据
                break;
        }
        
        // 分页查询
        const querySnapshot = await query.get();
        totalReports = querySnapshot.size;
        
        // 计算分页
        const totalPages = Math.ceil(totalReports / reportsPerPage);
        updatePagination(totalPages);
        
        // 模拟分页 (实际应用中应该使用 startAfter)
        const reports = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            reports.push(data);
        });
        
        // 搜索过滤 (Firestore 不支持文本搜索，所以在客户端过滤)
        let filteredReports = reports;
        if (searchTerm) {
            filteredReports = reports.filter(report => {
                return (
                    (report.reportedUserName && report.reportedUserName.toLowerCase().includes(searchTerm)) ||
                    (report.reporterId && report.reporterId.toLowerCase().includes(searchTerm)) ||
                    (report.reportedUserId && report.reportedUserId.toLowerCase().includes(searchTerm)) ||
                    (report.id && report.id.toLowerCase().includes(searchTerm))
                );
            });
        }
        
        // 如果是按举报人信用排序，需要额外处理
        if (sortBy === 'reporterCredit') {
            // 获取所有举报人的信用分数
            const reporterIds = [...new Set(filteredReports.map(report => report.reporterId))];
            const credibilityPromises = reporterIds.map(id => 
                db.collection('userReportCredibility').doc(id).get()
            );
            
            const credibilityDocs = await Promise.all(credibilityPromises);
            const creditScores = {};
            
            credibilityDocs.forEach(doc => {
                if (doc.exists) {
                    creditScores[doc.id] = doc.data().score || 100;
                } else {
                    creditScores[doc.id] = 100; // 预设分数
                }
            });
            
            // 根据举报人信用分数排序
            filteredReports.sort((a, b) => {
                const scoreA = creditScores[a.reporterId] || 100;
                const scoreB = creditScores[b.reporterId] || 100;
                return scoreA - scoreB; // 从低到高排序
            });
        }
        
        // 应用分页
        const start = (currentPage - 1) * reportsPerPage;
        const paginatedReports = filteredReports.slice(start, start + reportsPerPage);
        
        // 隐藏加载中
        document.getElementById('reports-loading').style.display = 'none';
        
        // 检查是否有结果
        if (paginatedReports.length === 0) {
            reportsContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px;">沒有符合條件的檢舉記錄</div>';
            return;
        }
        
        // 渲染举报卡片
        paginatedReports.forEach(report => {
            const card = createReportCard(report);
            reportsContainer.appendChild(card);
        });
        
    } catch (error) {
        console.error('加載檢舉列表錯誤:', error);
        document.getElementById('reports-loading').style.display = 'none';
        document.getElementById('reports-container').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px;">加載檢舉列表時發生錯誤: ${error.message}</div>`;
    }
}

// 创建举报卡片
function createReportCard(report) {
    const card = document.createElement('div');
    card.className = `report-card ${report.status}`;
    
    // 检查是否为多次举报
    if (report.reportCount && report.reportCount > 2) {
        card.classList.add('multiple-reports');
    }
    
    // 格式化日期
    const createdAt = report.createdAt ? new Date(report.createdAt.toDate()) : new Date();
    const formattedDate = formatDate(createdAt);
    
    // 构建状态标签
    let statusBadge = '';
    switch (report.status) {
        case 'pending':
            statusBadge = '<span class="status-badge badge-pending">待處理</span>';
            break;
        case 'resolved':
            statusBadge = '<span class="status-badge badge-resolved">已處理</span>';
            break;
        case 'rejected':
            statusBadge = '<span class="status-badge badge-rejected">已拒絕</span>';
            break;
    }
    
    // 举报原因
    const reasons = report.reasons || [];
    const reasonsList = reasons.map(reason => {
        return `<span class="tag">${getReasonText(reason)}</span>`;
    }).join('');
    
    // 举报人信用分数标记
    let creditBadge = '';
    if (report.reporterCredit) {
        let creditClass = '';
        if (report.reporterCredit >= 80) {
            creditClass = 'credit-high';
        } else if (report.reporterCredit >= 50) {
            creditClass = 'credit-medium';
        } else {
            creditClass = 'credit-low';
        }
        
        creditBadge = `<span class="credit-score ${creditClass}">信用: ${report.reporterCredit}</span>`;
    }
    
    card.innerHTML = `
        <h3>
            ${statusBadge}
            <span style="margin-left: 5px;">${report.reportedUserName || '未知用戶'}</span>
            ${creditBadge}
        </h3>
        <p><strong>檢舉人:</strong> ${report.reporterName || '未知'}</p>
        <p><strong>提交時間:</strong> ${formattedDate}</p>
        <div class="tag-list">
            ${reasonsList}
        </div>
    `;
    
    // 添加点击事件
    card.addEventListener('click', () => {
        showReportDetail(report.id);
    });
    
    return card;
}

// 更新分页
function updatePagination(totalPages) {
    const paginationContainer = document.getElementById('reports-pagination');
    paginationContainer.innerHTML = '';
    
    if (totalPages <= 1) {
        return;
    }
    
    // 上一页按钮
    const prevBtn = document.createElement('div');
    prevBtn.className = 'page-item';
    prevBtn.innerHTML = '<span class="material-icons">chevron_left</span>';
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadReports();
        }
    });
    paginationContainer.appendChild(prevBtn);
    
    // 页码按钮
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('div');
        pageBtn.className = 'page-item';
        pageBtn.textContent = i;
        
        if (i === currentPage) {
            pageBtn.classList.add('active');
        }
        
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            loadReports();
        });
        
        paginationContainer.appendChild(pageBtn);
    }
    
    // 下一页按钮
    const nextBtn = document.createElement('div');
    nextBtn.className = 'page-item';
    nextBtn.innerHTML = '<span class="material-icons">chevron_right</span>';
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadReports();
        }
    });
    paginationContainer.appendChild(nextBtn);
}

// 显示举报详情
async function showReportDetail(reportId) {
    currentReportId = reportId;
    
    // 切换视图
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('report-detail').style.display = 'block';
    
    try {
        // 获取举报数据
        const reportDoc = await db.collection('reports').doc(reportId).get();
        
        if (!reportDoc.exists) {
            alert('找不到該檢舉記錄');
            document.getElementById('report-detail').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            return;
        }
        
        const reportData = reportDoc.data();
        
        // 填充基本信息
        document.getElementById('report-id').textContent = reportId;
        document.getElementById('report-time').textContent = formatDate(reportData.createdAt.toDate());
        
        // 状态
        const statusElement = document.getElementById('report-status');
        statusElement.textContent = getStatusText(reportData.status);
        statusElement.className = 'status-badge badge-' + reportData.status;
        
        // 处理人员
        if (reportData.handledBy) {
            document.getElementById('report-handler').textContent = reportData.handlerName || reportData.handledBy;
        } else {
            document.getElementById('report-handler').textContent = '尚未處理';
        }
        
        // 举报原因
        const reasonsContainer = document.getElementById('report-reasons');
        reasonsContainer.innerHTML = '';
        
        if (reportData.reasons && reportData.reasons.length > 0) {
            reportData.reasons.forEach(reason => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="material-icons">error</span> ${getReasonText(reason)}`;
                reasonsContainer.appendChild(li);
            });
        } else {
            reasonsContainer.innerHTML = '<li>沒有指定原因</li>';
        }
        
        // 详细描述
        document.getElementById('report-detail-text').textContent = reportData.detail || '無詳細描述';
        
        // 证据图片
        const evidenceContainer = document.getElementById('evidence-container');
        evidenceContainer.innerHTML = '';
        
        if (reportData.imageUrls && reportData.imageUrls.length > 0) {
            reportData.imageUrls.forEach((url, index) => {
                const evidenceItem = document.createElement('div');
                evidenceItem.className = 'evidence-item';
                evidenceItem.innerHTML = `
                    <img src="${url}" alt="證據 ${index+1}">
                    <div class="view-full">查看原圖</div>
                `;
                
                // 查看原图
                evidenceItem.querySelector('.view-full').addEventListener('click', () => {
                    document.getElementById('lightboxImage').src = url;
                    document.getElementById('imageLightbox').style.display = 'flex';
                });
                
                evidenceContainer.appendChild(evidenceItem);
            });
        } else {
            evidenceContainer.innerHTML = '<p>沒有上傳證據圖片</p>';
        }
        
        // 加载举报人资料
        if (reportData.reporterId) {
            loadUserProfile(reportData.reporterId, 'reporter');
        }
        
        // 加载被举报人资料
        if (reportData.reportedUserId) {
            loadUserProfile(reportData.reportedUserId, 'reported');
            loadPunishmentHistory(reportData.reportedUserId);
        }
        
    } catch (error) {
        console.error('顯示檢舉詳情錯誤:', error);
        alert('載入檢舉詳情時發生錯誤: ' + error.message);
        document.getElementById('report-detail').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
    }
}

// 加载用户资料
async function loadUserProfile(userId, type) {
    try {
        const userDoc = await db.collection('userprofileData').doc(userId).get();
        
        if (!userDoc.exists) {
            document.getElementById(`${type}-name`).textContent = '找不到用戶資料';
            document.getElementById(`${type}-id`).textContent = `ID: ${userId}`;
            return;
        }
        
        const userData = userDoc.data();
        
        // 设置用户名称和ID
        document.getElementById(`${type}-name`).textContent = userData.name || '未設定名稱';
        document.getElementById(`${type}-id`).textContent = `ID: ${userId}`;
        
        // 设置头像
        if (userData.photoUrls && userData.photoUrls.length > 0) {
            let photoUrl;
            if (userData.photoOrder && userData.photoOrder.length > 0) {
                const mainPhotoIndex = userData.photoOrder[0];
                photoUrl = userData.photoUrls[mainPhotoIndex];
            } else {
                photoUrl = userData.photoUrls[0];
            }
            document.getElementById(`${type}-avatar`).src = photoUrl;
        } else {
            document.getElementById(`${type}-avatar`).src = 'https://via.placeholder.com/60?text=無照片';
        }
        
        // 如果是举报人，加载举报信用分数
        if (type === 'reporter') {
            loadReporterCredibility(userId);
        }
        
        // 加载举报历史
        await loadReportHistory(userId, type);
        
    } catch (error) {
        console.error(`加載${type}資料錯誤:`, error);
        document.getElementById(`${type}-name`).textContent = '載入失敗';
        document.getElementById(`${type}-id`).textContent = `ID: ${userId}`;
    }
}

// 加载举报人信用分数
async function loadReporterCredibility(userId) {
    try {
        const credibilityDoc = await db.collection('userReportCredibility').doc(userId).get();
        const creditElement = document.getElementById('reporter-credit');
        
        if (credibilityDoc.exists) {
            const data = credibilityDoc.data();
            const score = data.score || 100;
            
            // 设置信用分数的颜色
            let creditClass = '';
            if (score >= 80) {
                creditClass = 'credit-high';
            } else if (score >= 50) {
                creditClass = 'credit-medium';
            } else {
                creditClass = 'credit-low';
            }
            
            creditElement.textContent = `信用分數: ${score}`;
            creditElement.className = `credit-score ${creditClass}`;
        } else {
            // 没有记录时的预设值
            creditElement.textContent = '信用分數: 100';
            creditElement.className = 'credit-score credit-high';
        }
    } catch (error) {
        console.error('加載檢舉人信用分數錯誤:', error);
        document.getElementById('reporter-credit').textContent = '信用分數: --';
    }
}

// 加载处罚历史
async function loadPunishmentHistory(userId) {
    try {
        const historyContainer = document.getElementById('punishment-history');
        historyContainer.innerHTML = '';
        
        const reportsSnapshot = await db.collection('reports')
            .where('reportedUserId', '==', userId)
            .where('status', '==', 'resolved')
            .orderBy('handledAt', 'desc')
            .limit(5)
            .get();
        
        if (reportsSnapshot.empty) {
            historyContainer.innerHTML = '<li>無處罰記錄</li>';
            return;
        }
        
        reportsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.punishment) {
                const handledAt = data.handledAt ? formatDate(data.handledAt.toDate()) : '未知時間';
                const li = document.createElement('li');
                
                let punishmentText = '';
                switch (data.punishment.type) {
                    case 'warning':
                        punishmentText = '發出警告';
                        break;
                    case 'restrict':
                        punishmentText = `限制${getRestrictionTypeText(data.punishment.restrictType)}功能 ${data.punishment.duration} 天`;
                        break;
                    case 'suspend':
                        punishmentText = `暫停帳號 ${data.punishment.duration} 天`;
                        break;
                    case 'ban':
                        punishmentText = '永久封禁帳號';
                        break;
                }
                
                li.innerHTML = `${handledAt}: ${punishmentText}`;
                historyContainer.appendChild(li);
            }
        });
        
    } catch (error) {
        console.error('加載處罰歷史錯誤:', error);
        document.getElementById('punishment-history').innerHTML = '<li>載入失敗</li>';
    }
}

// 加载举报历史
async function loadReportHistory(userId, type) {
    try {
        let query;
        
        // 依据类型选择查询方式
        if (type === 'reporter') {
            // 作为举报人的历史
            query = db.collection('reports')
                .where('reporterId', '==', userId)
                .where('status', 'in', ['resolved', 'rejected']);
        } else {
            // 作为被举报人的历史
            query = db.collection('reports')
                .where('reportedUserId', '==', userId);
        }
        
        const snapshot = await query.get();
        
        // 统计有效和无效举报
        let validCount = 0;
        let invalidCount = 0;
        let pendingCount = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'resolved') {
                validCount++;
            } else if (data.status === 'rejected') {
                invalidCount++;
            } else if (data.status === 'pending') {
                pendingCount++;
            }
        });
        
        // 显示统计结果
        const totalCount = validCount + invalidCount + pendingCount;
        const historyText = type === 'reporter'
            ? `${totalCount}次 (${validCount}次有效)`
            : `${totalCount}次 (${validCount}次成立, ${pendingCount}次待處理)`;
        
        document.getElementById(`${type}-history`).textContent = historyText;
        
        // 检查用户状态
        const statusElement = document.getElementById(`${type}-status`);
        
        const userDoc = await db.collection('userStatus').doc(userId).get();
        if (userDoc.exists) {
            const statusData = userDoc.data();
            
            if (statusData.isBanned) {
                statusElement.textContent = '已封禁';
                statusElement.className = 'status-badge badge-danger';
            } else if (statusData.isSuspended) {
                statusElement.textContent = '已暫停';
                statusElement.className = 'status-badge badge-warning';
            } else if (statusData.restrictions && Object.keys(statusData.restrictions).length > 0) {
                statusElement.textContent = '功能受限';
                statusElement.className = 'status-badge badge-warning';
            } else {
                statusElement.textContent = '正常';
            }
        } else {
            statusElement.textContent = '正常';
        }
        
    } catch (error) {
        console.error(`加載${type}檢舉歷史錯誤:`, error);
        document.getElementById(`${type}-history`).textContent = '載入失敗';
    }
}

// 处理举报行动
async function handleReportAction() {
    if (!currentReportId) return;
    
    // 获取选择的行动
    const actionType = document.querySelector('input[name="action"]:checked').value;
    const actionNote = document.getElementById('actionNote').value.trim();
    
    if (!actionType) {
        alert('請選擇處理方式');
        return;
    }
    
    try {
        const actionButton = document.getElementById('submitAction');
        actionButton.innerHTML = '<div class="loading-spinner"></div> 處理中...';
        actionButton.disabled = true;
        
        // 获取举报资料
        const reportDoc = await db.collection('reports').doc(currentReportId).get();
        
        if (!reportDoc.exists) {
            throw new Error('找不到檢舉記錄');
        }
        
        const reportData = reportDoc.data();
        const reportedUserId = reportData.reportedUserId;
        
        // 准备更新举报状态
        const updateData = {
            status: actionType === 'ignore' ? 'rejected' : 'resolved',
            handledBy: auth.currentUser.uid,
            handlerName: auth.currentUser.email,
            handledAt: firebase.firestore.FieldValue.serverTimestamp(),
            actionType: actionType,
            actionNote: actionNote || null
        };
        
        // 如果选择惩罚，添加相关数据
        if (actionType === 'restrict') {
            const restrictType = document.getElementById('restrictType').value;
            const restrictDays = parseInt(document.getElementById('restrictDays').value);
            
            updateData.punishment = {
                type: 'restrict',
                restrictType: restrictType,
                duration: restrictDays,
                expireAt: new Date(Date.now() + restrictDays * 24 * 60 * 60 * 1000)
            };
            
            // 同时更新用户状态
            await applyUserRestriction(reportedUserId, restrictType, restrictDays);
            
        } else if (actionType === 'suspend') {
            const suspendDays = parseInt(document.getElementById('suspendDays').value);
            
            updateData.punishment = {
                type: 'suspend',
                duration: suspendDays,
                expireAt: new Date(Date.now() + suspendDays * 24 * 60 * 60 * 1000)
            };
            
            // 同时更新用户状态
            await suspendUser(reportedUserId, suspendDays);
            
        } else if (actionType === 'ban') {
            updateData.punishment = {
                type: 'ban',
                permanent: true
            };
            
            // 同时更新用户状态
            await banUser(reportedUserId);
            
        } else if (actionType === 'warning') {
            updateData.punishment = {
                type: 'warning',
                warningCount: firebase.firestore.FieldValue.increment(1)
            };
            
            // 同时更新用户状态
            await warnUser(reportedUserId, reportData.reasons);
        }
        
        // 更新举报记录
        await db.collection('reports').doc(currentReportId).update(updateData);
        
        // 更新举报人的举报信用分数
        if (reportData.reporterId) {
            await updateReporterCredibility(
                reportData.reporterId, 
                actionType === 'ignore' ? -5 : 10
            );
        }
        
        // 处理相同被举报者的其他举报
        if (actionType !== 'ignore' && reportData.reportedUserId) {
            await handleRelatedReports(reportData.reportedUserId);
        }
        
        // 重置
        actionButton.textContent = '確認處理';
        actionButton.disabled = false;
        
        alert('檢舉處理完成');
        
        // 返回列表并重新加载
        document.getElementById('report-detail').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        loadReports();
        checkFrequentReports(); // 更新重复举报数据
        
    } catch (error) {
        console.error('處理檢舉時發生錯誤:', error);
        alert('處理檢舉時發生錯誤: ' + error.message);
        
        const actionButton = document.getElementById('submitAction');
        actionButton.textContent = '確認處理';
        actionButton.disabled = false;
    }
}