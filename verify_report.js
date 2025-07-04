import { 
    auth,
    getAuth, 
    db, 
    storage, 
    onAuthStateChanged, 
    doc, 
    getDoc, 
    collection,
    signOut,
    signInWithEmailAndPassword,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    updateDoc,
    setDoc,
    addDoc,
    deleteDoc,
    serverTimestamp,
    writeBatch,
    increment,
    getFirestore
} from './firebase-config.js';

// 從統一的 App Check 模組匯入需要的函數
import { 
    checkAppCheckStatus,
    getAppCheckToken,
    installXHRInterceptor,
    runFullDiagnostics
} from './app-check-module.js';

import { setupSessionManager } from './session-manager.js';
// DOM 元素
const loginSection = document.getElementById('loginSection');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const userStatus = document.getElementById('userStatus');
const errorMessage = document.getElementById('errorMessage');
const mainContent = document.getElementById('main-content');
const reportsContainer = document.getElementById('reports-container');
const reportDetail = document.getElementById('report-detail');
const backToListBtn = document.getElementById('backToList');

// 全域變數
let currentReportId = null;
let currentPage = 1;
let reportsPerPage = 12;
let totalReports = 0;
let isProcessingAuthChange = false;
let APP_CHECK_INITIALIZED = false;

// 初始化應用程序
function initializeApplication() {
    console.log('開始初始化應用程序...');
    
    // 確保頁面元素已加載
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeAfterDOMLoaded();
            // setupSessionTimeoutHandler(); // 添加會話超時處理
            const sessionManager = setupSessionManager();
        });
    } else {
        initializeAfterDOMLoaded();
        // setupSessionTimeoutHandler(); // 添加會話超時處理
        const sessionManager = setupSessionManager();
    }
}

function initializeAfterDOMLoaded() {
    // 優先檢查 App Check 狀態
    checkAppCheckInitialization()
        .then(() => {
            // 在 App Check 初始化後設置其他初始化
            console.log('App Check 檢查完成，繼續初始化頁面');
            initializePage();
            setupAuthStateListener();

            createEmailExportSection();
            updateExportButtonStatus();
        })
        .catch(error => {
            console.error('App Check 初始化失敗:', error);
            // 顯示友好的錯誤訊息
            showAppCheckError();
            
            // 仍然初始化頁面，允許用戶嘗試使用
            initializePage();
            setupAuthStateListener();

            createEmailExportSection();
            updateExportButtonStatus();
        });
}

// 檢查 App Check 初始化
async function checkAppCheckInitialization() {
    console.log('正在檢查 App Check 狀態...');
    
    try {
        // 顯示初始化狀態
        const statusElement = document.getElementById('appCheckStatus');
        if (statusElement) {
            statusElement.className = 'initializing';
            statusElement.style.display = 'block';
            statusElement.textContent = 'App Check: 初始化中...';
        }
        
        // 檢查是否已在全局範圍初始化
        if (window.APP_CHECK_INITIALIZED) {
            console.log('App Check 已初始化');
            return true;
        }
        
        // 帶延遲的檢查，確保 reCAPTCHA 有足夠時間載入
        await new Promise(resolve => setTimeout(resolve, 2000)); // 延長等待時間
        
        // 檢查 reCAPTCHA 是否已載入，但不阻止流程
        if (typeof grecaptcha === 'undefined') {
            console.warn('reCAPTCHA 尚未載入，將嘗試繼續');
            // 不拋出錯誤，嘗試繼續流程
        }
        
        // 修正檢查 Firebase 是否可用的方式
        // 由於我們導入的是模組化的 Firebase，不會有全局的 firebase 對象
        // 改為檢查 auth 對象是否有效
        if (!auth) {
            console.error('Firebase Auth 尚未初始化');
            throw new Error('Firebase Auth 尚未初始化，App Check 無法初始化');
        }
        
        console.log('開始 App Check 驗證...');
        
        // 使用 Promise.race 設置較長的超時時間
        const checkPromise = checkAppCheckStatus();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('App Check 驗證超時 (10秒)')), 10000);
        });
        
        const result = await Promise.race([checkPromise, timeoutPromise]);
        
        if (result.success) {
            console.log('App Check 驗證成功!');
            
            // 安裝攔截器添加 App Check 令牌到所有請求
            installXHRInterceptor();
            
            // 更新狀態元素
            if (statusElement) {
                statusElement.className = 'success';
                statusElement.textContent = 'App Check: 已驗證 ✓';
                // 3秒後隱藏
                setTimeout(() => { statusElement.style.display = 'none'; }, 3000);
            }
            
            // 標記為已初始化
            window.APP_CHECK_INITIALIZED = true;
            APP_CHECK_INITIALIZED = true;
            return true;
        } else {
            console.warn('App Check 驗證失敗:', result.error);
            
            // 更新狀態元素
            if (statusElement) {
                statusElement.className = 'error';
                statusElement.textContent = 'App Check: 驗證失敗 ✗';
            }
            
            // 嘗試使用降級策略
            console.warn('將使用降級策略繼續進行');
            
            // 創建降級的 App Check 替代
            window.appCheck = { 
                _isFallback: true,
                getToken: () => Promise.resolve({ 
                    token: 'fallback-token', 
                    expireTimeMillis: Date.now() + 300000 // 5分鐘後過期
                }) 
            };
            
            // 不拋出錯誤，返回 false 表示降級
            return false;
        }
    } catch (error) {
        console.error('App Check 初始化錯誤:', error);
        
        // 更新狀態元素
        const statusElement = document.getElementById('appCheckStatus');
        if (statusElement) {
            statusElement.className = 'error';
            statusElement.textContent = 'App Check: 發生錯誤 ✗';
        }
        
        // 不拋出錯誤，允許降級策略
        return false;
    }
}

// 顯示 App Check 錯誤
function showAppCheckError() {
    const container = document.body;
    
    // 創建錯誤面板
    const errorPanel = document.createElement('div');
    errorPanel.style.position = 'fixed';
    errorPanel.style.top = '0';
    errorPanel.style.left = '0';
    errorPanel.style.width = '100%';
    errorPanel.style.height = '100%';
    errorPanel.style.backgroundColor = 'rgba(0,0,0,0.8)';
    errorPanel.style.zIndex = '10000';
    errorPanel.style.display = 'flex';
    errorPanel.style.flexDirection = 'column';
    errorPanel.style.alignItems = 'center';
    errorPanel.style.justifyContent = 'center';
    errorPanel.style.color = 'white';
    errorPanel.style.textAlign = 'center';
    errorPanel.style.padding = '20px';
    
    // 錯誤內容
    errorPanel.innerHTML = `
        <h2 style="margin-bottom: 20px;">安全驗證失敗</h2>
        <p style="margin-bottom: 15px; max-width: 600px;">系統無法完成安全驗證 (App Check)，可能是由於以下原因:</p>
        <ul style="text-align: left; max-width: 600px; margin-bottom: 20px;">
            <li style="margin-bottom: 10px;">reCAPTCHA 未能正確載入</li>
            <li style="margin-bottom: 10px;">瀏覽器封鎖了第三方 Cookie 或腳本</li>
            <li style="margin-bottom: 10px;">網路連接問題</li>
            <li style="margin-bottom: 10px;">安全性擴充功能干擾</li>
        </ul>
        <p style="margin-bottom: 20px; max-width: 600px;">建議操作：</p>
        <ol style="text-align: left; max-width: 600px; margin-bottom: 20px;">
            <li style="margin-bottom: 10px;">重新整理頁面</li>
            <li style="margin-bottom: 10px;">確保允許第三方 Cookie</li>
            <li style="margin-bottom: 10px;">暫時停用任何內容阻擋器或隱私保護工具</li>
            <li style="margin-bottom: 10px;">檢查網路連線</li>
        </ol>
        <button id="retryAppCheck" style="padding: 10px 20px; background-color: #9D7F86; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">重試連接</button>
        <button id="runDiagnostics" style="padding: 10px 20px; background-color: #555; color: white; border: none; border-radius: 5px; cursor: pointer;">執行診斷</button>
    `;
    
    // 添加到頁面
    container.appendChild(errorPanel);
    
    // 添加按鈕事件
    document.getElementById('retryAppCheck').addEventListener('click', function() {
        location.reload();
    });
    
    document.getElementById('runDiagnostics').addEventListener('click', function() {
        runFullDiagnostics();
        alert('診斷已執行，請查看瀏覽器控制台以獲取詳細資訊。');
    });
}

// 初始化頁面元素
function initializePage() {
    console.log('開始初始化頁面');
    
    // 檢查DOM元素是否正確獲取
    if (!document.getElementById('loginSection')) console.error('無法找到loginSection元素');
    if (!document.getElementById('main-content')) console.error('無法找到mainContent元素');
    if (!document.getElementById('logoutButton')) console.error('無法找到logoutButton元素');
    if (!document.getElementById('userStatus')) console.error('無法找到userStatus元素');
    
    // 登入按鈕事件
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
        console.log('已綁定登入按鈕事件');
    }
    
    // 登出按鈕事件
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
        console.log('已綁定登出按鈕事件');
    }
    
    // 返回列表按鈕事件
    const backToListBtn = document.getElementById('backToList');
    if (backToListBtn) {
        backToListBtn.addEventListener('click', function() {
            document.getElementById('report-detail').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
        });
        console.log('已綁定返回列表按鈕事件');
    }
    
    // 標籤頁切換事件
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // 切換標籤頁樣式
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 切換內容區
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.classList.remove('active'));
            
            const targetContent = document.getElementById(`${tabId}-tab`);
            if (targetContent) {
                targetContent.classList.add('active');
                
                // 根據標籤頁載入相應數據
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
    
    // 應用過濾按鈕事件
    const applyFiltersBtn = document.getElementById('applyFilters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', function() {
            currentPage = 1;
            loadReports();
        });
        console.log('已綁定應用過濾按鈕事件');
    }
    
    // 提交處理按鈕事件
    const submitActionBtn = document.getElementById('submitAction');
    if (submitActionBtn) {
        submitActionBtn.addEventListener('click', handleReportAction);
        console.log('已綁定提交處理按鈕事件');
    }
    
    // 取消處理按鈕事件
    const cancelActionBtn = document.getElementById('cancelAction');
    if (cancelActionBtn) {
        cancelActionBtn.addEventListener('click', function() {
            document.getElementById('report-detail').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
        });
        console.log('已綁定取消處理按鈕事件');
    }
    
    // 設置表單提交事件
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
    
    // 圖片查看事件
    setupEnhancedLightbox();
    
    // 設置Enter鍵登入
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                handleLogin();
            }
        });
        console.log('已設置Enter鍵登入');
    }
    
    // 添加店家審核標籤頁點擊處理
    const businessApprovalTab = document.querySelector('.tab[data-tab="businessApproval"]');
    // if (businessApprovalTab) {
    //     businessApprovalTab.addEventListener('click', function() {
    //         loadBusinessApprovalRequests();
    //     });
    //     console.log('已設置店家審核標籤頁點擊事件');
    // }
    
    // 初始化管理員申請按鈕
    initAdminButtons();
    
    console.log('頁面初始化完成');
}

// 設置認證狀態監聽器
function setupAuthStateListener() {
    console.log('設置認證狀態監聽器');
    
    let processingAuthChange = false;
    
    auth.onAuthStateChanged(user => {
        if (processingAuthChange) {
            console.log('正在處理認證狀態變更，忽略重複事件');
            return;
        }
        
        processingAuthChange = true;
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
        
        // 延遲重置處理標記，避免處理多次快速觸發的事件
        setTimeout(() => {
            processingAuthChange = false;
        }, 500);
    });
}

// // 設置增強版燈箱
// function setupEnhancedLightbox() {
//     const lightbox = document.getElementById('imageLightbox');
//     const lightboxImg = document.getElementById('lightboxImage');
//     const closeBtn = lightbox.querySelector('.close');
    
//     // 關閉燈箱事件
//     if (closeBtn) {
//         closeBtn.addEventListener('click', function() {
//             lightbox.style.display = 'none';
//         });
//     }
    
//     // 點擊燈箱背景關閉
//     lightbox.addEventListener('click', function(e) {
//         if (e.target === lightbox) {
//             lightbox.style.display = 'none';
//         }
//     });
    
//     // 鍵盤事件 - ESC 關閉燈箱
//     document.addEventListener('keydown', function(e) {
//         if (e.key === 'Escape' && lightbox.style.display === 'flex') {
//             lightbox.style.display = 'none';
//         }
//     });
    
//     console.log('增強型燈箱設置完成');
// }

// 初始化管理員申請按鈕
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
    
    // 添加到登入表單前
    const loginSection = document.getElementById('loginSection');
    if (loginSection) {
        loginSection.parentNode.insertBefore(warningDiv, loginSection);
        
        // 添加重試按鈕事件
        setTimeout(() => {
            const retryBtn = document.getElementById('retryAppCheck');
            if (retryBtn) {
                retryBtn.addEventListener('click', async function() {
                    this.disabled = true;
                    this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 驗證中...';
                    
                    const result = await checkAppCheckStatus();
                    if (result.success) {
                        // 移除警告並顯示成功訊息
                        document.getElementById('appCheckWarning').remove();
                        showSuccess('App Check 驗證成功！您現在可以嘗試登入。');
                        window.APP_CHECK_INITIALIZED = true;
                        APP_CHECK_INITIALIZED = true;
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

// 顯示成功訊息
function showSuccess(message) {
    const successAlert = document.createElement('div');
    successAlert.className = 'alert alert-success mt-3';
    successAlert.textContent = message;
    
    // 清除之前的錯誤訊息
    clearErrorMessage();
    
    // 插入成功訊息
    const loginSection = document.getElementById('loginSection');
    if (loginSection) {
        loginSection.parentNode.insertBefore(successAlert, loginSection);
    }
    
    // 5秒後自動移除
    setTimeout(() => {
        successAlert.remove();
    }, 5000);
}

// 管理員申請功能
async function applyForAdmin() {
    const adminKeyError = document.getElementById('adminKeyError');
    const submitAdminKey = document.getElementById('submitAdminKey');
    
    try {
        if (!auth.currentUser) {
            throw new Error('請先登入');
        }
        
        // 顯示處理中狀態
        submitAdminKey.disabled = true;
        submitAdminKey.innerHTML = '<div class="loading-spinner"></div> 處理中...';
        
        if (adminKeyError) adminKeyError.style.display = 'none';
        
        console.log('嘗試申請管理員權限');
        
        // 檢查用戶是否已有管理員權限
        const adminDocRef = doc(db, 'admin', auth.currentUser.uid);
        const adminDoc = await getDoc(adminDocRef);
        if (adminDoc.exists) {
            throw new Error('您已具有管理員權限');
        }
        
        // 創建管理員請求
        const adminRequestsRef = collection(db, 'adminRequests');
        await addDoc('adminRequests', {
            userId: auth.currentUser.uid,
            email: auth.currentUser.email,
            status: 'pending',
            ipAddress: '自動檢測', // 實際應用中可使用函數獲取
            timestamp: serverTimestamp()
        });
        
        // 顯示成功提示
        document.getElementById('adminKeyModal').style.display = 'none';
        const adminSuccessModal = document.getElementById('adminSuccessModal');
        if (adminSuccessModal) {
            adminSuccessModal.style.display = 'block';
            
            // 自動重載倒計時
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
            
            // 立即重載按鈕
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
        // 恢復按鈕狀態
        if (submitAdminKey) {
            submitAdminKey.disabled = false;
            submitAdminKey.textContent = '確認申請';
        }
    }
}

// 處理登入動作
async function handleLogin() {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    
    if (!email || !password) {
        showError('請填寫郵箱和密碼');
        return;
    }
    
    try {
        // 顯示登入中狀態
        const loginButton = document.getElementById('loginButton');
        loginButton.innerHTML = '<div class="loading-spinner"></div> 登入中...';
        loginButton.disabled = true;
        
        if (document.getElementById('errorMessage')) {
            document.getElementById('errorMessage').style.display = 'none';
        }
        
        console.log('嘗試登入:', email);
        
        // 確保 App Check 已初始化並預先獲取令牌
        if (!APP_CHECK_INITIALIZED && !window.APP_CHECK_INITIALIZED) {
            console.warn('App Check 未初始化，嘗試初始化');
            
            try {
                // 安裝 XHR 攔截器來自動添加 App Check 令牌
                installXHRInterceptor();
                console.log('已安裝 App Check 攔截器');
            } catch (interceptorError) {
                console.warn('安裝 App Check 攔截器失敗:', interceptorError);
            }

            try {
                await checkAppCheckInitialization();
                // 初始化後，提前請求一次令牌，但不阻塞流程
                try {
                    const preToken = await getAppCheckToken();
                    console.log('成功預取 App Check 令牌');
                    window.APP_CHECK_INITIALIZED = true;
                    APP_CHECK_INITIALIZED = true;
                } catch (tokenError) {
                    console.warn('預取 App Check 令牌失敗，但繼續嘗試登入:', tokenError);
                }
            } catch (appCheckError) {
                console.error('登入前初始化 App Check 失敗:', appCheckError);
                // 不拋出錯誤，繼續嘗試登入，使用降級策略
                console.warn('App Check 驗證失敗，但仍將嘗試登入');
                
                // 顯示警告但繼續嘗試登入
                const loginButton = document.getElementById('loginButton');
                if (loginButton) {
                    const originalText = loginButton.innerHTML;
                    loginButton.innerHTML = '嘗試登入...';
                    // 使用一個標記以防止多次警告
                    if (!window.appCheckWarningShown) {
                        window.appCheckWarningShown = true;
                        showError('警告: 安全驗證未完成，登入可能不成功，但將嘗試。');
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                    loginButton.innerHTML = originalText;
                }
            }
        }
        
        // 嘗試登入，增加超時時間
        console.log('開始執行登入...');

        try {
            // 使用 Promise.race 但延長超時時間
            // 修正這裡：正確使用 Firebase v9 函數簽名
            // 從 auth.signInWithEmailAndPassword(auth, email, password) 改為 signInWithEmailAndPassword(auth, email, password)
            const loginPromise = signInWithEmailAndPassword(auth, email, password);
            const loginTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('登入請求超時')), 30000); // 延長至 30 秒
            });
            
            const userCredential = await Promise.race([loginPromise, loginTimeout]);
            console.log('登入成功:', userCredential.user.email);
        
            // 清除輸入字段
            document.getElementById('emailInput').value = '';
            document.getElementById('passwordInput').value = '';
        } catch (loginError) {
            console.error('登入嘗試失敗:', loginError);
            // 檢查是否是 App Check 相關的網絡錯誤
            if (loginError.code === 'auth/network-request-failed') {
                // 可能是 App Check 問題，再試一次，但不使用 App Check
                console.warn('檢測到網絡錯誤，可能是 App Check 問題，嘗試繞過...');
                
                try {
                    showError('正在重試登入...');
                    // 直接嘗試登入，不等待 App Check
                    // 同樣修正這裡的函數調用方式
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    console.log('繞過 App Check 登入成功:', userCredential.user.email);
                    
                    // 清除錯誤提示
                    clearErrorMessage();
                    
                    // 登入成功後的其他操作...
                    // 清除輸入字段
                    document.getElementById('emailInput').value = '';
                    document.getElementById('passwordInput').value = '';
                    
                } catch (retryError) {
                    console.error('重試登入仍然失敗:', retryError);
                    throw retryError; // 拋出以便由外層 catch 處理
                }
            } else {
                throw loginError; // 拋出以便由外層 catch 處理
            }
        }
        
    } catch (error) {
        console.error('登入錯誤:', error);
        
        // 顯示錯誤訊息
        showError(getErrorMessage(error));
        
        // 重置登入按鈕
        const loginButton = document.getElementById('loginButton');
        loginButton.textContent = '登入';
        loginButton.disabled = false;
    }
}


// 處理登出
async function handleLogout() {
    try {
        const logoutButton = document.getElementById('logoutButton');
        logoutButton.innerHTML = '<div class="loading-spinner"></div> 登出中...';
        logoutButton.disabled = true;
        
        console.log('嘗試登出');
        await auth.signOut();
        console.log('登出成功');
        
        // onAuthStateChanged 會處理其餘的操作
    } catch (error) {
        console.error('登出錯誤:', error);
        alert('登出時發生錯誤: ' + error.message);
        
        // 重置登出按鈕
        const logoutButton = document.getElementById('logoutButton');
        logoutButton.textContent = '登出';
        logoutButton.disabled = false;
    }
}

// 登入成功
function onLoginSuccess(user) {
    try {
        console.log('登入成功處理開始，用戶郵箱:', user.email);
        
        // 更新用戶界面
        document.getElementById('userStatus').textContent = `已登入: ${user.email}`;
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('logoutButton').style.display = 'block';
        document.getElementById('main-content').style.display = 'block';
        
        // 檢查用戶是否為管理員
        checkAdminStatus(user.uid);
        
        // 初始化活動標籤頁
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const tabId = activeTab.getAttribute('data-tab');
            console.log(`初始化活動標籤頁: ${tabId}`);
            
            // 使用 setTimeout 確保 UI 已更新
            setTimeout(() => {
                if (tabId === 'report') {
                    console.log("延遲載入報告");
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
        
        // 重置登入按鈕
        const loginButton = document.getElementById('loginButton');
        if (loginButton) {
            loginButton.textContent = '登入';
            loginButton.disabled = false;
        }
        
        console.log('登入成功處理完成');

        setTimeout(() => {
            createEmailExportSection();
            updateExportButtonStatus();
        }, 1000);
    } catch (error) {
        console.error('登入成功處理出錯:', error);
        
        // 確保界面正確顯示，即使出錯
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

 // 添加檢查管理員狀態的函數
 async function checkAdminStatus(userId) {
    try {
        // 使用 v9 API 獲取管理員文檔
        const adminDocRef = doc(db, 'admins', userId);
        const adminDoc = await getDoc(adminDocRef);
        
        // 獲取用戶狀態元素
        const userStatus = document.getElementById('userStatus');
        
        if (adminDoc.exists()) {
            console.log('用戶已是管理員');
            // 更新用戶狀態顯示
            if (userStatus) {
                userStatus.innerHTML = `${userStatus.textContent} <span style="color: #4CAF50; font-weight: bold; margin-left: 5px;">[管理員]</span>`;
            }
            
            // 隱藏申請管理員按鈕
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

// 登出成功處理函數
function onLogout() {
    console.log('執行登出後處理');
    
    // 獲取元素引用
    const userStatus = document.getElementById('userStatus');
    const loginSection = document.getElementById('loginSection');
    const logoutButton = document.getElementById('logoutButton');
    const mainContent = document.getElementById('main-content');
    
    // 檢查元素是否存在再操作
    if (userStatus) userStatus.textContent = '';
    if (loginSection) loginSection.style.display = 'block';
    if (logoutButton) logoutButton.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    
    // 隱藏所有可能開啟的詳情頁面
    if (document.getElementById('report-detail')) {
        document.getElementById('report-detail').style.display = 'none';
    }
    
    if (document.getElementById('verification-detail')) {
        document.getElementById('verification-detail').style.display = 'none';
    }
    
    if (document.getElementById('business-approval-detail')) {
        document.getElementById('business-approval-detail').style.display = 'none';
    }
    
    // 重置登出按鈕
    if (logoutButton) {
        logoutButton.textContent = '登出';
        logoutButton.disabled = false;
    }
    
    console.log('登出後處理完成');
}
        
// 顯示錯誤信息
function showError(message) {
    // 先清除之前的錯誤訊息
    clearErrorMessage();
    
    // 創建錯誤提示
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-danger login-error-alert mt-3';
    errorAlert.role = 'alert';
    
    // 插入到登入表單之前
    const loginForm = document.getElementById('businessLoginForm') || document.querySelector('form');
    if (loginForm) {
        loginForm.parentNode.insertBefore(errorAlert, loginForm);
    } else {
        // 如果找不到表單，添加到其他地方
        const possibleParent = document.querySelector('.login-section') || 
                            document.querySelector('.container') || 
                            document.body;
        possibleParent.prepend(errorAlert);
    }
    
    // 設置錯誤訊息，支持HTML
    errorAlert.innerHTML = message;
}

// 清除錯誤訊息
function clearErrorMessage() {
    const errorAlert = document.querySelector('.login-error-alert');
    if (errorAlert) {
        errorAlert.remove();
    }
}

// 簡化的檢查錯誤訊息並返回用戶友好的訊息
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
            // 添加 App Check 相關錯誤處理
            let message = '網絡連接失敗，請檢查您的網絡連接並重試';
            
            // 添加重試按鈕 (非同步)
            setTimeout(() => {
                const errorElement = document.querySelector('.login-error-alert');
                if (errorElement) {
                    // 添加文字說明
                    const noteElement = document.createElement('p');
                    noteElement.style.fontSize = '0.9em';
                    noteElement.style.marginTop = '5px';
                    noteElement.textContent = '這可能是由於安全驗證 (App Check) 問題導致，您可以嘗試重新驗證';
                    errorElement.appendChild(noteElement);
                    
                    // 添加重試按鈕
                    const retryBtn = document.createElement('button');
                    retryBtn.className = 'btn-primary';
                    retryBtn.style.marginTop = '10px';
                    retryBtn.style.padding = '5px 10px';
                    retryBtn.textContent = '重試安全驗證';
                    
                    retryBtn.onclick = async function() {
                        this.disabled = true;
                        this.textContent = '驗證中...';
                        
                        try {
                            // 重新嘗試 App Check 驗證
                            const result = await checkAppCheckStatus();
                            if (result.success) {
                                noteElement.textContent = '安全驗證成功，請再次嘗試登入';
                                this.textContent = '驗證成功 ✓';
                                this.style.backgroundColor = '#4CAF50';
                            } else {
                                noteElement.textContent = '安全驗證仍然失敗，請嘗試刷新頁面';
                                this.textContent = '驗證失敗，請重試';
                                this.disabled = false;
                            }
                        } catch (e) {
                            noteElement.textContent = '安全驗證過程發生錯誤';
                            this.textContent = '驗證失敗，請重試';
                            this.disabled = false;
                        }
                    };
                    
                    errorElement.appendChild(retryBtn);
                }
            }, 100);
            
            return message;
        default:
            return `登入失敗: ${error.message}`;
    }
}

// 1. 載入店家審核請求 - 確保正確顯示店家列表
async function loadBusinessApprovalRequests() {
    const container = document.getElementById('business-approval-container');
    const loadingElement = document.getElementById('business-approval-loading');
    
    if (!container || !loadingElement) {
        console.error('店家審核容器元素未找到');
        return;
    }

    // 這確保每次載入店家審核請求時，都會更新郵件匯出按鈕狀態
    updateExportButtonStatus();
    
    // 重要: 確保完全清空容器
    container.innerHTML = '';
    loadingElement.style.display = 'flex';
    
    updateExportButtonStatus();
    try {
        console.log("開始載入店家審核請求列表...");
        // 獲取所有待處理審核請求
        const businessApprovalRef = collection(db, 'businessApprovalRequests');
        const approvalQuery = query(
            businessApprovalRef,
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(approvalQuery);
        
        loadingElement.style.display = 'none';
        
        if (querySnapshot.empty) {
            container.innerHTML = '<div style="text-align: center; padding: 30px;">沒有待處理的店家審核請求</div>';
            return;
        }
        
        console.log(`發現 ${querySnapshot.size} 個待處理店家審核請求`);

        // 使用 Map 基於店家名稱進行去重
        const uniqueBusinessRequests = new Map();
        
        // 安全的日期轉換函數
        function getDateTimestamp(dateField) {
            try {
                if (!dateField) return 0;
                if (typeof dateField.toDate === 'function') {
                    return dateField.toDate().getTime();
                }
                return new Date(dateField).getTime();
            } catch (error) {
                console.error('日期轉換錯誤:', error);
                return 0;
            }
        }
        
        // 遍歷收集所有請求，按店家名稱進行去重
        querySnapshot.forEach(doc => {
            const data = doc.data();
            // 使用店家名稱作為主要去重依據
            const businessName = data.businessName || '未知店家-' + doc.id;
            
            // 如果這個店家名稱還沒有記錄，或者當前記錄比已存在的更新
            const newDateTimestamp = getDateTimestamp(data.createdAt);
            const existingData = uniqueBusinessRequests.get(businessName);
            
            if (!existingData || newDateTimestamp > getDateTimestamp(existingData.createdAt)) {
                // 保存文檔數據和ID
                data.docId = doc.id;
                uniqueBusinessRequests.set(businessName, data);
            }
        });
        
        console.log(`去重後剩餘 ${uniqueBusinessRequests.size} 個店家審核請求`);
        
        // 重要: 防止重複渲染，創建一個已渲染ID集合
        const renderedIds = new Set();
        
        // 僅使用去重後的 Map 進行渲染
        uniqueBusinessRequests.forEach((data) => {
            // 檢查重複渲染
            if (renderedIds.has(data.docId)) {
                console.warn(`跳過重複渲染的卡片: ${data.businessName}, ID: ${data.docId}`);
                return;
            }
            
            const requestCard = document.createElement('div');
            requestCard.className = 'report-card pending';
            requestCard.dataset.id = data.docId; // 添加數據屬性以便調試
            
            // 格式化日期
            const createdAt = data.createdAt ? new Date(data.createdAt.toDate()) : new Date();
            const formattedDate = formatDate(createdAt);
            
            // 判斷是否為重新申請
            const reapplyBadge = data.isReapply ? 
                '<span class="status-badge badge-warning" style="margin-left: 5px;">重新申請</span>' : '';
            
            requestCard.innerHTML = `
                <h3>
                    <span class="status-badge badge-pending">待審核</span>
                    <span style="margin-left: 5px;">${data.businessName || '未知店家'}</span>
                    ${reapplyBadge}
                </h3>
                <p><strong>店家類型:</strong> ${getBusinessTypeText(data.businessType)}</p>
                <p><strong>提交時間:</strong> ${formattedDate}</p>
                <p><strong>聯絡人:</strong> ${data.contactName || '未知'}</p>
            `;
            
            // 添加點擊事件 - 使用保存的文檔ID
            requestCard.addEventListener('click', () => {
                console.log(`點擊店家卡片 - ID: ${data.docId}, 店家名稱: ${data.businessName || '未知'}`);
                showBusinessApprovalDetail(data.docId);
            });
            
            container.appendChild(requestCard);
            
            // 記錄已渲染ID
            renderedIds.add(data.docId);
            
            // 調試日誌
            console.log(`已渲染店家卡片: ${data.businessName}, ID: ${data.docId}`);
        });
        
    } catch (error) {
        console.error('加載店家審核請求錯誤:', error);
        loadingElement.style.display = 'none';
        container.innerHTML = `<div style="text-align: center; padding: 30px;">加載審核請求時發生錯誤: ${error.message}</div>`;
    }
}
    
// 2. 顯示店家審核詳情 - 修復顯示詳情頁面問題
async function showBusinessApprovalDetail(requestId) {
    try {
        console.log(`開始顯示店家審核詳情，請求ID: ${requestId}`);
        
        // 隱藏主內容
        mainContent.style.display = 'none';
        
        // 使用準確的類名選擇器，避免ID衝突
        const detailContainer = document.querySelector('.business-verification-detail');
        if (!detailContainer) {
            console.error('找不到店家審核詳情容器');
            alert('頁面元素錯誤，請聯絡管理員');
            backToBusinessApprovalList();
            return;
        }
        
        detailContainer.style.display = 'block';
        
        // 設置請求ID到隱藏字段
        const requestIdField = document.getElementById('business-approval-requestid');
        if (!requestIdField) {
            console.error('找不到business-approval-requestid元素');
            alert('頁面元素錯誤，請聯絡管理員');
            backToBusinessApprovalList();
            return;
        }
        
        requestIdField.value = requestId;
        
        try {
            // 獲取審核請求數據
            console.log(`開始從Firebase獲取審核請求數據...`);
            // 新 V9 寫法
            const requestDocRef = doc(db, 'businessApprovalRequests', requestId);
            const requestDoc = await getDoc(requestDocRef);
            
            if (!requestDoc.exists) {
                console.error('找不到審核請求數據');
                alert('找不到審核請求');
                backToBusinessApprovalList();
                return;
            }
            
            const requestData = requestDoc.data();
            console.log(`成功獲取審核請求數據:`, requestData);
            
            // 填充詳情頁數據
            document.getElementById('business-name').textContent = requestData.businessName || '未知店家';
            document.getElementById('business-userid').textContent = requestData.userId || '未知';
            document.getElementById('business-type').textContent = getBusinessTypeText(requestData.businessType);
            document.getElementById('business-time').textContent = formatDate(
                requestData.createdAt ? new Date(requestData.createdAt.toDate()) : new Date()
            );
            document.getElementById('business-address').textContent = requestData.address || '未知';
            document.getElementById('business-phone').textContent = requestData.phoneNumber || '未知';
            document.getElementById('business-contact-name').textContent = requestData.contactName || '未知';
            document.getElementById('business-contact-phone').textContent = requestData.contactPhone || '未知';
            
            // 處理證照照片
            const licensesContainer = document.getElementById('business-licenses');
            if (!licensesContainer) {
                console.error('找不到business-licenses容器');
                return;
            }
            
            licensesContainer.innerHTML = ''; // 清空容器
            
            const licenseUrls = requestData.licenseUrls || [];
            console.log(`證照照片數量: ${licenseUrls.length}`);
            
            if (licenseUrls.length === 0) {
                licensesContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">沒有上傳證明文件</p>';
            } else {
                // 對每個文件URL進行處理
                for (let index = 0; index < licenseUrls.length; index++) {
                    const url = licenseUrls[index];
                    
                    try {
                        // 創建照片項目元素
                        const photoItem = document.createElement('div');
                        photoItem.className = 'photo-item';
                        
                        // 判斷檔案類型
                        const isImage = url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i);
                        const isPdf = url.toLowerCase().endsWith('.pdf');
                        
                        if (isImage) {
                            // 圖片預覽 - 添加更好的錯誤處理
                            photoItem.innerHTML = `
                                <img src="${url}" alt="證明文件 ${index + 1}" 
                                    onerror="this.src='https://placehold.co/300x300?text=載入失敗'; this.onerror=null;"
                                    loading="lazy" style="object-fit: contain;">
                                <span class="index">#${index + 1}</span>
                            `;
                            
                            // 預加載圖片並檢查是否能正確載入
                            const preloadImg = new Image();
                            preloadImg.onload = function() {
                                console.log(`圖片 #${index + 1} 預加載成功`);
                            };
                            preloadImg.onerror = function() {
                                console.error(`圖片 #${index + 1} 載入失敗，URL: ${url}`);
                                // 如果是Firebase Storage URL，嘗試使用其他方法獲取
                                if (url.includes('firebasestorage.googleapis.com')) {
                                    console.log(`嘗試使用Firebase Storage直接獲取圖片 #${index + 1}`);
                                    // 這裡可以添加額外的Firebase Storage處理邏輯
                                }
                            };
                            preloadImg.src = url;
                        } else if (isPdf) {
                            // PDF 預覽
                            photoItem.innerHTML = `
                                <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: #f8f9fa;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                        <path d="M9 15h6"></path>
                                        <path d="M9 18h6"></path>
                                        <path d="M9 12h2"></path>
                                    </svg>
                                    <span style="margin-top: 10px;">PDF 文件</span>
                                </div>
                                <span class="index">#${index + 1}</span>
                            `;
                        } else {
                            // 嘗試檢測是否為圖片格式（沒有明確副檔名的情況）
                            const testImage = new Image();
                            testImage.onload = function() {
                                // 如果成功載入，則確實是圖片
                                photoItem.innerHTML = `
                                    <img src="${url}" alt="證明文件 ${index + 1}" 
                                        onerror="this.src='https://placehold.co/300x300?text=載入失敗'; this.onerror=null;"
                                        loading="lazy" style="object-fit: contain;">
                                    <span class="index">#${index + 1}</span>
                                `;
                            };
                            testImage.onerror = function() {
                                // 不是圖片，顯示為一般檔案
                                photoItem.innerHTML = `
                                    <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: #f8f9fa;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#007bff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                            <polyline points="13 2 13 9 20 9"></polyline>
                                        </svg>
                                        <span style="margin-top: 10px;">未知檔案</span>
                                    </div>
                                    <span class="index">#${index + 1}</span>
                                `;
                            };
                            // 先顯示一個通用的文件圖標
                            photoItem.innerHTML = `
                                <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: #f8f9fa;">
                                    <div class="loading-spinner"></div>
                                    <span style="margin-top: 10px;">檢測文件類型...</span>
                                </div>
                                <span class="index">#${index + 1}</span>
                            `;
                            testImage.src = url;
                        }
                        
                        // 點擊放大查看
                        photoItem.addEventListener('click', () => {
                            if (isImage) {
                                // 圖片用燈箱查看
                                document.getElementById('lightboxImage').src = url;
                                document.getElementById('lightboxImage').onerror = function() {
                                    this.src = 'https://placehold.co/800x600?text=載入失敗';
                                    this.onerror = null;
                                };
                                document.getElementById('imageLightbox').style.display = 'flex';
                            } else if (isPdf) {
                                // PDF 在新窗口打開
                                window.open(url, '_blank');
                            } else {
                                // 其他檔案下載
                                window.open(url, '_blank');
                            }
                        });
                        
                        licensesContainer.appendChild(photoItem);
                    } catch (imageError) {
                        console.error(`處理圖片 #${index + 1} 時發生錯誤:`, imageError);
                        // 如果處理特定圖片時出錯，繼續處理其他圖片
                        continue;
                    }
                }
            }
            
            // 確保事件處理綁定只執行一次
            const backBtn = document.getElementById('business-approval-back');
            const approveBtn = document.getElementById('business-approve');
            const rejectBtn = document.getElementById('business-reject');
            
            // 先移除舊的事件處理程序（如果有的話）
            if (backBtn) {
                const newBackBtn = backBtn.cloneNode(true);
                backBtn.parentNode.replaceChild(newBackBtn, backBtn);
                newBackBtn.addEventListener('click', backToBusinessApprovalList);
            }
            
            if (approveBtn) {
                const newApproveBtn = approveBtn.cloneNode(true);
                approveBtn.parentNode.replaceChild(newApproveBtn, approveBtn);
                newApproveBtn.addEventListener('click', approveBusinessRequest);
            }
            
            if (rejectBtn) {
                const newRejectBtn = rejectBtn.cloneNode(true);
                rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);
                newRejectBtn.addEventListener('click', rejectBusinessRequest);
            }
            
            console.log("店家審核詳情載入完成:", requestId);
            
        } catch (error) {
            console.error('顯示店家審核詳情錯誤:', error);
            alert(`載入審核詳情時發生錯誤: ${error.message}`);
            backToBusinessApprovalList();
        }
    } catch (error) {
        console.error('顯示店家審核詳情頁面錯誤:', error);
        alert('頁面載入錯誤，請重試');
        mainContent.style.display = 'block';
    }
}

// 增強版的處理Firebase Storage URL函數
function getOptimizedImageUrl(url) {
    // 如果是Firebase Storage URL，嘗試優化URL
    if (url && url.includes('firebasestorage.googleapis.com')) {
        // 移除多餘的查詢參數，這些可能導致跨域問題
        const cleanUrl = url.split('?')[0];
        return cleanUrl;
    }
    return url;
}

// 用於處理圖片載入錯誤的通用函數
function handleImageLoadError(img, fallbackText) {
    img.onerror = function() {
        // 創建一個替代的內容顯示
        const container = img.parentElement;
        const placeholder = document.createElement('div');
        placeholder.style.width = '100%';
        placeholder.style.height = '100%';
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.backgroundColor = '#f8f9fa';
        placeholder.style.color = '#999';
        placeholder.textContent = fallbackText || '圖片無法載入';
        
        // 替換圖片元素
        container.replaceChild(placeholder, img);
    };
}
    
// 3. 返回店家審核列表
function backToBusinessApprovalList() {
    console.log('返回店家審核列表');
    
    // 使用類名選擇器，避免ID衝突
    const detailContainer = document.querySelector('.business-verification-detail');
    if (detailContainer) {
        detailContainer.style.display = 'none';
    }
    
    mainContent.style.display = 'block';
    
    // 清空拒絕原因
    if (document.getElementById('reject-reason')) {
        document.getElementById('reject-reason').value = '';
    }
    
    // 重新啟用按鈕（以防之前被禁用）
    const approveBtn = document.getElementById('business-approve');
    const rejectBtn = document.getElementById('business-reject');
    
    if (approveBtn) {
        approveBtn.disabled = false;
        approveBtn.textContent = '核准店家';
    }
    
    if (rejectBtn) {
        rejectBtn.disabled = false;
        rejectBtn.textContent = '拒絕審核';
    }
}


// 4. 核准店家審核
async function approveBusinessRequest() {
    const requestId = document.getElementById('business-approval-requestid').value;
    
    if (!requestId) {
        alert('無效的請求ID');
        return;
    }
    
    try {
        console.log(`開始核准店家審核，請求ID: ${requestId}`);
        
        const approveBtn = document.getElementById('business-approve');
        approveBtn.disabled = true;
        approveBtn.innerHTML = '<div class="loading-spinner"></div> 處理中...';
        
        // 獲取審核請求數據
        // 新 V9 寫法
        const requestDocRef = doc(db, 'businessApprovalRequests', requestId);
        const requestDoc = await getDoc(requestDocRef);
        if (!requestDoc.exists) {
            throw new Error('找不到審核請求');
        }
        
        const requestData = requestDoc.data();
        const userId = requestData.userId;
        
        console.log(`核准用戶ID: ${userId} 的店家申請`);
        
        // 1. 更新店家狀態為已核准
        const businessDocRef = doc(db, 'businesses', userId);
        await setDoc(businessDocRef, {
            status: 'approved',
            approvedAt: serverTimestamp(),
            approvedBy: auth.currentUser ? auth.currentUser.uid : 'admin',
            businessName: requestData.businessName,
            businessType: requestData.businessType,
            address: requestData.address,
            phoneNumber: requestData.phoneNumber,
            contactName: requestData.contactName,
            contactPhone: requestData.contactPhone,
            licenseUrls: requestData.licenseUrls || [],
            createdAt: requestData.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        // // 2. 更新用戶資料
        // await db.collection('用戶資料').doc(userId).update({
        //     isBusiness: true,
        //     businessVerified: true,
        //     updatedAt: serverTimestamp()
        // });
        
        // 3. 發送通知
        const notificationsRef = collection(db, 'notifications');
        await addDoc(notificationsRef, {
            userId: userId,
            type: 'business_approval',
            message: '恭喜！您的店家帳號已通過審核，現在可以使用全部功能。',
            isRead: false,
            createdAt: serverTimestamp()
        });
        
        // 4. 刪除審核請求 (確保這一步不會失敗)
        await deleteDoc(doc(db, 'businessApprovalRequests', requestId));

        // 存儲郵件信息到localStorage
        const emailData = {
            timestamp: new Date().toISOString(),
            businessId: userId,
            businessName: requestData.businessName || '未命名店家',
            contactEmail: requestData.contactEmail || requestData.email || '',
            contactName: requestData.contactName || '',
            contactPhone: requestData.contactPhone || requestData.phoneNumber || '',
            status: 'approved',
            rejectReason: '',
            processed: false
        };

        // 獲取現有待發送郵件列表
        let pendingEmails = JSON.parse(localStorage.getItem('pendingBusinessEmails') || '[]');
        pendingEmails.push(emailData);
        localStorage.setItem('pendingBusinessEmails', JSON.stringify(pendingEmails));

        // 更新導出按鈕狀態
        updateExportButtonStatus();
        
        alert('已核准店家帳號');
        backToBusinessApprovalList();
        
        // 重新加載審核列表
        loadBusinessApprovalRequests();
        
    } catch (error) {
        console.error('核准店家審核錯誤:', error);
        alert(`核准店家時發生錯誤: ${error.message}`);
        
        const approveBtn = document.getElementById('business-approve');
        approveBtn.disabled = false;
        approveBtn.textContent = '核准店家';
    }
}


// 5. 拒絕店家審核
async function rejectBusinessRequest() {
    const requestId = document.getElementById('business-approval-requestid').value;
    const rejectReason = document.getElementById('reject-reason').value.trim();
    
    if (!requestId) {
        alert('無效的請求ID');
        return;
    }
    
    if (!rejectReason) {
        alert('請填寫拒絕原因');
        return;
    }
    
    try {
        console.log(`開始拒絕店家審核，請求ID: ${requestId}`);
        
        const rejectBtn = document.getElementById('business-reject');
        rejectBtn.disabled = true;
        rejectBtn.innerHTML = '<div class="loading-spinner"></div> 處理中...';
        
        // 獲取審核請求數據
        // 新 V9 寫法
        const requestDocRef = doc(db, 'businessApprovalRequests', requestId);
        const requestDoc = await getDoc(requestDocRef);
        if (!requestDoc.exists) {
            throw new Error('找不到審核請求');
        }
        
        const requestData = requestDoc.data();
        const userId = requestData.userId;
        
        console.log(`拒絕用戶ID: ${userId} 的店家申請`);
        
        // 1. 更新店家狀態為已拒絕
        const businessDocRef = doc(db, 'businesses', userId);
        await setDoc(businessDocRef, {
            status: 'rejected',
            rejectReason: rejectReason,
            rejectedAt: serverTimestamp(),
            rejectedBy: auth.currentUser ? auth.currentUser.uid : 'admin',
            businessName: requestData.businessName,
            businessType: requestData.businessType,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        // // 2. 更新用戶資料
        // await db.collection('用戶資料').doc(userId).update({
        //     businessVerified: false,
        //     updatedAt: serverTimestamp()
        // });
        
        // 3. 發送通知
        const notificationsRef = collection(db, 'notifications');
        await addDoc(notificationsRef, {
            userId: userId,
            type: 'business_rejection',
            message: `很抱歉，您的店家帳號申請未通過審核。原因: ${rejectReason}`,
            data: {
                rejectReason: rejectReason
            },
            isRead: false,
            createdAt: serverTimestamp()
        });
        
        // 4. 刪除審核請求 (確保這一步不會失敗)
        await deleteDoc(doc(db, 'businessApprovalRequests', requestId));

        // 存儲郵件信息到localStorage
        const emailData = {
            timestamp: new Date().toISOString(),
            businessId: userId,
            businessName: requestData.businessName || '未命名店家',
            contactEmail: requestData.contactEmail || requestData.email || '',
            contactName: requestData.contactName || '',
            contactPhone: requestData.contactPhone || requestData.phoneNumber || '',
            status: 'rejected',
            rejectReason: rejectReason,
            processed: false
        };

        // 獲取現有待發送郵件列表
        let pendingEmails = JSON.parse(localStorage.getItem('pendingBusinessEmails') || '[]');
        pendingEmails.push(emailData);
        localStorage.setItem('pendingBusinessEmails', JSON.stringify(pendingEmails));

        // 更新導出按鈕狀態
        updateExportButtonStatus();
        
        alert('已拒絕店家審核申請');
        backToBusinessApprovalList();
        
        // 重新加載審核列表
        loadBusinessApprovalRequests();
        
    } catch (error) {
        console.error('拒絕店家審核錯誤:', error);
        alert(`拒絕店家時發生錯誤: ${error.message}`);
        
        const rejectBtn = document.getElementById('business-reject');
        rejectBtn.disabled = false;
        rejectBtn.textContent = '拒絕審核';
    }
}

// 更新導出按鈕狀態
function updateExportButtonStatus() {
    const pendingEmails = JSON.parse(localStorage.getItem('pendingBusinessEmails') || '[]');
    const emailSection = document.getElementById('email-export-section');
    
    if (!emailSection) {
        // 如果元素不存在，創建一個
        createEmailExportSection();
        return;
    }
    
    const countElement = document.getElementById('pending-email-count');
    
    if (pendingEmails.length > 0) {
        emailSection.style.display = 'block';
        if (countElement) {
            countElement.textContent = `目前有 ${pendingEmails.length} 封待發送郵件`;
        }
    } else {
        if (countElement) {
            countElement.textContent = `目前有 0 封待發送郵件`;
        }
    }
    
    console.log(`郵件導出區段狀態已更新，共有 ${pendingEmails.length} 封待發送郵件`);
}


// 創建郵件導出區塊
function createEmailExportSection() {
    // 確保不重複創建
    if (document.getElementById('email-export-section')) {
        return;
    }
    
    // 找到合適的容器 - 修改為直接使用 business-approval-tab
    const container = document.getElementById('businessApproval-tab') || document.querySelector('.main-content');
    if (!container) {
        console.error('無法找到適合的容器來放置郵件導出區段');
        return;
    }
    
    const emailSection = document.createElement('div');
    emailSection.id = 'email-export-section';
    emailSection.className = 'admin-section email-export-container card';
    emailSection.style.margin = '20px 0';
    
    // 默認顯示，稍後在 updateExportButtonStatus 中根據是否有待發送郵件來決定是否隱藏
    emailSection.style.display = 'block';
    
    // 郵件導出區塊內容
    emailSection.innerHTML = `
        <div class="card-header bg-light">
            <h5 class="mb-0"><i class="fas fa-envelope me-2"></i>待發送店家郵件</h5>
        </div>
        <div class="card-body">
            <p id="pending-email-count" class="mb-3">目前有 0 封待發送郵件</p>
            <div class="d-flex gap-2">
                <button id="export-pending-emails" class="btn-primary">
                    <i class="fas fa-file-export me-1"></i> 導出待發送郵件
                </button>
                <button id="clear-pending-emails" class="btn-danger">
                    <i class="fas fa-trash me-1"></i> 清除所有待發送郵件
                </button>
            </div>
        </div>
    `;
    
    // 將區段插入到 businessApproval-tab 的開頭
    const firstChild = container.firstChild;
    if (firstChild) {
        container.insertBefore(emailSection, firstChild);
    } else {
        container.appendChild(emailSection);
    }
    
    // 綁定按鈕事件
    const exportBtn = document.getElementById('export-pending-emails');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportPendingEmailsToExcel);
    }
    
    const clearBtn = document.getElementById('clear-pending-emails');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearPendingEmails);
    }
    
    console.log('郵件導出區段已創建');
    
    // 立即更新狀態
    updateExportButtonStatus();
}

// 導出Excel函數
function exportPendingEmailsToExcel() {
    const pendingEmails = JSON.parse(localStorage.getItem('pendingBusinessEmails') || '[]');
    
    if (pendingEmails.length === 0) {
        alert('沒有待處理的郵件');
        return;
    }
    
    try {
        // 准備數據（格式化日期等）
        const formattedData = pendingEmails.map(email => {
            // 將狀態轉換為中文
            let statusText = '未知';
            switch(email.status) {
                case 'approved':
                    statusText = '已核准';
                    break;
                case 'rejected':
                    statusText = '已拒絕';
                    break;
                case 'pending':
                    statusText = '待審核';
                    break;
            }
            
            return {
                '時間戳記': formatDateTime(email.timestamp),
                '商家ID': email.businessId,
                '商家名稱': email.businessName,
                '聯絡人': email.contactName || '',
                '聯絡信箱': email.contactEmail,
                '聯絡電話': email.contactPhone || '',
                '審核狀態': statusText,
                '拒絕原因': email.rejectReason || '',
                '處理狀態': '未處理'
            };
        });
        
        // 確認SheetJS庫是否可用
        if (typeof XLSX === 'undefined') {
            // 如果沒有加載SheetJS庫，動態加載
            loadSheetJSLibrary().then(() => {
                // 庫加載完成後繼續處理
                createAndDownloadExcel(formattedData);
            });
        } else {
            // SheetJS庫已經加載，直接創建Excel
            createAndDownloadExcel(formattedData);
        }
    } catch (error) {
        console.error('導出Excel時發生錯誤:', error);
        alert('導出Excel失敗: ' + error.message);
    }
}

// 動態加載SheetJS庫
function loadSheetJSLibrary() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('無法加載SheetJS庫'));
        document.head.appendChild(script);
    });
}

// 創建並下載Excel文件
function createAndDownloadExcel(formattedData) {
    // 使用SheetJS創建工作表
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "待發送郵件");
    
    // 調整列寬
    const colWidths = [
        { wch: 20 }, // 時間戳記
        { wch: 20 }, // 商家ID
        { wch: 20 }, // 商家名稱
        { wch: 15 }, // 聯絡人
        { wch: 25 }, // 聯絡信箱
        { wch: 15 }, // 聯絡電話
        { wch: 10 }, // 審核狀態
        { wch: 30 }, // 拒絕原因
        { wch: 10 }  // 處理狀態
    ];
    worksheet['!cols'] = colWidths;
    
    // 導出Excel文件
    const fileName = `商家審核郵件_${formatDateForFilename(new Date())}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    // 顯示成功訊息
    alert(`Excel文件已導出: ${fileName}\n\n請使用Python腳本處理此文件來發送郵件。`);
}

// 清除所有待發送郵件
function clearPendingEmails() {
    if (confirm('確定要清除所有待發送郵件嗎？此操作無法撤銷。')) {
        localStorage.removeItem('pendingBusinessEmails');
        updateExportButtonStatus();
        alert('所有待發送郵件已清除');
    }
}

// 輔助函數：格式化日期時間
function formatDateTime(timestamp) {
    if (!timestamp) return '';
    
    try {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
        console.error('日期格式化錯誤:', e);
        return timestamp;
    }
}

// 輔助函數：格式化文件名日期
function formatDateForFilename(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// 增強的燈箱功能，支持更好的圖片預覽

// // 當DOM加載完成後設置燈箱功能
// document.addEventListener('DOMContentLoaded', function() {
//     setupEnhancedLightbox();
// });

// 設置增強的燈箱功能
function setupEnhancedLightbox() {
    const lightbox = document.getElementById('imageLightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const closeButton = lightbox.querySelector('.close');
    
    // 確保燈箱元素存在
    if (!lightbox || !lightboxImage || !closeButton) {
        console.error('燈箱元素未找到');
        return;
    }
    
    // 關閉燈箱的函數
    function closeLightbox() {
        lightbox.classList.remove('active');
        setTimeout(() => {
            lightbox.style.display = 'none';
        }, 300); // 等待過渡效果完成
    }
    
    // 綁定關閉按鈕事件
    closeButton.addEventListener('click', closeLightbox);
    
    // 按ESC鍵關閉燈箱
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });
    
    // 點擊燈箱背景關閉
    lightbox.addEventListener('click', function(e) {
        // 只有當點擊的是燈箱本身而不是其中的圖片時才關閉
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    
    // 為lightboxImage添加載入事件
    lightboxImage.addEventListener('load', function() {
        console.log('燈箱圖片載入成功');
    });
    
    // 為lightboxImage添加錯誤處理
    lightboxImage.addEventListener('error', function() {
        this.src = 'https://placehold.co/800x600?text=圖片載入失敗';
        console.error('燈箱圖片載入失敗');
    });
    
    // 修改原有的燈箱打開方法
    window.openLightbox = function(imageUrl) {
        if (!imageUrl) {
            console.error('嘗試打開燈箱但沒有提供圖片URL');
            return;
        }
        
        // 設置載入中的狀態
        lightboxImage.src = 'https://placehold.co/50x50?text=載入中';
        
        // 顯示燈箱
        lightbox.style.display = 'flex';
        
        // 使用setTimeout確保過渡效果生效
        setTimeout(() => {
            lightbox.classList.add('active');
        }, 10);
        
        // 載入實際圖片
        lightboxImage.src = imageUrl;
    };
}

// 增強的照片處理函數 - 用於店家審核詳情頁面
function setupBusinessPhotosView(containerId, photoUrls) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`找不到容器: #${containerId}`);
        return;
    }
    
    container.innerHTML = ''; // 清空容器
    
    if (!photoUrls || photoUrls.length === 0) {
        container.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">沒有上傳證明文件</p>';
        return;
    }
    
    photoUrls.forEach((url, index) => {
        const photoItem = createPhotoItem(url, index);
        container.appendChild(photoItem);
    });
}

// 創建照片項目元素
function createPhotoItem(url, index) {
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    
    // 顯示載入中的狀態
    photoItem.innerHTML = `
        <div class="image-loading">
            <div class="loading-spinner"></div>
        </div>
        <span class="index">#${index + 1}</span>
    `;
    
    // 判斷檔案類型
    const fileExtension = url.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExtension);
    const isPdf = fileExtension === 'pdf';
    
    if (isImage) {
        // 圖片預覽
        const img = document.createElement('img');
        img.alt = `證明文件 ${index + 1}`;
        img.loading = 'lazy';
        
        // 圖片載入成功
        img.onload = function() {
            // 移除載入指示器
            const loadingElement = photoItem.querySelector('.image-loading');
            if (loadingElement) {
                photoItem.removeChild(loadingElement);
            }
            
            // 添加文件類型標籤
            const fileTypeTag = document.createElement('span');
            fileTypeTag.className = 'file-type';
            fileTypeTag.textContent = fileExtension.toUpperCase();
            photoItem.appendChild(fileTypeTag);
        };
        
        // 圖片載入失敗
        img.onerror = function() {
            // 替換為錯誤顯示
            photoItem.innerHTML = `
                <div class="error-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <p>圖片無法載入</p>
                </div>
                <span class="index">#${index + 1}</span>
            `;
        };
        
        // 設置圖片來源
        img.src = url;
        photoItem.appendChild(img);
        
        // 點擊放大查看
        photoItem.addEventListener('click', () => {
            window.openLightbox(url);
        });
    } else if (isPdf) {
        // PDF 預覽
        photoItem.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: #f8f9fa;">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <path d="M9 15h6"></path>
                    <path d="M9 18h6"></path>
                    <path d="M9 12h2"></path>
                </svg>
                <span style="margin-top: 10px;">PDF 文件</span>
            </div>
            <span class="index">#${index + 1}</span>
            <span class="file-type">PDF</span>
        `;
        
        // 點擊在新窗口打開
        photoItem.addEventListener('click', () => {
            window.open(url, '_blank');
        });
    } else {
        // 未知文件類型 - 嘗試判斷是否為圖片
        const testImage = new Image();
        
        testImage.onload = function() {
            // 是圖片，更新為圖片顯示
            photoItem.innerHTML = `
                <img src="${url}" alt="證明文件 ${index + 1}" 
                    onerror="this.onerror=null; this.src='https://placehold.co/300x300?text=載入失敗';"
                    loading="lazy">
                <span class="index">#${index + 1}</span>
                <span class="file-type">圖片</span>
            `;
            
            // 點擊放大查看
            photoItem.addEventListener('click', () => {
                window.openLightbox(url);
            });
        };
        
        testImage.onerror = function() {
            // 不是圖片，顯示通用文件圖標
            photoItem.innerHTML = `
                <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: #f8f9fa;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#007bff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                        <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                    <span style="margin-top: 10px;">未知檔案</span>
                </div>
                <span class="index">#${index + 1}</span>
                <span class="file-type">檔案</span>
            `;
            
            // 點擊下載文件
            photoItem.addEventListener('click', () => {
                window.open(url, '_blank');
            });
        };
        
        // 開始檢測
        testImage.src = url;
    }
    
    return photoItem;
}
    
// 獲取店家類型文字描述
function getBusinessTypeText(type) {
    switch (type) {
        case 'cafe': return '咖啡廳';
        case 'restaurant': return '餐廳';
        case 'bar': return '酒吧';
        case 'dessert': return '甜點店';
        case 'tea': return '茶飲店';
        case 'other': return '其他';
        default: return type || '未知';
    }
}

// 加載檢舉列表
async function loadReports() {
    try {
        // 獲取 reports 容器元素
        const reportsContainer = document.getElementById('reports-container');
        if (!reportsContainer) {
            console.error('無法找到 reports-container 元素');
            return;
        }
        
        // 顯示載入中
        reportsContainer.innerHTML = '';
        document.getElementById('reports-loading').style.display = 'flex';
        
        console.log("開始載入報告數據...");
        
        // 獲取過濾條件
        const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;
        const sortBy = document.getElementById('sortBy').value;
        
        // 構建查詢 - 適配 Firebase v9 API
        // 使用 collection 函數而不是 db.collection
        let reportsRef = collection(db, 'reports');
        
        // 嘗試先獲取文檔計數，測試權限
        try {
            // 使用 v9 API 獲取數據
            const testQuery = query(reportsRef, limit(1));
            const testSnapshot = await getDocs(testQuery);
            console.log("成功獲取報告測試數據");
        } catch (permError) {
            console.error("報告集合權限測試失敗:", permError);
            // 顯示權限錯誤但不登出用戶
            document.getElementById('reports-loading').style.display = 'none';
            reportsContainer.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px;">
                    <h3>權限錯誤</h3>
                    <p>您沒有權限查看報告數據。請確保您有適當的權限或聯繫管理員。</p>
                    <p>技術錯誤: ${permError.message}</p>
                </div>`;
            return;
        }
        
        // 構建查詢條件 - 根據 Firebase v9 方式組合
        let constraints = [];
        
        // 應用狀態過濾
        if (statusFilter !== 'all') {
            constraints.push(where('status', '==', statusFilter));
        }
        
        // 應用類型過濾
        if (typeFilter !== 'all') {
            constraints.push(where('reasons', 'array-contains', typeFilter));
        }
        
        // 應用排序
        switch (sortBy) {
            case 'newest':
                constraints.push(orderBy('createdAt', 'desc'));
                break;
            case 'oldest':
                constraints.push(orderBy('createdAt', 'asc'));
                break;
            case 'severity':
                // 假設有嚴重度字段
                constraints.push(orderBy('severity', 'desc'));
                break;
            case 'reporterCredit':
                // 這個可能需要多段處理，先獲取所有數據
                break;
        }
        
        // 創建查詢 - 使用 v9 API
        let reportsQuery;
        if (constraints.length > 0) {
            reportsQuery = query(reportsRef, ...constraints);
        } else {
            reportsQuery = reportsRef;
        }
        
        // 獲取數據
        const querySnapshot = await getDocs(reportsQuery);
        
        // 計算總數
        totalReports = querySnapshot.size;
        
        // 計算分頁
        const totalPages = Math.ceil(totalReports / reportsPerPage);
        updatePagination(totalPages);
        
        // 將查詢結果轉換為數組
        const reports = [];
        querySnapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            reports.push(data);
        });
        
        // 搜尋過濾 (Firestore 不支持文本搜索，所以在客戶端過濾)
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
        
        // 如果是按檢舉人信用排序，需要額外處理
        if (sortBy === 'reporterCredit') {
            // 獲取所有檢舉人的信用分數
            const reporterIds = [...new Set(filteredReports.map(report => report.reporterId))];
            
            // 修改為 v9 API 風格獲取信用分數
            const credibilityDocs = await Promise.all(
                reporterIds.map(async (id) => {
                    const docRef = doc(db, 'userReportCredibility', id);
                    return await getDoc(docRef);
                })
            );
            
            const creditScores = {};
            
            credibilityDocs.forEach(doc => {
                if (doc.exists()) {
                    creditScores[doc.id] = doc.data().score || 100;
                } else {
                    creditScores[doc.id] = 100; // 預設分數
                }
            });
            
            // 根據檢舉人信用分數排序
            filteredReports.sort((a, b) => {
                const scoreA = creditScores[a.reporterId] || 100;
                const scoreB = creditScores[b.reporterId] || 100;
                return scoreA - scoreB; // 從低到高排序
            });
        }
        
        // 應用分頁
        const start = (currentPage - 1) * reportsPerPage;
        const paginatedReports = filteredReports.slice(start, start + reportsPerPage);
        
        // 隱藏載入中
        document.getElementById('reports-loading').style.display = 'none';
        
        // 檢查是否有結果
        if (paginatedReports.length === 0) {
            reportsContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px;">沒有符合條件的檢舉記錄</div>';
            return;
        }
        
        // 渲染檢舉卡片
        paginatedReports.forEach(report => {
            const card = createReportCard(report);
            reportsContainer.appendChild(card);
        });
        
    } catch (error) {
        console.error('加載檢舉列表錯誤:', error);
        
        // 確保 reports-container 定義
        const reportsContainer = document.getElementById('reports-container');
        if (reportsContainer) {
            document.getElementById('reports-loading').style.display = 'none';
            reportsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px;">加載檢舉列表時發生錯誤: ${error.message}</div>`;
        }
    }
}

// 創建檢舉卡片
function createReportCard(report) {
    const card = document.createElement('div');
    card.className = `report-card ${report.status}`;
    
    // 檢查是否為多次檢舉
    if (report.reportCount && report.reportCount > 2) {
        card.classList.add('multiple-reports');
    }
    
    // 格式化日期
    const createdAt = report.createdAt ? new Date(report.createdAt.toDate()) : new Date();
    const formattedDate = formatDate(createdAt);
    
    // 構建狀態標籤
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
    
    // 檢舉原因
    const reasons = report.reasons || [];
    const reasonsList = reasons.map(reason => {
        return `<span class="tag">${getReasonText(reason)}</span>`;
    }).join('');
    
    // 檢舉人信用分數標記
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
    
    // 添加點擊事件
    card.addEventListener('click', () => {
        showReportDetail(report.id);
    });
    
    return card;
}

// 更新分頁
function updatePagination(totalPages) {
    const paginationContainer = document.getElementById('reports-pagination');
    paginationContainer.innerHTML = '';
    
    if (totalPages <= 1) {
        return;
    }
    
    // 上一頁按鈕
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
    
    // 頁碼按鈕
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
    
    // 下一頁按鈕
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

// 顯示檢舉詳情
async function showReportDetail(reportId) {
    currentReportId = reportId;
    
    // 切換視圖
    mainContent.style.display = 'none';
    reportDetail.style.display = 'block';
    
    try {
        // 獲取檢舉數據
        const reportDocRef = doc(db, 'reports', reportId);
        const reportDoc = await getDoc(reportDocRef);
        
        if (!reportDoc.exists) {
            alert('找不到該檢舉記錄');
            reportDetail.style.display = 'none';
            mainContent.style.display = 'block';
            return;
        }
        
        const reportData = reportDoc.data();
        
        // 填充基本信息
        document.getElementById('report-id').textContent = reportId;
        document.getElementById('report-time').textContent = formatDate(reportData.createdAt.toDate());
        
        // 狀態
        const statusElement = document.getElementById('report-status');
        statusElement.textContent = getStatusText(reportData.status);
        statusElement.className = 'status-badge badge-' + reportData.status;
        
        // 處理人員
        if (reportData.handledBy) {
            document.getElementById('report-handler').textContent = reportData.handlerName || reportData.handledBy;
        } else {
            document.getElementById('report-handler').textContent = '尚未處理';
        }
        
        // 檢舉原因
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
        
        // 詳細描述
        document.getElementById('report-detail-text').textContent = reportData.detail || '無詳細描述';
        
        // 證據圖片
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
                
                // 查看原圖
                evidenceItem.querySelector('.view-full').addEventListener('click', () => {
                    document.getElementById('lightboxImage').src = url;
                    document.getElementById('imageLightbox').style.display = 'flex';
                });
                
                evidenceContainer.appendChild(evidenceItem);
            });
        } else {
            evidenceContainer.innerHTML = '<p>沒有上傳證據圖片</p>';
        }
        
        // 加載檢舉人資料
        if (reportData.reporterId) {
            loadUserProfile(reportData.reporterId, 'reporter');
        }
        
        // 加載被檢舉人資料
        if (reportData.reportedUserId) {
            loadUserProfile(reportData.reportedUserId, 'reported');
            loadPunishmentHistory(reportData.reportedUserId);
        }
        
    } catch (error) {
        console.error('顯示檢舉詳情錯誤:', error);
        alert('載入檢舉詳情時發生錯誤: ' + error.message);
        reportDetail.style.display = 'none';
        mainContent.style.display = 'block';
    }
}

// 加載用戶資料
async function loadUserProfile(userId, type) {
    try {
        const userDocRef = doc(db, 'userprofileData', userId);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists) {
            document.getElementById(`${type}-name`).textContent = '找不到用戶資料';
            document.getElementById(`${type}-id`).textContent = `ID: ${userId}`;
            return;
        }
        
        const userData = userDoc.data();
        
        // 設置用戶名稱和ID
        document.getElementById(`${type}-name`).textContent = userData.name || '未設定名稱';
        document.getElementById(`${type}-id`).textContent = `ID: ${userId}`;
        
        // 設置頭像
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
        
        // 如果是檢舉人，加載檢舉信用分數
        if (type === 'reporter') {
            loadReporterCredibility(userId);
        }
        
        // 加載檢舉歷史
        await loadReportHistory(userId, type);
        
    } catch (error) {
        console.error(`加載${type}資料錯誤:`, error);
        document.getElementById(`${type}-name`).textContent = '載入失敗';
        document.getElementById(`${type}-id`).textContent = `ID: ${userId}`;
    }
}

// 加載檢舉人信用分數
async function loadReporterCredibility(userId) {
    try {
        const credibilityDocRef = doc(db, 'userReportCredibility', userId);
        const credibilityDoc = await getDoc(credibilityDocRef);
        const creditElement = document.getElementById('reporter-credit');
        
        if (credibilityDoc.exists) {
            const data = credibilityDoc.data();
            const score = data.score || 100;
            
            // 設置信用分數的顏色
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
            // 沒有記錄時的預設值
            creditElement.textContent = '信用分數: 100';
            creditElement.className = 'credit-score credit-high';
        }
    } catch (error) {
        console.error('加載檢舉人信用分數錯誤:', error);
        document.getElementById('reporter-credit').textContent = '信用分數: --';
    }
}

// 加載處罰歷史
async function loadPunishmentHistory(userId) {
    try {
        const historyContainer = document.getElementById('punishment-history');
        historyContainer.innerHTML = '';

        const reportsRef = collection(db, 'reports');
        const reportsQuery = query(
            reportsRef, 
            where('reportedUserId', '==', userId),
            where('status', '==', 'resolved'),
            orderBy('handledAt', 'desc'),
            limit(5)
        );
        const reportsSnapshot = await getDocs(reportsQuery);
        
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

// 加載檢舉歷史
async function loadReportHistory(userId, type) {
    try {
        // 建立基本的集合引用
        const reportsRef = collection(db, 'reports');

        // 依據類型選擇查詢條件
        let reportsQuery;
        if (type === 'reporter') {
            // 作為檢舉人的歷史
            reportsQuery = query(
                reportsRef,
                where('reporterId', '==', userId),
                where('status', 'in', ['resolved', 'rejected'])
            );
        } else {
            // 作為被檢舉人的歷史
            reportsQuery = query(
                reportsRef,
                where('reportedUserId', '==', userId)
            );
        }

        // 執行查詢
        const snapshot = await getDocs(reportsQuery);
        
        // 統計有效和無效檢舉
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
        
        // 顯示統計結果
        const totalCount = validCount + invalidCount + pendingCount;
        const historyText = type === 'reporter'
            ? `${totalCount}次 (${validCount}次有效)`
            : `${totalCount}次 (${validCount}次成立, ${pendingCount}次待處理)`;
        
        document.getElementById(`${type}-history`).textContent = historyText;
        
        // 檢查用戶狀態
        const statusElement = document.getElementById(`${type}-status`);
        
        const userDocRef = doc(db, 'userStatus',userId);
        const userDoc = await getDoc(userDocRef);
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

// 處理檢舉行動
async function handleReportAction() {
    if (!currentReportId) return;
    
    // 獲取選擇的行動
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
        
        // 獲取檢舉資料
        const reportDocRef = doc(db,'reports',currentReportId);
        const reportDoc = await getDoc(reportDocRef);
        
        if (!reportDoc.exists) {
            throw new Error('找不到檢舉記錄');
        }
        
        const reportData = reportDoc.data();
        const reportedUserId = reportData.reportedUserId;
        
        // 準備更新檢舉狀態
        const updateData = {
            status: actionType === 'ignore' ? 'rejected' : 'resolved',
            handledBy: auth.currentUser.uid,
            handlerName: auth.currentUser.email,
            handledAt: serverTimestamp(),
            actionType: actionType,
            actionNote: actionNote || null
        };
        
        // 如果選擇懲罰，添加相關數據
        if (actionType === 'restrict') {
            const restrictType = document.getElementById('restrictType').value;
            const restrictDays = parseInt(document.getElementById('restrictDays').value);
            
            updateData.punishment = {
                type: 'restrict',
                restrictType: restrictType,
                duration: restrictDays,
                expireAt: new Date(Date.now() + restrictDays * 24 * 60 * 60 * 1000)
            };
            
            // 同時更新用戶狀態
            await applyUserRestriction(reportedUserId, restrictType, restrictDays);
            
        } else if (actionType === 'suspend') {
            const suspendDays = parseInt(document.getElementById('suspendDays').value);
            
            updateData.punishment = {
                type: 'suspend',
                duration: suspendDays,
                expireAt: new Date(Date.now() + suspendDays * 24 * 60 * 60 * 1000)
            };
            
            // 同時更新用戶狀態
            await suspendUser(reportedUserId, suspendDays);
            
        } else if (actionType === 'ban') {
            updateData.punishment = {
                type: 'ban',
                permanent: true
            };
            
            // 同時更新用戶狀態
            await banUser(reportedUserId);
            
        } else if (actionType === 'warning') {
            updateData.punishment = {
                type: 'warning',
                warningCount: increment(1)
            };
            
            // 同時更新用戶狀態
            await warnUser(reportedUserId, reportData.reasons);
        }
        
        // 更新檢舉記錄
        await updateDoc(reportDocRef, updateData);
        
        // 更新檢舉人的檢舉信用分數
        if (reportData.reporterId) {
            await updateReporterCredibility(
                reportData.reporterId, 
                actionType === 'ignore' ? -5 : 10
            );
        }
        
        // 處理相同被檢舉者的其他檢舉
        if (actionType !== 'ignore' && reportData.reportedUserId) {
            await handleRelatedReports(reportData.reportedUserId);
        }
        
        // 重置
        actionButton.textContent = '確認處理';
        actionButton.disabled = false;
        
        alert('檢舉處理完成');
        
        // 返回列表並重新加載
        reportDetail.style.display = 'none';
        mainContent.style.display = 'block';
        loadReports();
        checkFrequentReports(); // 更新重複檢舉數據
        
    } catch (error) {
        console.error('處理檢舉時發生錯誤:', error);
        alert('處理檢舉時發生錯誤: ' + error.message);
        
        const actionButton = document.getElementById('submitAction');
        actionButton.textContent = '確認處理';
        actionButton.disabled = false;
    }
}

// 處理相關檢舉 - 當用戶被處罰時，可以自動處理其他針對該用戶的檢舉
async function handleRelatedReports(userId) {
    try {
        // 獲取該用戶的所有待處理檢舉
        const reportsRef = collection(db, 'reports');
        const reportsQuery = query(
            reportsRef,
            where('reportedUserId', '==', userId),
            where('status', '==', 'pending')
        );
        const relatedReportsSnapshot = await getDocs(reportsQuery);

        if (relatedReportsSnapshot.empty) {
            return; // 沒有其他待處理檢舉
        }

        // 詢問管理員是否要一併處理
        const confirmHandle = confirm(`發現該用戶有${relatedReportsSnapshot.size}個其他待處理檢舉，是否一併標記為已處理？`);

        if (!confirmHandle) {
            return; // 管理員選擇不處理
        }
        
        // 批量處理其他檢舉
        const batch = writeBatch(db);
        
        relatedReportsSnapshot.forEach(doc => {
            batch.update(doc.ref, {
                status: 'resolved',
                handledBy: auth.currentUser.uid,
                handlerName: auth.currentUser.email,
                handledAt: serverTimestamp(),
                actionType: 'auto_resolved',
                actionNote: '用戶已因其他檢舉受到處罰，自動處理'
            });
        });
        
        await batch.commit();
        
        // 更新信用分數
        const docData = relatedReportsSnapshot.docs.map(doc => doc.data());
        const reporterIds = [...new Set(docData.map(data => data.reporterId))];
        
        for (const reporterId of reporterIds) {
            if (reporterId) {
                await updateReporterCredibility(reporterId, 5); // 給予較少的加分
            }
        }
        
    } catch (error) {
        console.error('處理相關檢舉時發生錯誤:', error);
        // 不拋出錯誤，以免影響主要流程
    }
}

// 更新檢舉人的信用分數
async function updateReporterCredibility(userId, points) {
    try {
        // 獲取用戶檢舉信用紀錄
        const credibilityDocRef = doc(db, 'userReportCredibility', userId);
        const docSnap = await getDoc(credibilityDocRef);
        
        if (docSnap.exists()) {
            // 現有記錄，更新分數
            await updateDoc(credibilityDocRef, {
                score: increment(points),
                lastUpdated: serverTimestamp(),
                [points > 0 ? 'validReports' : 'invalidReports']: increment(1),
                reportCount: increment(1)
            });
        } else {
            // 新紀錄，初始化
            await setDoc(credibilityDocRef, {
                userId: userId,
                score: 100 + points, // 基礎分數 100
                reportCount: 1,
                validReports: points > 0 ? 1 : 0,
                invalidReports: points < 0 ? 1 : 0,
                lastUpdated: serverTimestamp(),
                createdAt: serverTimestamp()
            });
        }
        
        // 檢查是否需要限制檢舉功能
        if (points < 0) {
            const updatedDocRef = doc(db, 'userReportCredibility', userId);
            const updatedDocSnap = await getDoc(updatedDocRef);
            const score = updatedDocSnap.data().score;

            // 獲取系統設置
            const settingsDocRef = doc(db, 'systemSettings', 'reportManagement');
            const settingsDocSnap = await getDoc(settingsDocRef);
            const settings = settingsDocSnap.exists() ? settingsDocSnap.data() : {};
            const threshold = settings.automation?.creditThreshold || 40;
            
            // 如果分數低於閾值，限制檢舉功能
            if (score < threshold) {
                await applyReportRestriction(userId);
            }
        }
    } catch (error) {
        console.error('更新檢舉人信用分數錯誤:', error);
        // 這裡的錯誤不應該影響主要流程，所以只記錄不拋出
    }
}

// 限制檢舉功能
// 限制檢舉功能
async function applyReportRestriction(userId) {
    try {
        // 獲取系統設置
        const settingsRef = doc(db, 'systemSettings', 'reportManagement');
        const settingsSnap = await getDoc(settingsRef);
        const settings = settingsSnap.exists() ? settingsSnap.data() : {};
        const penaltyType = settings.reportRules?.falseReportPenalty || 'limit';
        const days = settings.reportRules?.defaultPunishDays || 7;
        
        if (penaltyType === 'none') {
            return; // 不處罰
        }
        
        // 更新用戶狀態
        const userStatusRef = doc(db, 'userStatus', userId);
        const expireAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        
        await setDoc(userStatusRef, {
            userId: userId,
            restrictions: {
                report: {
                    active: true,
                    expireAt: expireAt,
                    reason: 'low_credit_score',
                    createdAt: serverTimestamp()
                }
            },
            lastUpdated: serverTimestamp()
        }, { merge: true });
        
        // 發送通知
        const notificationsRef = collection(db, 'notifications');
        await addDoc(notificationsRef, {
            userId: userId,
            type: 'report_restriction',
            message: '由於多次提交無效檢舉，您的檢舉功能已被限制使用，請確保檢舉內容真實有效。',
            data: {
                expireAt: expireAt
            },
            isRead: false,
            createdAt: serverTimestamp()
        });
        
    } catch (error) {
        console.error('限制檢舉功能錯誤:', error);
        // 不拋出錯誤
    }
}

// 限制用戶功能
async function applyUserRestriction(userId, restrictType, days) {
    try {
        const expireAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        
        // 更新用戶狀態
        const userStatusRef = doc(db, 'userStatus', userId);
        const docSnap = await getDoc(userStatusRef);
        
        if (docSnap.exists()) {
            // 更新現有記錄
            await updateDoc(userStatusRef, {
                [`restrictions.${restrictType}`]: {
                    active: true,
                    expireAt: expireAt,
                    createdAt: serverTimestamp()
                },
                lastUpdated: serverTimestamp()
            });
        } else {
            // 創建新記錄
            await setDoc(userStatusRef, {
                userId: userId,
                isBanned: false,
                restrictions: {
                    [restrictType]: {
                        active: true,
                        expireAt: expireAt,
                        createdAt: serverTimestamp()
                    }
                },
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
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
        const userStatusRef = doc(db, 'userStatus', userId);
        await setDoc(userStatusRef, {
            userId: userId,
            isSuspended: true,
            suspendExpireAt: expireAt,
            suspendedAt: serverTimestamp(),
            suspendReason: 'violation',
            lastUpdated: serverTimestamp()
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
        const userStatusRef = doc(db, 'userStatus', userId);
        await setDoc(userStatusRef, {
            userId: userId,
            isBanned: true,
            bannedAt: serverTimestamp(),
            banReason: 'severe_violation',
            lastUpdated: serverTimestamp()
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
        const userStatusRef = doc(db, 'userStatus', userId);
        const docSnap = await getDoc(userStatusRef);
        
        if (docSnap.exists()) {
            await updateDoc(userStatusRef, {
                warningCount: increment(1),
                lastWarningAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
            });
        } else {
            await setDoc(userStatusRef, {
                userId: userId,
                warningCount: 1,
                lastWarningAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
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
        const notificationsRef = collection(db, 'notifications');
        await addDoc(notificationsRef, {
            userId: userId,
            type: type,
            message: message,
            data: data,
            isRead: false,
            createdAt: serverTimestamp()
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
        const reportsRef = collection(db, 'reports');
        const pendingReportsQuery = query(reportsRef, where('status', '==', 'pending'));
        const pendingReportsSnapshot = await getDocs(pendingReportsQuery);
        
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
        const reportsRef = collection(db, 'reports');
        const pendingReportsQuery = query(reportsRef, where('status', '==', 'pending'));
        const pendingReportsSnapshot = await getDocs(pendingReportsQuery);
        
        if (pendingReportsSnapshot.empty) {
            loadingElement.style.display = 'none';
            container.innerHTML = '<div style="text-align: center; padding: 30px;">沒有待處理檢舉</div>';
            return;
        }
        
        // 統計每個被檢舉用戶的檢舉數量和檢舉
        const reportCounts = {};
        const userReports = {};
        
        pendingReportsSnapshot.forEach(document => {
            const data = document.data();
            data.id = document.id;
            
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
            const userDocRef = doc(db, 'userStatus', userId);
            const userDoc = await getDoc(userDocRef);
            const userData = userDoc.exists() ? userDoc.data() : null;
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
                    warningCount: increment(1)
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
            const batch = writeBatch(db);
            
            reports.forEach(report => {
                const reportRef = db.doc(db, 'reports', document.id);
                
                batch.update(reportRef, {
                    status: 'resolved',
                    handledBy: auth.currentUser.uid,
                    handlerName: auth.currentUser.email,
                    handledAt: serverTimestamp(),
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
        // 適配 Firebase v9 API
        const reportsRef = collection(db, 'reports');
        const reportsSnapshot = await getDocs(reportsRef);
        
        const reports = [];
        reportsSnapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id;
            reports.push(data);
        });
        
        // 添加照片驗證統計
        const verificationsRef = collection(db, 'PhotoVerificationRequest');
        const verificationsSnapshot = await getDocs(verificationsRef);
        
        const verificationDocs = [];
        verificationsSnapshot.forEach(doc => {
            verificationDocs.push(doc.data());
        });
        
        const totalVerifications = verificationsSnapshot.size;
        const pendingVerifications = verificationDocs.filter(doc => doc.status === 'pending').length;
        const approvedVerifications = verificationDocs.filter(doc => doc.status === 'approved').length;
        const rejectedVerifications = verificationDocs.filter(doc => doc.status === 'rejected').length;

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
                const userDocRef = doc(db, 'userprofileData', userId);
                const userDoc = await getDoc(userDocRef);
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
      const credibilityRef = collection(db, 'userReportCredibility');
      const credibilitySnapshot = await getDocs(credibilityRef);
      const credibilityData = [];
      
      credibilitySnapshot.forEach(document => {
        const data = document.data();
        data.id = document.id;
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
              const userDocRef = doc(db, 'userprofileData', data.userId);
              const userDoc = await getDoc(userDocRef);
              const userName = userDoc.exists() ? (userDoc.data().name || '未知用戶') : '未知用戶';
              
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
              const userDocRef = doc(db, 'userprofileData', data.userId);
              const userDoc = await getDoc(userDocRef);
              const userName = userDoc.exists() ? (userDoc.data().name || '未知用戶') : '未知用戶';
              
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
        const reportsRef = collection(db, 'reports');
        let reportQuery;
        
        // 應用狀態過濾
        if (statusFilter !== 'all') {
            reportQuery = query(
                reportsRef,
                where('status', '==', statusFilter),
                orderBy('handledAt', 'desc'),
                limit(50)
            );
        } else {
            reportQuery = query(
                reportsRef,
                where('status', '!=', 'pending'),
                orderBy('status'),
                orderBy('handledAt', 'desc'),
                limit(50)
            );
        }
        
        const querySnapshot = await getDocs(reportQuery);
        
        loadingIndicator.style.display = 'none';
        
        if (querySnapshot.empty) {
            historyContainer.innerHTML = '<div style="text-align: center; padding: 30px;">沒有處理歷史記錄</div>';
            return;
        }
        
        let records = [];
        querySnapshot.forEach(document => {
            const data = document.data();
            data.id = document.id;
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
        const settingsDocRef = doc(db, 'systemSettings', 'reportManagement');
        const settingsDoc = await getDoc(settingsDocRef);
        
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
        const settingsRef = doc(db, 'systemSettings', 'reportManagement');
        
        switch (section) {
            case 'reportRules':
                await setDoc(settingsRef, {
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
                
                await setDoc(settingsRef, {
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
                
                await setDoc(settingsRef, {
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
        const requestDocRef = doc(db, 'PhotoVerificationRequest', requestId);
        const requestDoc = await getDoc(requestDocRef);
        if (!requestDoc.exists) {
            alert('找不到驗證請求');
            backToVerificationList();
            return;
        }
        
        const requestData = requestDoc.data();
        
        // 獲取用戶數據
        const userDocRef = doc(db, 'userprofileData', userId);
        const userDoc = await getDoc(userDocRef);
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
        
        // 獲取 Auth 實例
        const auth = getAuth();
        
        // 1. 獲取當前驗證請求數據
        const requestDocRef = doc(db, 'PhotoVerificationRequest', requestId);
        const requestDoc = await getDoc(requestDocRef);
        if (!requestDoc.exists()) {
            throw new Error('找不到驗證請求');
        }
        const requestData = requestDoc.data();
        
        // 2. 更新驗證請求狀態
        await updateDoc(requestDocRef, {
            status: 'approved',
            verifiedPhotoIndices: verifiedIndices,
            verifiedAt: serverTimestamp(),
            verifiedBy: auth.currentUser ? auth.currentUser.uid : 'admin',
            synced: false
        });
        
        // 3. 更新用戶資料中的驗證狀態
        const userDocRef = doc(db, 'userprofileData', userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
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
            await updateDoc(userDocRef, {
                verifiedPhotos: verifiedPhotos
            });
            
            console.log('已更新用戶已驗證照片:', verifiedPhotos);
        }
        
        // 4. 刪除驗證請求記錄
        await deleteDoc(requestDocRef);
        console.log('已刪除驗證請求:', requestId);
        
        // 5. 發送通知給用戶
        const notificationsRef = collection(db, 'notifications');
        await addDoc(notificationsRef, {
            userId: userId,
            type: 'verification_approved',
            message: '您的照片驗證請求已通過審核',
            data: {
                verifiedIndices: verifiedIndices
            },
            isRead: false,
            createdAt: serverTimestamp()
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
    
    // 獲取拒絕原因
    const rejectReason = prompt('請輸入拒絕原因：', '照片模糊或未清楚顯示本人，請重新拍攝');
    if (!rejectReason || rejectReason.trim() === '') {
        alert('請輸入拒絕原因');
        return;
    }
    
    const confirmReject = confirm('確定要拒絕此驗證請求嗎？');
    if (!confirmReject) return;
    
    try {
        const rejectBtn = document.getElementById('verification-reject');
        rejectBtn.disabled = true;
        rejectBtn.innerHTML = '<div class="loading-spinner"></div> 處理中...';
        
        // 先獲取驗證請求數據和用戶數據
        const requestDocRef = doc(db, 'PhotoVerificationRequest', requestId);
        const requestDoc = await getDoc(requestDocRef);
        if (!requestDoc.exists()) {
            throw new Error('找不到驗證請求');
        }
        const requestData = requestDoc.data();
        
        // 獲取用戶的 email
        const userDocRef = doc(db, 'userprofileData', userId);
        const userDoc = await getDoc(userDocRef);
        let userEmail = '';
        let userName = '';
        if (userDoc.exists()) {
            const userData = userDoc.data();
            userEmail = userData.email || '';
            userName = userData.name || requestData.userName || '用戶';
        }
        
        // 直接刪除驗證請求記錄
        await deleteDoc(requestDocRef);
        console.log('已刪除驗證請求:', requestId);
        
        // 發送拒絕通知給用戶
        const notificationsRef = collection(db, 'notifications');
        await addDoc(notificationsRef, {
            userId: userId,
            type: 'verification_rejected',
            message: '您的照片驗證請求未通過審核，請確保網路順暢及照片清晰顯示您本人，並按照指示的動作拍攝。',
            isRead: false,
            createdAt: serverTimestamp()
        });
        
        // 存儲郵件信息到localStorage以供導出
        const emailData = {
            timestamp: new Date().toISOString(),
            userId: userId,
            userName: userName,
            userEmail: userEmail,
            type: 'verification_rejected',
            rejectReason: rejectReason.trim(),
            requestId: requestId,
            processed: false
        };

        // 獲取現有待發送郵件列表
        let pendingEmails = JSON.parse(localStorage.getItem('pendingVerificationEmails') || '[]');
        pendingEmails.push(emailData);
        localStorage.setItem('pendingVerificationEmails', JSON.stringify(pendingEmails));

        // 更新郵件導出按鈕狀態
        updateVerificationEmailExportStatus();
        
        alert('已拒絕驗證請求並刪除記錄');
        
        // 重置按鈕狀態
        rejectBtn.disabled = false;
        rejectBtn.textContent = '拒絕驗證';
        
        backToVerificationList();
        
    } catch (error) {
        console.error('拒絕驗證錯誤:', error);
        alert(`拒絕驗證時發生錯誤: ${error.message}`);
        
        const rejectBtn = document.getElementById('verification-reject');
        rejectBtn.disabled = false;
        rejectBtn.textContent = '拒絕驗證';
    }
}

// 更新驗證郵件導出狀態
function updateVerificationEmailExportStatus() {
    const pendingEmails = JSON.parse(localStorage.getItem('pendingVerificationEmails') || '[]');
    
    // 檢查是否有驗證郵件導出區段，如果沒有則創建
    let emailSection = document.getElementById('verification-email-export-section');
    if (!emailSection) {
        createVerificationEmailExportSection();
        emailSection = document.getElementById('verification-email-export-section');
    }
    
    const countElement = document.getElementById('pending-verification-email-count');
    
    if (pendingEmails.length > 0) {
        emailSection.style.display = 'block';
        if (countElement) {
            countElement.textContent = `目前有 ${pendingEmails.length} 封待發送的驗證拒絕郵件`;
        }
    } else {
        if (countElement) {
            countElement.textContent = `目前有 0 封待發送的驗證拒絕郵件`;
        }
    }
    
    console.log(`驗證郵件導出區段狀態已更新，共有 ${pendingEmails.length} 封待發送郵件`);
}

// 創建驗證郵件導出區塊
function createVerificationEmailExportSection() {
    // 確保不重複創建
    if (document.getElementById('verification-email-export-section')) {
        return;
    }
    
    // 找到verification-tab容器
    const container = document.getElementById('verification-tab');
    if (!container) {
        console.error('無法找到verification-tab容器來放置郵件導出區段');
        return;
    }
    
    const emailSection = document.createElement('div');
    emailSection.id = 'verification-email-export-section';
    emailSection.className = 'admin-section email-export-container card';
    emailSection.style.margin = '20px 0';
    emailSection.style.display = 'block';
    
    emailSection.innerHTML = `
        <div class="card-header bg-light">
            <h5 class="mb-0"><i class="fas fa-envelope me-2"></i>待發送驗證拒絕郵件</h5>
        </div>
        <div class="card-body">
            <p id="pending-verification-email-count" class="mb-3">目前有 0 封待發送的驗證拒絕郵件</p>
            <div class="d-flex gap-2">
                <button id="export-verification-emails" class="btn-primary">
                    <i class="fas fa-file-export me-1"></i> 導出驗證拒絕郵件
                </button>
                <button id="clear-verification-emails" class="btn-danger">
                    <i class="fas fa-trash me-1"></i> 清除所有待發送郵件
                </button>
            </div>
        </div>
    `;
    
    // 將區段插入到verification-tab的開頭
    const firstChild = container.firstChild;
    if (firstChild) {
        container.insertBefore(emailSection, firstChild);
    } else {
        container.appendChild(emailSection);
    }
    
    // 綁定按鈕事件
    const exportBtn = document.getElementById('export-verification-emails');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportVerificationEmailsToExcel);
    }
    
    const clearBtn = document.getElementById('clear-verification-emails');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearVerificationEmails);
    }
    
    console.log('驗證郵件導出區段已創建');
}

// 導出驗證郵件Excel
function exportVerificationEmailsToExcel() {
    const pendingEmails = JSON.parse(localStorage.getItem('pendingVerificationEmails') || '[]');
    
    if (pendingEmails.length === 0) {
        alert('沒有待處理的驗證拒絕郵件');
        return;
    }
    
    try {
        // 準備數據
        const formattedData = pendingEmails.map(email => {
            return {
                '時間戳記': formatDateTime(email.timestamp),
                '用戶ID': email.userId,
                '用戶名稱': email.userName,
                '用戶信箱': email.userEmail,
                '類型': '驗證拒絕',
                '拒絕原因': email.rejectReason,
                '請求ID': email.requestId,
                '處理狀態': '未處理'
            };
        });
        
        // 確認SheetJS庫是否可用
        if (typeof XLSX === 'undefined') {
            loadSheetJSLibrary().then(() => {
                createAndDownloadVerificationExcel(formattedData);
            });
        } else {
            createAndDownloadVerificationExcel(formattedData);
        }
    } catch (error) {
        console.error('導出驗證郵件Excel時發生錯誤:', error);
        alert('導出Excel失敗: ' + error.message);
    }
}

// 創建並下載驗證郵件Excel文件
function createAndDownloadVerificationExcel(formattedData) {
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "驗證拒絕郵件");
    
    // 調整列寬
    const colWidths = [
        { wch: 20 }, // 時間戳記
        { wch: 20 }, // 用戶ID
        { wch: 15 }, // 用戶名稱
        { wch: 25 }, // 用戶信箱
        { wch: 10 }, // 類型
        { wch: 30 }, // 拒絕原因
        { wch: 20 }, // 請求ID
        { wch: 10 }  // 處理狀態
    ];
    worksheet['!cols'] = colWidths;
    
    // 導出Excel文件
    const fileName = `驗證拒絕郵件_${formatDateForFilename(new Date())}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    alert(`Excel文件已導出: ${fileName}\n\n請使用Python腳本處理此文件來發送郵件。`);
}

// 清除驗證郵件
function clearVerificationEmails() {
    if (confirm('確定要清除所有待發送的驗證拒絕郵件嗎？此操作無法撤銷。')) {
        localStorage.removeItem('pendingVerificationEmails');
        updateVerificationEmailExportStatus();
        alert('所有待發送的驗證拒絕郵件已清除');
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
        // 適配 Firebase v9 API
        const verificationRef = collection(db, 'PhotoVerificationRequest');
        const verificationQuery = query(
            verificationRef,
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(verificationQuery);
        
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
    
    // 檢查Firebase是否初始化 - 在V9中的檢查方式
    try {
        // 假設您的應用已經通過某個函數或模組來初始化Firebase
        // 這裡直接獲取auth和firestore實例
        const auth = getAuth();
        const db = getFirestore();
        console.log('Firebase已初始化');
    } catch (error) {
        console.error('Firebase尚未初始化:', error);
        return;
    }
    
    // 獲取認證實例
    const auth = getAuth();
    console.log('檢查用戶認證狀態...');
    
    // 直接顯示按鈕，無論用戶是否登入（用於測試）
    // adminButton.style.display = 'inline-block';
    // console.log('已強制顯示管理員按鈕（測試用）');
    
    // 監聽認證狀態變化
    onAuthStateChanged(auth, async (user) => {
        console.log('認證狀態變更:', user ? '已登入: ' + user.email : '未登入');
        
        if (user) {
            try {
                // 檢查用戶是否在管理員集合中
                console.log('嘗試查詢管理員文檔:', user.uid);
                
                const adminDocRef = doc(db, 'admins', user.uid);
                const adminDoc = await getDoc(adminDocRef);
                
                if (!adminDoc.exists()) {
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

document.addEventListener('DOMContentLoaded', function() {
    // 先執行Firebase初始化
    initializeApplication();
    console.log('initializeApplication');
});
