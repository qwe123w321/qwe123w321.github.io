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

// 限制用戶功能
async function applyUserRestriction(userId, restrictType, days) {
    try {
        const expireAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        
        // 更新用戶狀態
        const userStatusRef = db.collection('userStatus').doc(userId);
        const doc = await userStatusRef.get();
        
        if (doc.exists) {
            // 更新現有記錄
            await userStatusRef.update({
                [`restrictions.${restrictType}`]: {
                    active: true,
                    expireAt: expireAt,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                },
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // 創建新記錄
            await userStatusRef.set({
                userId: userId,
                isBanned: false,
                restrictions: {
                    [restrictType]: {
                        active: true,
                        expireAt: expireAt,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }
                },
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // 發送通知給用戶
        await sendUserNotification(userId, 'restriction', {
            restrictType: restrictType,
            duration: days
        });
        
    } catch (error) {
        console.error('限制用戶功能錯誤:', error);
        throw error;
    }
}

// 暫停用戶帳號
async function suspendUser(userId, days) {
    try {
        const expireAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        
        // 更新用戶狀態
        const userStatusRef = db.collection('userStatus').doc(userId);
        await userStatusRef.set({
            userId: userId,
            isSuspended: true,
            suspendExpireAt: expireAt,
            suspendedAt: firebase.firestore.FieldValue.serverTimestamp(),
            suspendReason: 'violation',
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // 發送通知給用戶
        await sendUserNotification(userId, 'suspension', {
            duration: days
        });
        
    } catch (error) {
        console.error('暫停用戶帳號錯誤:', error);
        throw error;
    }
}

// 永久封禁用戶
async function banUser(userId) {
    try {
        // 更新用戶狀態
        const userStatusRef = db.collection('userStatus').doc(userId);
        await userStatusRef.set({
            userId: userId,
            isBanned: true,
            bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
            banReason: 'severe_violation',
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // 發送通知給用戶
        await sendUserNotification(userId, 'ban', {});
        
    } catch (error) {
        console.error('封禁用戶錯誤:', error);
        throw error;
    }
}

// 警告用戶
async function warnUser(userId, reasons) {
    try {
        // 更新用戶警告計數
        const userStatusRef = db.collection('userStatus').doc(userId);
        const doc = await userStatusRef.get();
        
        if (doc.exists) {
            await userStatusRef.update({
                warningCount: firebase.firestore.FieldValue.increment(1),
                lastWarningAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await userStatusRef.set({
                userId: userId,
                warningCount: 1,
                lastWarningAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // 發送通知給用戶
        await sendUserNotification(userId, 'warning', {
            reasons: reasons
        });
        
    } catch (error) {
        console.error('警告用戶錯誤:', error);
        throw error;
    }
}

// 發送通知給用戶
async function sendUserNotification(userId, type, data) {
    try {
        // 根據通知類型獲取模板
        let message = '';
        
        switch (type) {
            case 'warning':
                message = document.getElementById('warningTemplate').value;
                message = message.replace('{reason}', data.reasons ? data.reasons.map(r => getReasonText(r)).join('、') : '違反社區規範');
                break;
            case 'restriction':
                message = `您的帳號因違反社區規範，${getRestrictionTypeText(data.restrictType)}功能已被限制${data.duration}天。`;
                break;
            case 'suspension':
                message = document.getElementById('suspensionTemplate').value;
                message = message.replace('{reason}', '違反社區規範').replace('{days}', data.duration);
                break;
            case 'ban':
                message = '您的帳號因嚴重違反社區規範已被永久封禁。';
                break;
        }
        
        // 創建通知
        await db.collection('notifications').add({
            userId: userId,
            type: type,
            message: message,
            data: data,
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
    } catch (error) {
        console.error('發送通知錯誤:', error);
        // 這裡的錯誤不應該影響主要流程，所以只記錄不拋出
    }
}

// 檢查重複檢舉情況
async function checkFrequentReports() {
    try {
        // 獲取所有待處理檢舉
        const pendingReportsSnapshot = await db.collection('reports')
            .where('status', '==', 'pending')
            .get();
        
        if (pendingReportsSnapshot.empty) {
            document.querySelector('.tab[data-tab="frequentReports"]').setAttribute('data-count', '0');
            return;
        }
        
        // 統計每個被檢舉用戶的檢舉數量
        const reportCounts = {};
        
        pendingReportsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.reportedUserId) {
                reportCounts[data.reportedUserId] = (reportCounts[data.reportedUserId] || 0) + 1;
            }
        });
        
        // 篩選出被多次檢舉的用戶
        const multiReportedUsers = Object.keys(reportCounts).filter(userId => 
            reportCounts[userId] >= 3  // 可以根據需要調整閾值
        );
        
        // 更新標籤頁徽章數字
        document.querySelector('.tab[data-tab="frequentReports"]').setAttribute('data-count', multiReportedUsers.length.toString());
        
        // 如果有多次檢舉的用戶，添加視覺提示
        if (multiReportedUsers.length > 0) {
            document.querySelector('.tab[data-tab="frequentReports"]').classList.add('notification-badge');
        } else {
            document.querySelector('.tab[data-tab="frequentReports"]').classList.remove('notification-badge');
        }
        
    } catch (error) {
        console.error('檢查重複檢舉錯誤:', error);
        // 不影響主要流程
    }
}

// 加載重複檢舉標籤頁
async function loadFrequentReports() {
    const container = document.getElementById('frequent-reports-container');
    const loadingElement = document.getElementById('frequent-loading');
    
    container.innerHTML = '';
    loadingElement.style.display = 'flex';
    
    try {
        // 獲取所有待處理檢舉
        const pendingReportsSnapshot = await db.collection('reports')
            .where('status', '==', 'pending')
            .get();
        
        if (pendingReportsSnapshot.empty) {
            loadingElement.style.display = 'none';
            container.innerHTML = '<div style="text-align: center; padding: 30px;">沒有待處理檢舉</div>';
            return;
        }
        
        // 統計每個被檢舉用戶的檢舉數量和檢舉
        const reportCounts = {};
        const userReports = {};
        
        pendingReportsSnapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            
            if (data.reportedUserId) {
                reportCounts[data.reportedUserId] = (reportCounts[data.reportedUserId] || 0) + 1;
                
                if (!userReports[data.reportedUserId]) {
                    userReports[data.reportedUserId] = [];
                }
                userReports[data.reportedUserId].push(data);
            }
        });
        
        // 篩選出被多次檢舉的用戶
        const multiReportedUsers = Object.keys(reportCounts).filter(userId => 
            reportCounts[userId] >= 3  // 可以根據需要調整閾值
        );
        
        loadingElement.style.display = 'none';
        
        if (multiReportedUsers.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 30px;">沒有被多次檢舉的用戶</div>';
            return;
        }
        
        // 為每個多次被檢舉的用戶創建卡片
        for (const userId of multiReportedUsers) {
            const reports = userReports[userId];
            const reportCount = reportCounts[userId];
            
            // 獲取用戶信息
            const userDoc = await db.collection('userStatus').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : null;
            const userName = userData ? (userData.name || '未知用戶') : '未知用戶';
            
            // 創建用戶卡片
            const card = document.createElement('div');
            card.className = 'card';
            card.style.marginBottom = '20px';
            
            // 收集所有檢舉原因
            const allReasons = new Set();
            reports.forEach(report => {
                if (report.reasons && report.reasons.length > 0) {
                    report.reasons.forEach(reason => allReasons.add(reason));
                }
            });
            
            const reasonTags = Array.from(allReasons).map(reason => 
                `<span class="tag">${getReasonText(reason)}</span>`
            ).join('');
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>${userName}</h3>
                    <span class="status-badge badge-warning">被檢舉 ${reportCount} 次</span>
                </div>
                <p><strong>檢舉原因:</strong></p>
                <div class="tag-list">${reasonTags}</div>
                <div style="margin-top: 15px;">
                    <button class="btn-primary view-reports" data-id="${userId}">查看所有檢舉</button>
                    <button class="btn-danger handle-all" data-id="${userId}">批量處理</button>
                </div>
            `;
            
            // 添加查看所有檢舉事件
            card.querySelector('.view-reports').addEventListener('click', () => {
                showUserReports(userId, reports);
            });
            
            // 添加批量處理事件
            card.querySelector('.handle-all').addEventListener('click', () => {
                batchHandleReports(userId, reports);
            });
            
            container.appendChild(card);
        }
        
    } catch (error) {
        console.error('加載重複檢舉錯誤:', error);
        loadingElement.style.display = 'none';
        container.innerHTML = `<div style="text-align: center; padding: 30px;">加載資料時發生錯誤: ${error.message}</div>`;
    }
}

// 顯示用戶所有檢舉
function showUserReports(userId, reports) {
    // 創建一個模態對話框來顯示所有檢舉
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '1000';
    
    const dialog = document.createElement('div');
    dialog.style.backgroundColor = 'white';
    dialog.style.borderRadius = '12px';
    dialog.style.padding = '20px';
    dialog.style.maxWidth = '800px';
    dialog.style.width = '90%';
    dialog.style.maxHeight = '80vh';
    dialog.style.overflowY = 'auto';
    
    dialog.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>用戶檢舉列表</h2>
            <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        <div id="reports-list"></div>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // 關閉按鈕事件
    document.getElementById('close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // 填充檢舉列表
    const reportsList = document.getElementById('reports-list');
    
    reports.forEach(report => {
        const createdAt = report.createdAt ? formatDate(report.createdAt.toDate()) : '未知時間';
        const reasons = report.reasons ? report.reasons.map(r => getReasonText(r)).join('、') : '未指定';
        
        const reportItem = document.createElement('div');
        reportItem.style.borderBottom = '1px solid #eee';
        reportItem.style.padding = '15px 0';
        
        reportItem.innerHTML = `
            <p><strong>檢舉人:</strong> ${report.reporterName || '未知'}</p>
            <p><strong>時間:</strong> ${createdAt}</p>
            <p><strong>原因:</strong> ${reasons}</p>
            <p><strong>詳細描述:</strong> ${report.detail || '無'}</p>
            <button class="btn-primary view-detail" data-id="${report.id}">查看詳情</button>
        `;
        
        // 添加查看詳情事件
        reportItem.querySelector('.view-detail').addEventListener('click', () => {
            document.body.removeChild(modal);
            showReportDetail(report.id);
        });
        
        reportsList.appendChild(reportItem);
    });
}

// 批量處理檢舉
async function batchHandleReports(userId, reports) {
    if (reports.length === 0) return;
    
    // 創建選擇處理方式的對話框
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '1000';
    
    const dialog = document.createElement('div');
    dialog.style.backgroundColor = 'white';
    dialog.style.borderRadius = '12px';
    dialog.style.padding = '20px';
    dialog.style.maxWidth = '500px';
    dialog.style.width = '90%';
    
    dialog.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>批量處理檢舉</h2>
            <button id="close-batch-modal" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        <p>您正在處理 <strong>${reports.length}</strong> 個針對同一用戶的檢舉。</p>
        <form id="batch-form">
            <div class="punishment-options">
                <div class="punishment-type">
                    <label>
                        <input type="radio" name="batchAction" value="warning" checked>
                        發出警告
                    </label>
                </div>
                
                <div class="punishment-type">
                    <label>
                        <input type="radio" name="batchAction" value="restrict">
                        功能限制
                    </label>
                    <div style="margin-left: 25px; margin-top: 10px;">
                        <select id="batchRestrictType">
                            <option value="chat">聊天功能</option>
                            <option value="match">配對功能</option>
                            <option value="photo">上傳照片</option>
                            <option value="all">所有功能</option>
                        </select>
                        <input type="number" id="batchRestrictDays" min="1" max="30" value="7" style="width: 60px; margin-left: 10px;"> 天
                    </div>
                </div>
                
                <div class="punishment-type">
                    <label>
                        <input type="radio" name="batchAction" value="suspend">
                        暫停帳號
                    </label>
                    <div style="margin-left: 25px; margin-top: 10px;">
                        <input type="number" id="batchSuspendDays" min="1" max="90" value="30" style="width: 60px;"> 天
                    </div>
                </div>
                
                <div class="punishment-type">
                    <label>
                        <input type="radio" name="batchAction" value="ban">
                        永久封禁
                    </label>
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <label for="batchActionNote">處理備註 (僅管理員可見):</label>
                <textarea id="batchActionNote" rows="3" style="width: 100%; margin-top: 10px;"></textarea>
            </div>
            
            <div style="margin-top: 20px; display: flex; justify-content: center; gap: 10px;">
                <button type="button" id="cancel-batch" class="btn-danger">取消</button>
                <button type="button" id="confirm-batch" class="btn-success">確認處理</button>
            </div>
        </form>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // 關閉按鈕事件
    document.getElementById('close-batch-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    document.getElementById('cancel-batch').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // 提交處理
    document.getElementById('confirm-batch').addEventListener('click', async () => {
        const actionType = document.querySelector('input[name="batchAction"]:checked').value;
        const actionNote = document.getElementById('batchActionNote').value.trim();
        
        if (!actionType) {
            alert('請選擇處理方式');
            return;
        }
        
        try {
            // 顯示處理中
            document.getElementById('confirm-batch').disabled = true;
            document.getElementById('confirm-batch').textContent = '處理中...';
            
            // 根據選擇的處理方式進行處理
            let punishment = null;
            
            if (actionType === 'restrict') {
                const restrictType = document.getElementById('batchRestrictType').value;
                const restrictDays = parseInt(document.getElementById('batchRestrictDays').value);
                
                punishment = {
                    type: 'restrict',
                    restrictType: restrictType,
                    duration: restrictDays,
                    expireAt: new Date(Date.now() + restrictDays * 24 * 60 * 60 * 1000)
                };
                
                // 更新用戶狀態
                await applyUserRestriction(userId, restrictType, restrictDays);
                
            } else if (actionType === 'suspend') {
                const suspendDays = parseInt(document.getElementById('batchSuspendDays').value);
                
                punishment = {
                    type: 'suspend',
                    duration: suspendDays,
                    expireAt: new Date(Date.now() + suspendDays * 24 * 60 * 60 * 1000)
                };
                
                // 更新用戶狀態
                await suspendUser(userId, suspendDays);
                
            } else if (actionType === 'ban') {
                punishment = {
                    type: 'ban',
                    permanent: true
                };
                
                // 更新用戶狀態
                await banUser(userId);
                
            } else if (actionType === 'warning') {
                punishment = {
                    type: 'warning',
                    warningCount: firebase.firestore.FieldValue.increment(1)
                };
                
                // 更新用戶狀態
                const allReasons = new Set();
                reports.forEach(report => {
                    if (report.reasons && report.reasons.length > 0) {
                        report.reasons.forEach(reason => allReasons.add(reason));
                    }
                });
                
                await warnUser(userId, Array.from(allReasons));
            }
            
            // 批量更新檢舉記錄
            const batch = db.batch();
            
            reports.forEach(report => {
                const reportRef = db.collection('reports').doc(report.id);
                
                batch.update(reportRef, {
                    status: 'resolved',
                    handledBy: auth.currentUser.uid,
                    handlerName: auth.currentUser.email,
                    handledAt: firebase.firestore.FieldValue.serverTimestamp(),
                    actionType: actionType,
                    actionNote: actionNote || '批量處理',
                    punishment: punishment
                });
                
                // 更新檢舉人信用分數
                if (report.reporterId) {
                    updateReporterCredibility(report.reporterId, 5);
                }
            });
            
            await batch.commit();
            
            // 關閉對話框
            document.body.removeChild(modal);
            
            // 顯示處理成功
            alert(`已成功處理 ${reports.length} 個檢舉`);
            
            // 重新加載數據
            loadFrequentReports();
            loadReports();
            
        } catch (error) {
            console.error('批量處理檢舉錯誤:', error);
            alert('處理檢舉時發生錯誤: ' + error.message);
            
            if (document.getElementById('confirm-batch')) {
                document.getElementById('confirm-batch').disabled = false;
                document.getElementById('confirm-batch').textContent = '確認處理';
            }
        }
    });
}

// 加載統計數據
async function loadStatistics() {
    try {
        // 獲取所有檢舉記錄
        const reportsSnapshot = await db.collection('reports').get();
        const reports = [];
        
        reportsSnapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            reports.push(data);
        });
        
        // 添加照片驗證統計
        const verificationsSnapshot = await db.collection('PhotoVerificationRequest').get();
        const totalVerifications = verificationsSnapshot.size;
        const pendingVerifications = verificationsSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
        const approvedVerifications = verificationsSnapshot.docs.filter(doc => doc.data().status === 'approved').length;
        const rejectedVerifications = verificationsSnapshot.docs.filter(doc => doc.data().status === 'rejected').length;

        document.getElementById('total-verifications').textContent = totalVerifications;
        document.getElementById('pending-verifications').textContent = pendingVerifications;
        document.getElementById('approved-verifications').textContent = approvedVerifications;
        document.getElementById('rejected-verifications').textContent = rejectedVerifications;

        
        // 統計檢舉類型
        const typeCounts = {};
        reports.forEach(report => {
            if (report.reasons && report.reasons.length > 0) {
                report.reasons.forEach(reason => {
                    typeCounts[reason] = (typeCounts[reason] || 0) + 1;
                });
            }
        });
        
        // 顯示檢舉類型分布
        const typeStatsContainer = document.getElementById('report-types-stats');
        typeStatsContainer.innerHTML = '';
        
        const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
        
        sortedTypes.forEach(([type, count]) => {
            const percentage = Math.round((count / totalReports) * 100);
            
            const li = document.createElement('li');
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>${getReasonText(type)}</span>
                    <span>${count} (${percentage}%)</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar" style="width: ${percentage}%"></div>
                </div>
            `;
            
            typeStatsContainer.appendChild(li);
        });
        
        // 統計平均處理時間
        const handledReports = reports.filter(report => 
            report.status !== 'pending' && report.createdAt && report.handledAt
        );
        
        let totalHandleTime = 0;
        
        handledReports.forEach(report => {
            const createdAt = report.createdAt.toDate();
            const handledAt = report.handledAt.toDate();
            const handleTimeHours = (handledAt - createdAt) / (1000 * 60 * 60);
            totalHandleTime += handleTimeHours;
        });
        
        const avgHandleTime = handledReports.length > 0 
            ? (totalHandleTime / handledReports.length).toFixed(1) 
            : 0;
        
        document.getElementById('avg-handle-time').textContent = avgHandleTime;
        
        // 本週處理量
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const weeklyHandled = handledReports.filter(report => 
            report.handledAt.toDate() >= oneWeekAgo
        ).length;
        
        document.getElementById('weekly-handled').textContent = weeklyHandled;
        
        // 最常被檢舉用戶
        const reportedUserCounts = {};
        reports.forEach(report => {
            if (report.reportedUserId) {
                reportedUserCounts[report.reportedUserId] = (reportedUserCounts[report.reportedUserId] || 0) + 1;
            }
        });
        
        const mostReportedUsers = Object.entries(reportedUserCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        const mostReportedUsersContainer = document.getElementById('most-reported-users');
        mostReportedUsersContainer.innerHTML = '';
        
        if (mostReportedUsers.length === 0) {
            mostReportedUsersContainer.innerHTML = '<li>沒有足夠數據</li>';
            return;
        }
        
        // 獲取用戶名
        for (const [userId, count] of mostReportedUsers) {
            try {
                const userDoc = await db.collection('userprofileData').doc(userId).get();
                const userName = userDoc.exists ? (userDoc.data().name || '未知用戶') : '未知用戶';
                
                const validReports = reports.filter(report => 
                    report.reportedUserId === userId && report.status === 'resolved'
                ).length;
                
                const li = document.createElement('li');
                li.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>${userName}</span>
                        <span>${count}次 (${validReports}次成立)</span>
                    </div>
                `;
                
                mostReportedUsersContainer.appendChild(li);
            } catch (error) {
                console.error('獲取用戶名錯誤:', error);
            }
        }
        
        // 加載檢舉信用統計
        await loadCredibilityStatistics();
        
    } catch (error) {
        console.error('加載統計數據錯誤:', error);
        alert('加載統計數據時發生錯誤: ' + error.message);
    }
}

// 加載檢舉信用統計
async function loadCredibilityStatistics() {
try {
    // 獲取所有檢舉信用記錄
    const credibilitySnapshot = await db.collection('userReportCredibility').get();
    const credibilityData = [];
    
    credibilitySnapshot.forEach(doc => {
    const data = doc.data();
    data.id = doc.id;
    credibilityData.push(data);
    });
    
    // 檢舉信用分數分布
    let highCreditCount = 0;
    let mediumCreditCount = 0;
    let lowCreditCount = 0;
    
    credibilityData.forEach(data => {
    const score = data.score || 100;
    if (score >= 80) {
        highCreditCount++;
    } else if (score >= 50) {
        mediumCreditCount++;
    } else {
        lowCreditCount++;
    }
    });
    
    // 更新UI前檢查元素是否存在
    const highCreditElement = document.getElementById('high-credit-count');
    const mediumCreditElement = document.getElementById('medium-credit-count');
    const lowCreditElement = document.getElementById('low-credit-count');
    
    if (highCreditElement) highCreditElement.textContent = highCreditCount;
    if (mediumCreditElement) mediumCreditElement.textContent = mediumCreditCount;
    if (lowCreditElement) lowCreditElement.textContent = lowCreditCount;
    
    // 最活躍檢舉人
    const mostActiveReporters = credibilityData
    .sort((a, b) => (b.reportCount || 0) - (a.reportCount || 0))
    .slice(0, 5);
    
    const mostActiveReportersContainer = document.getElementById('most-active-reporters');
    if (mostActiveReportersContainer) {
    mostActiveReportersContainer.innerHTML = '';
    
    if (mostActiveReporters.length === 0) {
        mostActiveReportersContainer.innerHTML = '<li>沒有足夠數據</li>';
    } else {
        for (const data of mostActiveReporters) {
        try {
            const userDoc = await db.collection('userprofileData').doc(data.userId).get();
            const userName = userDoc.exists ? (userDoc.data().name || '未知用戶') : '未知用戶';
            
            const validRate = ((data.validReports || 0) / (data.reportCount || 1) * 100).toFixed(0);
            
            const li = document.createElement('li');
            li.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>${userName}</span>
                <span>${data.reportCount || 0}次 (${validRate}%有效)</span>
            </div>
            `;
            
            mostActiveReportersContainer.appendChild(li);
        } catch (error) {
            console.error('獲取用戶名錯誤:', error);
        }
        }
    }
    }
    
    // 最低信用分數用戶
    const lowestCreditUsers = credibilityData
    .sort((a, b) => (a.score || 100) - (b.score || 100))
    .slice(0, 5);
    
    const lowestCreditUsersContainer = document.getElementById('lowest-credit-users');
    if (lowestCreditUsersContainer) {
    lowestCreditUsersContainer.innerHTML = '';
    
    if (lowestCreditUsers.length === 0) {
        lowestCreditUsersContainer.innerHTML = '<li>沒有足夠數據</li>';
    } else {
        for (const data of lowestCreditUsers) {
        try {
            const userDoc = await db.collection('userprofileData').doc(data.userId).get();
            const userName = userDoc.exists ? (userDoc.data().name || '未知用戶') : '未知用戶';
            
            const li = document.createElement('li');
            li.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>${userName}</span>
                <span>信用分數: ${data.score || 100}</span>
            </div>
            `;
            
            lowestCreditUsersContainer.appendChild(li);
        } catch (error) {
            console.error('獲取用戶名錯誤:', error);
        }
        }
    }
    }
    
} catch (error) {
    console.error('加載檢舉信用統計錯誤:', error);
        // 不影響主要流程
    }
}

// 加載歷史記錄
async function loadHistory() {
    const historyContainer = document.getElementById('history-container');
    const loadingIndicator = document.getElementById('history-loading');
    
    historyContainer.innerHTML = '';
    loadingIndicator.style.display = 'flex';
    
    try {
        // 獲取過濾條件
        const searchTerm = document.getElementById('historySearchInput').value.trim().toLowerCase();
        const statusFilter = document.getElementById('historyStatusFilter').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        // 構建查詢
        let query = db.collection('reports')
            .where('status', '!=', 'pending')
            .orderBy('status')
            .orderBy('handledAt', 'desc')
            .limit(50);
        
        // 應用狀態過濾
        if (statusFilter !== 'all') {
            query = db.collection('reports')
                .where('status', '==', statusFilter)
                .orderBy('handledAt', 'desc')
                .limit(50);
        }
        
        const querySnapshot = await query.get();
        
        loadingIndicator.style.display = 'none';
        
        if (querySnapshot.empty) {
            historyContainer.innerHTML = '<div style="text-align: center; padding: 30px;">沒有處理歷史記錄</div>';
            return;
        }
        
        let records = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            records.push(data);
        });
        
        // 應用日期過濾
        if (startDate) {
            const startDateTime = new Date(startDate).getTime();
            records = records.filter(record => {
                if (!record.handledAt) return true;
                return record.handledAt.toDate().getTime() >= startDateTime;
            });
        }
        
        if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            const endTime = endDateTime.getTime();
            
            records = records.filter(record => {
                if (!record.handledAt) return true;
                return record.handledAt.toDate().getTime() <= endTime;
            });
        }
        
        // 應用搜尋過濾
        if (searchTerm) {
            records = records.filter(record => {
                return (
                    (record.reportedUserName && record.reportedUserName.toLowerCase().includes(searchTerm)) ||
                    (record.reporterName && record.reporterName.toLowerCase().includes(searchTerm)) ||
                    (record.id && record.id.toLowerCase().includes(searchTerm)) ||
                    (record.handlerName && record.handlerName.toLowerCase().includes(searchTerm))
                );
            });
        }
        
        // 檢查過濾後是否有記錄
        if (records.length === 0) {
            historyContainer.innerHTML = '<div style="text-align: center; padding: 30px;">沒有符合條件的歷史記錄</div>';
            return;
        }
        
        // 顯示歷史記錄
        records.forEach(record => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            // 格式化處理時間
            const handledAt = record.handledAt ? formatDate(record.handledAt.toDate()) : '未知時間';
            
            // 構建狀態標籤
            let statusBadge = '';
            switch (record.status) {
                case 'resolved':
                    statusBadge = '<span class="status-badge badge-resolved">已處理</span>';
                    break;
                case 'rejected':
                    statusBadge = '<span class="status-badge badge-rejected">已拒絕</span>';
                    break;
            }
            
            // 構建懲罰描述
            let punishmentText = '';
            if (record.punishment) {
                switch (record.punishment.type) {
                    case 'warning':
                        punishmentText = '發出警告';
                        break;
                    case 'restrict':
                        punishmentText = `限制${getRestrictionTypeText(record.punishment.restrictType)}功能 ${record.punishment.duration} 天`;
                        break;
                    case 'suspend':
                        punishmentText = `暫停帳號 ${record.punishment.duration} 天`;
                        break;
                    case 'ban':
                        punishmentText = '永久封禁帳號';
                        break;
                }
            } else if (record.status === 'rejected') {
                punishmentText = '無處罰 (拒絕檢舉)';
            }
            
            historyItem.innerHTML = `
                <div class="date">${handledAt} · 處理人: ${record.handlerName || '未知'}</div>
                <h4>
                    ${statusBadge}
                    <span style="margin-left: 5px;">
                        ${record.reportedUserName || '未知用戶'} 被 ${record.reporterName || '未知用戶'} 檢舉
                    </span>
                </h4>
                <p>
                    <strong>原因:</strong> ${record.reasons ? record.reasons.map(r => getReasonText(r)).join('、') : '未指定'}
                    <br>
                    <strong>處理結果:</strong> ${punishmentText}
                    ${record.actionNote ? `<br><strong>備註:</strong> ${record.actionNote}` : ''}
                </p>
            `;
            
            // 添加點擊事件，顯示詳情
            historyItem.addEventListener('click', () => {
                showReportDetail(record.id);
            });
            
            historyContainer.appendChild(historyItem);
        });
        
    } catch (error) {
        console.error('加載歷史記錄錯誤:', error);
        loadingIndicator.style.display = 'none';
        historyContainer.innerHTML = `<div style="text-align: center; padding: 30px;">加載歷史記錄時發生錯誤: ${error.message}</div>`;
    }
}

// 加載設置
async function loadSettings() {
    try {
        const settingsDoc = await db.collection('systemSettings').doc('reportManagement').get();
        
        if (settingsDoc.exists) {
            const settings = settingsDoc.data();
            
            // 檢舉處理規則
            if (settings.reportRules) {
                document.getElementById('multipleReportThreshold').value = settings.reportRules.multipleReportThreshold || 3;
                document.getElementById('falseReportPenalty').value = settings.reportRules.falseReportPenalty || 'limit';
                document.getElementById('defaultPunishDays').value = settings.reportRules.defaultPunishDays || 7;
            }
            
            // 自動化流程
            if (settings.automation) {
                document.getElementById('autoRejectFalseReports').checked = settings.automation.autoRejectFalseReports !== false;
                document.getElementById('autoNotifyUser').checked = settings.automation.autoNotifyUser !== false;
                document.getElementById('prioritizeMultipleReports').checked = settings.automation.prioritizeMultipleReports !== false;
                
                // 檢舉信用系統
                if (document.getElementById('enableCreditSystem')) {
                    document.getElementById('enableCreditSystem').checked = settings.automation.enableCreditSystem !== false;
                }
                
                if (document.getElementById('creditThreshold')) {
                    document.getElementById('creditThreshold').value = settings.automation.creditThreshold || 40;
                }
            }
            
            // 警告訊息模板
            if (settings.messageTemplates) {
                document.getElementById('warningTemplate').value = settings.messageTemplates.warning || '';
                document.getElementById('suspensionTemplate').value = settings.messageTemplates.suspension || '';
                
                // 虛假檢舉警告
                if (document.getElementById('falseReportTemplate')) {
                    document.getElementById('falseReportTemplate').value = settings.messageTemplates.falseReport || '';
                }
            }
        }
        
    } catch (error) {
        console.error('加載設置錯誤:', error);
    }
}

// 保存設置
async function saveSettings(section) {
    try {
        const settingsRef = db.collection('systemSettings').doc('reportManagement');
        
        switch (section) {
            case 'reportRules':
                await settingsRef.set({
                    reportRules: {
                        multipleReportThreshold: parseInt(document.getElementById('multipleReportThreshold').value),
                        falseReportPenalty: document.getElementById('falseReportPenalty').value,
                        defaultPunishDays: parseInt(document.getElementById('defaultPunishDays').value)
                    }
                }, { merge: true });
                break;
                
            case 'automation':
                const automation = {
                    autoRejectFalseReports: document.getElementById('autoRejectFalseReports').checked,
                    autoNotifyUser: document.getElementById('autoNotifyUser').checked,
                    prioritizeMultipleReports: document.getElementById('prioritizeMultipleReports').checked
                };
                
                // 添加檢舉信用系統設置
                if (document.getElementById('enableCreditSystem')) {
                    automation.enableCreditSystem = document.getElementById('enableCreditSystem').checked;
                }
                
                if (document.getElementById('creditThreshold')) {
                    automation.creditThreshold = parseInt(document.getElementById('creditThreshold').value);
                }
                
                await settingsRef.set({
                    automation: automation
                }, { merge: true });
                break;
                
            case 'messageTemplates':
                const templates = {
                    warning: document.getElementById('warningTemplate').value,
                    suspension: document.getElementById('suspensionTemplate').value
                };
                
                // 添加虛假檢舉警告模板
                if (document.getElementById('falseReportTemplate')) {
                    templates.falseReport = document.getElementById('falseReportTemplate').value;
                }
                
                await settingsRef.set({
                    messageTemplates: templates
                }, { merge: true });
                break;
        }
        
        alert('設置已保存');
        
    } catch (error) {
        console.error('保存設置錯誤:', error);
        alert('保存設置時發生錯誤: ' + error.message);
    }
}

// 格式化日期
function formatDate(date) {
    return new Intl.DateTimeFormat('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(date);
}

// 獲取檢舉原因文字
function getReasonText(reason) {
    switch (reason) {
        case 'harassment': return '騷擾行為';
        case 'inappropriate': return '不當內容';
        case 'scam': return '詐騙/釣魚';
        case 'fake': return '冒充他人';
        case 'spam': return '廣告/垃圾訊息';
        case 'hate': return '仇恨言論';
        case 'violence': return '暴力/威脅行為';
        case 'other': return '其他違規';
        default: return reason;
    }
}

// 獲取狀態文字
function getStatusText(status) {
    switch (status) {
        case 'pending': return '待處理';
        case 'resolved': return '已處理';
        case 'rejected': return '已拒絕';
        default: return status;
    }
}

// 獲取限制類型文字
function getRestrictionTypeText(type) {
    switch (type) {
        case 'chat': return '聊天';
        case 'match': return '配對';
        case 'photo': return '上傳照片';
        case 'all': return '所有';
        case 'report': return '檢舉';
        default: return type;
    }
}

// 顯示驗證詳情
async function showVerificationDetail(requestId, userId) {
    // 切換視圖
    mainContent.style.display = 'none';
    
    // 確保有一個驗證詳情視圖容器
    let verificationDetailContainer = document.getElementById('verification-detail');
    if (!verificationDetailContainer) {
        verificationDetailContainer = createVerificationDetailContainer();
    }
    
    verificationDetailContainer.style.display = 'block';
    
    try {
        // 獲取驗證請求數據
        const requestDoc = await db.collection('PhotoVerificationRequest').doc(requestId).get();
        if (!requestDoc.exists) {
            alert('找不到驗證請求');
            backToVerificationList();
            return;
        }
        
        const requestData = requestDoc.data();
        
        // 獲取用戶數據
        const userDoc = await db.collection('userprofileData').doc(userId).get();
        if (!userDoc.exists) {
            alert('找不到用戶資料');
            backToVerificationList();
            return;
        }
        
        const userData = userDoc.data();
        
        // 設置請求ID和用戶ID到隱藏字段
        document.getElementById('verification-requestid').value = requestId;
        document.getElementById('verification-userid').textContent = userId;
        
        // 填充驗證詳情表單
        document.getElementById('verification-username').textContent = requestData.userName || '未知用戶';
        document.getElementById('verification-selfie').src = requestData.selfiePhotoUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"%3E%3Crect width="300" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="24" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3E無照片%3C/text%3E%3C/svg%3E';
        document.getElementById('verification-action').textContent = requestData.action || '未指定動作';
        
        // 格式化提交時間
        const createdAt = requestData.createdAt ? new Date(requestData.createdAt.toDate()) : new Date();
        document.getElementById('verification-time').textContent = formatDate(createdAt);
        
        // 顯示用戶照片
        const photosContainer = document.getElementById('verification-photos');
        photosContainer.innerHTML = '';
        
        // 獲取照片URLs
        const photoUrls = userData.photoUrls || [];
        // 獲取照片順序
        const photoOrder = userData.photoOrder || [];
        
        if (photoUrls.length === 0) {
            photosContainer.innerHTML = '<p>用戶沒有上傳照片</p>';
            return;
        }
        
        // 加載已驗證的照片信息
        const verifiedPhotos = userData.verifiedPhotos || {};
        console.log('已驗證照片狀態:', verifiedPhotos);
        
        // 沒有順序或順序為空時，直接按索引顯示
        if (photoOrder.length === 0) {
            for (let i = 0; i < photoUrls.length; i++) {
                if (photoUrls[i]) {
                    addPhotoItemToContainer(i, photoUrls[i], verifiedPhotos, photosContainer);
                }
            }
        } else {
            // 按照順序顯示照片
            for (let i = 0; i < photoOrder.length; i++) {
                const photoIndex = photoOrder[i];
                if (photoIndex >= 0 && photoIndex < photoUrls.length && photoUrls[photoIndex]) {
                    addPhotoItemToContainer(photoIndex, photoUrls[photoIndex], verifiedPhotos, photosContainer);
                }
            }
        }
        
    } catch (error) {
        console.error('顯示驗證詳情錯誤:', error);
        alert(`載入驗證詳情時發生錯誤: ${error.message}`);
        backToVerificationList();
    }
}

// 輔助函數：添加照片項目到容器
function addPhotoItemToContainer(photoIndex, photoUrl, verifiedPhotos, container) {
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    
    // 檢查照片是否已驗證
    const isVerified = verifiedPhotos[photoIndex] === true;
    
    photoItem.innerHTML = `
        <img src="${photoUrl}" alt="用戶照片 ${photoIndex}" 
            onerror="this.src='data:image/svg+xml,%3Csvg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;300&quot; height=&quot;300&quot; viewBox=&quot;0 0 300 300&quot;%3E%3Crect width=&quot;300&quot; height=&quot;300&quot; fill=&quot;%23f0f0f0&quot;/%3E%3Ctext x=&quot;50%%&quot; y=&quot;50%%&quot; font-family=&quot;Arial&quot; font-size=&quot;24&quot; fill=&quot;%23999&quot; text-anchor=&quot;middle&quot; dominant-baseline=&quot;middle&quot;%3E載入失敗%3C/text%3E%3C/svg%3E';"
            loading="lazy">
        <span class="index">#${photoIndex}${isVerified ? ' ✓' : ''}</span>
        <input type="checkbox" class="checkbox" data-index="${photoIndex}" ${isVerified ? 'checked' : ''}>
    `;
    
    container.appendChild(photoItem);
    
    // 添加照片預覽功能
    photoItem.querySelector('img').addEventListener('click', () => {
        document.getElementById('lightboxImage').src = photoUrl;
        document.getElementById('imageLightbox').style.display = 'flex';
    });
}


// 創建驗證詳情容器
function createVerificationDetailContainer() {
    const container = document.createElement('div');
    container.id = 'verification-detail';
    container.className = 'verification-detail card';
    container.style.display = 'none';
    
    container.innerHTML = `
        <div class="detail-header">
            <h2>照片驗證詳情</h2>
            <button id="verification-back" class="btn-info">返回列表</button>
        </div>
        
        <input type="hidden" id="verification-requestid">
        
        <div class="info-grid">
            <div class="info-card">
                <h3>用戶資訊</h3>
                <p><strong>用戶名:</strong> <span id="verification-username">未知用戶</span></p>
                <p><strong>用戶ID:</strong> <span id="verification-userid">未知</span></p>
                <p><strong>提交時間:</strong> <span id="verification-time">未知</span></p>
            </div>
            
            <div class="info-card">
                <h3>驗證動作</h3>
                <p id="verification-action">未指定動作</p>
            </div>
        </div>
        
        <div class="selfie-container">
            <h3>驗證自拍照 <small>(用戶按照指定動作拍攝的照片)</small></h3>
            <img id="verification-selfie" class="selfie-photo" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='24' fill='%23999' text-anchor='middle' dominant-baseline='middle'%3E無照片%3C/text%3E%3C/svg%3E" alt="驗證自拍照">
        </div>
        
        <div class="verification-instruction" style="margin: 20px 0; padding: 15px; background-color: rgba(157, 127, 134, 0.1); border-radius: 8px;">
            <h3>驗證說明</h3>
            <ul style="margin-top: 10px; padding-left: 20px;">
                <li>請比對自拍照與用戶照片是否為同一人</li>
                <li>勾選符合身分的照片後點擊「核准所選照片」</li>
                <li>未勾選的照片將被移除驗證狀態</li>
                <li>核准後照片將顯示已驗證標記</li>
            </ul>
        </div>
        
        <h3>用戶照片 <small>(勾選確認為用戶本人的照片)</small></h3>
        <div class="photos-container" id="verification-photos">
            <!-- 用戶照片將被動態載入到這裡 -->
            <div id="loadingPhotos" style="grid-column: 1 / -1; text-align: center; padding: 20px;">
                <div class="loading-spinner"></div>
                <span>載入中...</span>
            </div>
        </div>
        
        <div class="button-group" style="margin-top: 20px; display: flex; gap: 15px; justify-content: center;">
            <button id="verification-approve" class="btn-success">核准所選照片</button>
            <button id="verification-reject" class="btn-danger">拒絕驗證</button>
        </div>
    `;
    
    document.body.appendChild(container);
    
    // 添加事件監聽器
    container.querySelector('#verification-back').addEventListener('click', backToVerificationList);
    container.querySelector('#verification-approve').addEventListener('click', approveVerification);
    container.querySelector('#verification-reject').addEventListener('click', rejectVerification);
    
    return container;
}

// 返回列表
function backToVerificationList() {
    document.getElementById('verification-detail').style.display = 'none';
    mainContent.style.display = 'block';
    
    // 重新加載驗證請求
    loadVerificationRequests();
}

// 核准驗證
async function approveVerification() {
    const requestId = document.getElementById('verification-requestid').value;
    const userId = document.getElementById('verification-userid').textContent;
    
    if (!requestId || !userId) {
        alert('缺少請求ID或用戶ID');
        return;
    }
    
    // 獲取選中的照片索引
    const selectedCheckboxes = document.querySelectorAll('#verification-photos input[type="checkbox"]:checked');
    const verifiedIndices = Array.from(selectedCheckboxes).map(checkbox => {
        return parseInt(checkbox.getAttribute('data-index'));
    });
    
    if (verifiedIndices.length === 0) {
        alert('請選擇至少一張符合驗證條件的照片');
        return;
    }
    
    try {
        const approveBtn = document.getElementById('verification-approve');
        approveBtn.disabled = true;
        approveBtn.innerHTML = '<div class="loading-spinner"></div> 處理中...';
        
        // 1. 獲取當前驗證請求數據
        const requestDoc = await db.collection('PhotoVerificationRequest').doc(requestId).get();
        if (!requestDoc.exists) {
            throw new Error('找不到驗證請求');
        }
        const requestData = requestDoc.data();
        
        // 2. 更新驗證請求狀態
        await db.collection('PhotoVerificationRequest').doc(requestId).update({
            status: 'approved',
            verifiedPhotoIndices: verifiedIndices,
            verifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
            verifiedBy: auth.currentUser ? auth.currentUser.uid : 'admin',
            synced: false
        });
        
        // 3. 更新用戶資料中的驗證狀態
        const userDoc = await db.collection('userprofileData').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // 3.1 獲取或初始化 verifiedPhotos 物件
            let verifiedPhotos = userData.verifiedPhotos || {};
            
            // 3.2 獲取所有顯示的照片索引 (所有被顯示在驗證界面的照片)
            const allCheckboxes = document.querySelectorAll('#verification-photos input[type="checkbox"]');
            const allDisplayedIndices = Array.from(allCheckboxes).map(checkbox => {
                return parseInt(checkbox.getAttribute('data-index'));
            });
            
            // 3.3 更新驗證狀態
            // 重要：先將界面上所有顯示的照片設置為 false，再將選中的設為 true
            allDisplayedIndices.forEach(index => {
                verifiedPhotos[index.toString()] = false;
            });
            
            // 3.4 將選中的照片設置為 true
            verifiedIndices.forEach(index => {
                verifiedPhotos[index.toString()] = true;
            });
            
            // 3.5 更新用戶文檔中的 verifiedPhotos 字段
            await db.collection('userprofileData').doc(userId).update({
                verifiedPhotos: verifiedPhotos
            });
            
            console.log('已更新用戶已驗證照片:', verifiedPhotos);
        }
        
        // 4. 刪除驗證請求記錄 (改為使用 delete 而不是更新)
        await db.collection('PhotoVerificationRequest').doc(requestId).delete();
        console.log('已刪除驗證請求:', requestId);
        
        // 5. 發送通知給用戶
        await db.collection('notifications').add({
            userId: userId,
            type: 'verification_approved',
            message: '您的照片驗證請求已通過審核',
            data: {
                verifiedIndices: verifiedIndices
            },
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('已核准選定的照片並刪除驗證請求');
        
        // 重置按鈕狀態，以便下次使用
        approveBtn.disabled = false;
        approveBtn.textContent = '核准所選照片';
        
        backToVerificationList();
        
    } catch (error) {
        console.error('核准驗證錯誤:', error);
        alert(`核准驗證時發生錯誤: ${error.message}`);
        
        const approveBtn = document.getElementById('verification-approve');
        approveBtn.disabled = false;
        approveBtn.textContent = '核准所選照片';
    }
}


// 拒絕驗證
async function rejectVerification() {
    const requestId = document.getElementById('verification-requestid').value;
    const userId = document.getElementById('verification-userid').textContent;
    
    if (!requestId || !userId) {
        alert('缺少請求ID或用戶ID');
        return;
    }
    
    const confirmReject = confirm('確定要拒絕此驗證請求嗎？');
    if (!confirmReject) return;
    
    try {
        const rejectBtn = document.getElementById('verification-reject');
        rejectBtn.disabled = true;
        rejectBtn.innerHTML = '<div class="loading-spinner"></div> 處理中...';
        
        // 先獲取驗證請求數據，用於之後發送通知
        const requestDoc = await db.collection('PhotoVerificationRequest').doc(requestId).get();
        if (!requestDoc.exists) {
            throw new Error('找不到驗證請求');
        }
        const requestData = requestDoc.data();
        
        // 直接刪除驗證請求記錄，而不是更新它的狀態
        await db.collection('PhotoVerificationRequest').doc(requestId).delete();
        console.log('已刪除驗證請求:', requestId);
        
        // 發送拒絕通知給用戶
        await db.collection('notifications').add({
            userId: userId,
            type: 'verification_rejected',
            message: '您的照片驗證請求未通過審核，請確保照片清晰顯示您本人，並按照指示的動作拍攝。',
            isRead: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('已拒絕驗證請求並刪除記錄');
        backToVerificationList();
        
    } catch (error) {
        console.error('拒絕驗證錯誤:', error);
        alert(`拒絕驗證時發生錯誤: ${error.message}`);
        
        const rejectBtn = document.getElementById('verification-reject');
        rejectBtn.disabled = false;
        rejectBtn.textContent = '拒絕驗證';
    }
}


// 加載照片驗證請求
async function loadVerificationRequests() {
    const container = document.getElementById('verification-container');
    const loadingElement = document.getElementById('verification-loading');
    
    if (!container || !loadingElement) {
        console.error('驗證請求容器元素未找到');
        return;
    }
    
    container.innerHTML = '';
    loadingElement.style.display = 'flex';
    
    try {
        // 獲取所有待處理驗證請求
        const querySnapshot = await db.collection('PhotoVerificationRequest')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .get();
        
        loadingElement.style.display = 'none';
        
        if (querySnapshot.empty) {
            container.innerHTML = '<div style="text-align: center; padding: 30px;">沒有待處理的驗證請求</div>';
            return;
        }
        
        // 顯示驗證請求卡片
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const requestCard = document.createElement('div');
            requestCard.className = 'report-card pending';
            
            // 格式化日期
            const createdAt = data.createdAt ? new Date(data.createdAt.toDate()) : new Date();
            const formattedDate = formatDate(createdAt);
            
            requestCard.innerHTML = `
                <h3>
                    <span class="status-badge badge-pending">待驗證</span>
                    <span style="margin-left: 5px;">${data.userName || '未知用戶'}</span>
                </h3>
                <p><strong>提交時間:</strong> ${formattedDate}</p>
                <p><strong>要求動作:</strong> ${data.action || '未指定'}</p>
            `;
            
            // 添加點擊事件
            requestCard.addEventListener('click', () => {
                showVerificationDetail(doc.id, data.userId);
            });
            
            container.appendChild(requestCard);
        });
        
    } catch (error) {
        console.error('加載驗證請求錯誤:', error);
        loadingElement.style.display = 'none';
        container.innerHTML = `<div style="text-align: center; padding: 30px;">加載驗證請求時發生錯誤: ${error.message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('管理員按鈕診斷開始...');
    
    // 檢查按鈕是否存在
    const adminButton = document.getElementById('adminButton');
    if (!adminButton) {
        console.error('找不到adminButton元素');
        return;
    }
    console.log('找到adminButton元素:', adminButton);
    
    // 檢查Firebase是否初始化
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.error('Firebase尚未初始化');
        return;
    }
    console.log('Firebase已初始化');
    
    // 檢查用戶認證狀態
    const auth = firebase.auth();
    console.log('檢查用戶認證狀態...');
    
    // 直接顯示按鈕，無論用戶是否登入（用於測試）
    // adminButton.style.display = 'inline-block';
    // console.log('已強制顯示管理員按鈕（測試用）');
    
    // 監聽認證狀態變化
    auth.onAuthStateChanged(async (user) => {
        console.log('認證狀態變更:', user ? '已登入: ' + user.email : '未登入');
        
        if (user) {
            try {
                // 檢查用戶是否在管理員集合中
                const db = firebase.firestore();
                console.log('嘗試查詢管理員文檔:', user.uid);
                
                const adminDoc = await db.collection('admins').doc(user.uid).get();
                
                if (!adminDoc.exists) {
                    console.log('用戶不是管理員，顯示申請按鈕');
                    adminButton.style.display = 'inline-block';
                    
                    // 強制更新DOM
                    setTimeout(() => {
                        console.log('延遲後按鈕顯示狀態:', adminButton.style.display);
                        // 再次確保按鈕可見
                        if (adminButton.style.display === 'none') {
                            adminButton.style.display = 'inline-block';
                            console.log('已強制顯示管理員按鈕');
                        }
                    }, 1000);
                } else {
                    console.log('用戶已是管理員');
                    // 更新用戶狀態顯示
                    const userStatus = document.getElementById('userStatus');
                    if (userStatus) {
                        userStatus.innerHTML = `已登入: ${user.email} <span style="color: #4CAF50; font-weight: bold; margin-left: 5px;">[管理員]</span>`;
                    }
                }
            } catch (error) {
                console.error('檢查管理員狀態失敗:', error);
                // 出錯時也顯示按鈕（可能是權限問題）
                adminButton.style.display = 'inline-block';
                console.log('出錯後已強制顯示管理員按鈕');
            }
        }
    });
    
    // 檢查按鈕點擊事件是否正確綁定
    const adminKeyModal = document.getElementById('adminKeyModal');
    if (!adminKeyModal) {
        console.error('找不到adminKeyModal元素');
    } else {
        console.log('找到adminKeyModal元素');
        
        // 確保按鈕點擊後顯示對話框
        adminButton.addEventListener('click', function() {
            console.log('點擊管理員按鈕');
            adminKeyModal.style.display = 'block';
        });
        
        // 確保取消按鈕可以關閉對話框
        const cancelAdminKey = document.getElementById('cancelAdminKey');
        if (cancelAdminKey) {
            cancelAdminKey.addEventListener('click', function() {
                adminKeyModal.style.display = 'none';
            });
        }
    }
    
    console.log('管理員按鈕診斷完成');
});