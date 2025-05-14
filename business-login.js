// business-login.js - 改進版本
// 首先定義必需的變量，避免後續函數使用時出現未定義錯誤
let auth, db, onAuthStateChanged, doc, getDoc;
let signInWithEmailAndPassword, signOut, sendEmailVerification, sendPasswordResetEmail;
let checkAppCheckStatus, getAppCheckToken, installXHRInterceptor;
let setupSessionManager;
let statusMessageShown = false;

// 使用 IIFE 來隔離作用域並確保加載順序
(async function() {
    console.log('開始初始化 business-login.js 核心模組');
    
    try {
        // 1. 先導入核心 Firebase 模組 - 使用動態導入確保按順序加載
        const firebaseConfig = await import('./firebase-config.js');
        auth = firebaseConfig.auth;
        db = firebaseConfig.db;
        onAuthStateChanged = firebaseConfig.onAuthStateChanged;
        doc = firebaseConfig.doc;
        getDoc = firebaseConfig.getDoc;
        console.log('Firebase 核心模組加載成功');
        
        // 2. 導入身份驗證模組
        const authModule = await import('https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js');
        signInWithEmailAndPassword = authModule.signInWithEmailAndPassword;
        signOut = authModule.signOut;
        sendEmailVerification = authModule.sendEmailVerification;
        sendPasswordResetEmail = authModule.sendPasswordResetEmail;
        console.log('Firebase 身份驗證模組加載成功');
        
        // 3. 導入 App Check 模組
        const appCheckModule = await import('./app-check-module.js');
        checkAppCheckStatus = appCheckModule.checkAppCheckStatus;
        getAppCheckToken = appCheckModule.getAppCheckToken;
        installXHRInterceptor = appCheckModule.installXHRInterceptor;
        console.log('App Check 模組加載成功');
        
        // 4. 導入會話管理模組
        const sessionModule = await import('./session-manager.js');
        setupSessionManager = sessionModule.setupSessionManager;
        console.log('會話管理模組加載成功');
        
        // 模組加載完成後初始化页面
        initializePage();
    } catch (err) {
        console.error('核心模組加載失敗:', err);
        
        // 即使加載失敗，仍然嘗試初始化基本頁面功能
        setTimeout(() => {
            initializePage();
        }, 1000);
    }
})();

// 頁面初始化函數 - 绑定所有事件處理器
function initializePage() {
    console.log('正在初始化頁面事件處理器...');
    
    // 確保 DOM 已完全加載
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
        setupEventListeners();
    }
    
    // 檢查 URL 参數並處理重定向
    checkUrlParams();
    
    // 如果 auth 已加載，設置身份驗證狀態監聽器
    if (typeof auth !== 'undefined' && auth) {
        setupAuthStateListener();
    } else {
        console.warn('Auth 模組未加載，無法設置身份驗證監聽器');
    }
}

// 設置所有事件監聽器
function setupEventListeners() {
    console.log('正在設置事件監聽器...');
    
    // 檢查 App Check 狀態
    setTimeout(async () => {
        console.log('正在檢查 App Check 狀態...');
        try {
            if (typeof checkAppCheckStatus === 'function') {
                const result = await checkAppCheckStatus();
                if (result.success) {
                    console.log('App Check 驗證成功！');
                } else {
                    console.error('App Check 驗證失敗，可能導致未經驗證的請求錯誤');
                    // 添加錯誤提示到頁面
                    addAppCheckWarning();
                }
            } else {
                console.warn('App Check 狀態檢查函數未加載');
            }
        } catch (error) {
            console.error('檢查 App Check 狀態時發生錯誤:', error);
        }
    }, 1000);
    
    // 防止事件冒泡問題的輔助函數
    function safeAddEventListener(element, eventType, handler) {
        if (element) {
            // 移除任何現有的事件監聽器以避免重複
            element.removeEventListener(eventType, handler);
            // 添加新的事件監聽器
            element.addEventListener(eventType, handler);
            return true;
        }
        return false;
    }
    
    // 登入表單處理
    const loginForm = document.getElementById('businessLoginForm');
    if (safeAddEventListener(loginForm, 'submit', function(e) {
        e.preventDefault();
        e.stopPropagation(); // 阻止事件冒泡
        console.log('登入表單提交');
        
        // 安全地調用登入處理函數
        if (typeof handleLogin === 'function') {
            handleLogin(e);
        } else {
            console.error('handleLogin 函數未定義');
            alert('系統錯誤：登入處理函數未加載');
        }
    })) {
        console.log('登入表單事件綁定成功');
    }
    
    // 註冊按鈕事件
    safeAddEventListener(document.getElementById('registerBtn'), 'click', function(e) {
        e.preventDefault();
        window.location.href = 'business-register.html';
    });
    
    // 註冊連結事件
    safeAddEventListener(document.getElementById('signupLink'), 'click', function(e) {
        e.preventDefault();
        window.location.href = 'business-register.html';
    });
    
    // 密碼顯示/隱藏切換
    const togglePassword = document.getElementById('togglePassword');
    safeAddEventListener(togglePassword, 'click', function(e) {
        e.preventDefault(); // 防止在iOS上觸發表單提交
        const passwordInput = document.getElementById('password');
        const icon = this.querySelector('i');
        
        if (passwordInput) {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                if (icon) {
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                }
            } else {
                passwordInput.type = 'password';
                if (icon) {
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
        }
    });
    
    // 忘記密碼點擊事件
    const forgotPassword = document.querySelector('.forgot-password');
    safeAddEventListener(forgotPassword, 'click', function(e) {
        e.preventDefault();
        if (typeof handleResetPassword === 'function') {
            handleResetPassword(e);
        } else {
            console.error('handleResetPassword 函數未定義');
            alert('系統錯誤：密碼重設函數未加載');
        }
    });
    
    // 初始化會話管理器
    if (typeof setupSessionManager === 'function') {
        const sessionManager = setupSessionManager();
        console.log('會話管理器初始化完成');
    } else {
        console.warn('會話管理器未加載');
    }
    
    console.log('所有事件監聽器設置完成');
}

// 設置身份驗證狀態監聽器
function setupAuthStateListener() {
    if (typeof onAuthStateChanged !== 'function' || !auth) {
        console.error('無法設置身份驗證監聽器 - 必要組件未加載');
        return;
    }
    
    console.log('設置身份驗證狀態監聽器');
    
    onAuthStateChanged(auth, function(user) {
        // 確認當前頁面是否為登入頁面
        const isLoginPage = window.location.pathname.endsWith('business-login.html') || 
                          window.location.pathname.endsWith('/');
        
        if (user) {
            console.log('檢測到用戶已登入:', user.email);
            
            // 只在登入頁面才執行狀態檢查和重定向
            if (isLoginPage) {
                // 使用標記防止重複檢查
                if (!window.initialAuthCheckComplete) {
                    window.initialAuthCheckComplete = true;
                    console.log('執行店家狀態檢查...');
                    // 延遲執行檢查
                    setTimeout(() => {
                        checkBusinessStatus(user.uid);
                    }, 1000);
                }
            }
        } else {
            console.log('未檢測到已登入用戶');
            window.initialAuthCheckComplete = false;
            
            // 如果是在儀表板頁面但未登入，重定向到登入頁面
            if (window.location.pathname.includes('business-dashboard')) {
                console.log('用戶未登入但嘗試訪問儀表板，重定向到登入頁面');
                window.location.href = 'business-login.html';
            }
        }
    });
}

// 檢查 URL 參數
function checkUrlParams() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        const businessId = urlParams.get('id');
        
        // 如果是從重新申請頁面被重定向回來的
        if (redirect === 'reapply' && businessId) {
            showInfo(`您需要先登入店家帳戶 (ID: ${businessId.substring(0, 5)}...) 才能進行重新申請。登入後將自動跳轉到重新申請頁面。`);
            
            // 存儲重定向信息，登入成功後使用
            sessionStorage.setItem('redirect_after_login', `business-reapply.html?id=${businessId}`);
            
            // 檢查登入後的重定向
            if (typeof auth !== 'undefined' && auth && typeof onAuthStateChanged === 'function') {
                onAuthStateChanged(auth, function(user) {
                    if (user) {
                        const redirectUrl = sessionStorage.getItem('redirect_after_login');
                        if (redirectUrl) {
                            // 清除存儲的重定向URL
                            sessionStorage.removeItem('redirect_after_login');
                            
                            // 檢查重定向URL是否為重新申請頁面
                            if (redirectUrl.includes('business-reapply.html')) {
                                // 檢查URL中的ID是否匹配當前用戶
                                const urlId = new URLSearchParams(redirectUrl.split('?')[1]).get('id');
                                
                                if (urlId === user.uid) {
                                    console.log('檢測到登入後需要重定向到重新申請頁面');
                                    
                                    // 延遲執行重定向，確保其他初始化完成
                                    setTimeout(() => {
                                        window.location.href = redirectUrl;
                                    }, 500);
                                }
                            }
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error('檢查 URL 參數時發生錯誤:', error);
    }
}

// 顯示提示信息
function showInfo(message) {
    // 先清除之前的提示信息
    clearErrorMessage();
    
    // 創建提示
    const infoAlert = document.createElement('div');
    infoAlert.className = 'alert alert-info mt-3';
    infoAlert.role = 'alert';
    
    // 插入到登入表單之前
    const loginForm = document.getElementById('businessLoginForm');
    if (loginForm) {
        loginForm.parentNode.insertBefore(infoAlert, loginForm);
        
        // 設置信息
        infoAlert.textContent = message;
        
        // 自動滾動到信息處
        infoAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// 添加 App Check 警告
function addAppCheckWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'alert alert-warning alert-dismissible fade show mt-3';
    warningDiv.id = 'appCheckWarning';
    warningDiv.innerHTML = `
        <strong>注意:</strong> App Check 驗證未完成，這可能導致請求被拒絕。請嘗試重新整理頁面。
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="關閉"></button>
        <div class="mt-2">
            <button class="btn btn-sm btn-warning" id="retryAppCheck">重試 App Check 驗證</button>
        </div>
    `;
    
    // 添加到登入表單前
    const loginForm = document.getElementById('businessLoginForm');
    if (loginForm) {
        const existingWarning = document.getElementById('appCheckWarning');
        if (existingWarning) {
            existingWarning.remove();
        }
        
        loginForm.parentNode.insertBefore(warningDiv, loginForm);
        
        // 添加重試按鈕事件
        setTimeout(() => {
            const retryBtn = document.getElementById('retryAppCheck');
            if (retryBtn) {
                retryBtn.addEventListener('click', async function() {
                    this.disabled = true;
                    this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 驗證中...';
                    
                    try {
                        if (typeof checkAppCheckStatus === 'function') {
                            const result = await checkAppCheckStatus();
                            if (result.success) {
                                // 移除警告並顯示成功訊息
                                document.getElementById('appCheckWarning').remove();
                                showSuccess('App Check 驗證成功！您現在可以嘗試登入。');
                            } else {
                                // 更新警告
                                this.disabled = false;
                                this.textContent = '重試 App Check 驗證';
                                showError('App Check 驗證仍然失敗，請刷新頁面或檢查網絡連接。');
                            }
                        } else {
                            this.disabled = false;
                            this.textContent = '重試 App Check 驗證';
                            showError('App Check 驗證函數未加載，請刷新頁面後重試。');
                        }
                    } catch (error) {
                        console.error('重試 App Check 驗證時發生錯誤:', error);
                        this.disabled = false;
                        this.textContent = '重試 App Check 驗證';
                        showError('驗證過程中發生錯誤，請刷新頁面後重試。');
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
    const loginForm = document.getElementById('businessLoginForm');
    if (loginForm) {
        loginForm.parentNode.insertBefore(successAlert, loginForm);
        
        // 5秒后自動移除
        setTimeout(() => {
            if (successAlert.parentNode) {
                successAlert.remove();
            }
        }, 5000);
    }
}

// 登入處理函數 - 添加 App Check 令牌
async function handleLogin(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation(); // 阻止事件冒泡
    }
    
    // 檢查必要的函數是否已加載
    if (typeof signInWithEmailAndPassword !== 'function' || !auth) {
        console.error('Firebase 身份驗證模組未加載，無法處理登入');
        showError('系統尚未準備好，請稍後再試或重新整理頁面');
        return;
    }
    
    // 獲取輸入值
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (!emailInput || !passwordInput) {
        console.error('無法找到輸入欄位元素');
        showError('系統錯誤：無法找到輸入欄位');
        return;
    }
    
    const email = sanitizeInput(emailInput.value);
    const password = passwordInput.value;
    const rememberMe = document.getElementById('rememberMe') ? document.getElementById('rememberMe').checked : false;
    
    // 清除之前的錯誤訊息
    clearErrorMessage();
    
    // 表單驗證
    if (!email || !password) {
        showError('請填寫所有必填欄位');
        return;
    }
    
    // 更新按鈕狀態
    const submitButton = document.querySelector('button[type="submit"]');
    if (!submitButton) {
        console.error('無法找到提交按鈕');
        showError('系統錯誤：無法處理登入請求');
        return;
    }
    
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 登入中...';
    submitButton.disabled = true;
    
    // 防止在處理過程中重複提交
    let loginProcessing = true;
    
    // 先檢查 App Check
    try {
        console.log('登入前檢查 App Check 狀態...');
        
        if (typeof checkAppCheckStatus === 'function') {
            const appCheckResult = await checkAppCheckStatus();
            
            if (!appCheckResult.success) {
                console.warn('App Check 驗證失敗，但仍將嘗試登入');
                // 添加標誌，指示 App Check 失敗但允許登入嘗試
                window.appCheckFailed = true;
            } else {
                console.log('App Check 驗證成功，繼續登入流程');
                window.appCheckFailed = false;
                
                // 設置 XHR 攔截器來添加 App Check 令牌
                if (typeof installXHRInterceptor === 'function') {
                    installXHRInterceptor();
                }
            }
        } else {
            console.warn('App Check 檢查函數未加載，繼續嘗試登入');
            window.appCheckFailed = true;
        }
    } catch (error) {
        console.error('App Check 檢查失敗:', error);
        // 記錄 App Check 失敗但繼續嘗試
        window.appCheckFailed = true;
    }
    
    try {
        // 使用 Firebase Auth 登入
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 檢查郵箱是否已驗證
        if (!user.emailVerified) {
            // 未驗證，發送新的驗證郵件
            if (typeof sendEmailVerification === 'function') {
                await sendEmailVerification(user);
            }
            
            if (typeof signOut === 'function') {
                await signOut(auth);
            }
            
            // 顯示錯誤訊息
            showError('您的電子郵件尚未驗證，我們已發送一封新的驗證郵件，請完成驗證後再登入');
            
            // 重置按鈕
            submitButton.innerHTML = originalButtonText;
            submitButton.disabled = false;
            loginProcessing = false;
            
            return;
        }
        
        // 檢查是否為店家
        if (typeof doc === 'function' && typeof getDoc === 'function') {
            const businessDocRef = doc(db, 'businesses', user.uid);
            const businessDoc = await getDoc(businessDocRef);
            
            if (businessDoc.exists()) {
                const businessData = businessDoc.data();
                
                // 根據審核狀態處理
                if (businessData.status === 'approved') {
                    // 通過審核，導向到店家後台
                    console.log('登入成功：商家已通過審核，重定向到儀表板');
                    window.location.href = 'business-dashboard.html';
                } else if (businessData.status === 'pending') {
                    // 審核中，顯示等待訊息
                    showStatusMessage('pending');
                    
                    // 重置按鈕
                    submitButton.innerHTML = originalButtonText;
                    submitButton.disabled = false;
                    loginProcessing = false;
                } else if (businessData.status === 'rejected') {
                    // 審核未通過，顯示原因
                    showStatusMessage('rejected', businessData.rejectReason || '未提供拒絕原因');
                    
                    // 重置按鈕
                    submitButton.innerHTML = originalButtonText;
                    submitButton.disabled = false;
                    loginProcessing = false;
                }
            } else {
                // 不是店家，可能是普通用戶誤入
                if (typeof signOut === 'function') {
                    await signOut(auth);
                }
                
                showError('此帳號不是店家帳號，請使用店家帳號登入或註冊新的店家帳號');
                
                // 重置按鈕
                submitButton.innerHTML = originalButtonText;
                submitButton.disabled = false;
                loginProcessing = false;
            }
        } else {
            console.error('Firestore 模組未加載，無法檢查店家狀態');
            showError('系統尚未準備好，請稍後再試或重新整理頁面');
            
            // 重置按鈕
            submitButton.innerHTML = originalButtonText;
            submitButton.disabled = false;
            loginProcessing = false;
        }
    } catch (error) {
        console.error('登入時發生錯誤:', error);
        
        // 處理不同錯誤
        let errorMessage = '登入失敗，請檢查您的電子郵件和密碼';
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = '找不到該電子郵件對應的帳戶';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = '密碼錯誤';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = '嘗試登入次數過多，請稍後再試';
        } else if (error.code === 'auth/user-disabled') {
            errorMessage = '此帳戶已被停用，請聯繫客服';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = '網絡請求失敗，請檢查您的網絡連接並重試。可能是 App Check 驗證問題。';
            
            // 添加重試 App Check 的按鈕
            setTimeout(() => {
                const errorAlert = document.querySelector('.login-error-alert');
                if (errorAlert) {
                    const retryBtn = document.createElement('button');
                    retryBtn.className = 'btn btn-sm btn-warning mt-2';
                    retryBtn.textContent = '重試 App Check 驗證';
                    retryBtn.addEventListener('click', async function() {
                        if (typeof checkAppCheckStatus === 'function') {
                            await checkAppCheckStatus();
                        } else {
                            showError('App Check 驗證函數未加載，請刷新頁面後重試');
                        }
                    });
                    errorAlert.appendChild(retryBtn);
                }
            }, 100);
        }
        
        // 顯示錯誤訊息
        showError(errorMessage);
        
        // 重置按鈕
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        loginProcessing = false;
    }
    
    // 防止頁面在處理時被用戶離開
    if (loginProcessing) {
        window.addEventListener('beforeunload', function(e) {
            if (loginProcessing) {
                e.preventDefault();
                e.returnValue = '登入處理尚未完成，確定要離開嗎？';
            }
        });
    }
}

// 處理忘記密碼
async function handleResetPassword(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation(); // 阻止事件冒泡
    }
    
    // 檢查必要的函數是否已加載
    if (typeof sendPasswordResetEmail !== 'function' || !auth) {
        console.error('Firebase 身份驗證模組未加載，無法處理密碼重設');
        alert('系統尚未準備好，請稍後再試或重新整理頁面');
        return;
    }
    
    // 檢查是否已存在模態對話框，避免重複創建
    const existingModal = document.getElementById('resetPasswordModal');
    if (existingModal) {
        // 如果已存在，直接顯示並返回
        const resetModal = new bootstrap.Modal(existingModal);
        resetModal.show();
        return;
    }
    
    // 創建模態對話框
    const modalHtml = `
        <div class="modal fade" id="resetPasswordModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">重設密碼</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>請輸入您的註冊電子郵件，我們將發送密碼重設信件給您。</p>
                        <div class="form-group">
                            <label for="resetEmail">電子郵件</label>
                            <input type="email" class="form-control" id="resetEmail" required>
                        </div>
                        <div class="alert alert-info mt-3" style="display: none;" id="resetPasswordAlert"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn login-btn" id="sendResetEmailBtn">發送重設信件</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 添加到頁面
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 顯示模態對話框
    const resetModal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
    resetModal.show();
    
    // 處理發送重設郵件
    const sendResetBtn = document.getElementById('sendResetEmailBtn');
    if (sendResetBtn) {
        sendResetBtn.addEventListener('click', async function() {
            const resetEmailInput = document.getElementById('resetEmail');
            const resetEmail = resetEmailInput ? resetEmailInput.value : '';
            const resetAlert = document.getElementById('resetPasswordAlert');
            
            if (!resetEmail) {
                if (resetAlert) {
                    resetAlert.style.display = 'block';
                    resetAlert.classList.add('alert-danger');
                    resetAlert.classList.remove('alert-success');
                    resetAlert.textContent = '請輸入電子郵件';
                }
                return;
            }
            
            // 檢查 App Check 狀態
            try {
                if (typeof checkAppCheckStatus === 'function') {
                    await checkAppCheckStatus();
                }
            } catch (error) {
                console.warn('重設密碼前檢查 App Check 失敗:', error);
            }
            
            try {
                // 發送重設密碼郵件
                await sendPasswordResetEmail(auth, resetEmail);
                
                // 顯示成功訊息
                if (resetAlert) {
                    resetAlert.style.display = 'block';
                    resetAlert.classList.remove('alert-danger');
                    resetAlert.classList.add('alert-success');
                    resetAlert.textContent = '重設密碼郵件已發送，請查收您的信箱';
                    
                    // 禁用發送按鈕
                    this.disabled = true;
                    
                    // 3秒後關閉模態對話框
                    setTimeout(function() {
                        resetModal.hide();
                        
                        // 移除模態對話框
                        setTimeout(function() {
                            const modalElement = document.getElementById('resetPasswordModal');
                            if (modalElement) {
                                modalElement.remove();
                            }
                        }, 500);
                    }, 3000);
                }
                } catch (error) {
                console.error('發送重設密碼郵件時發生錯誤:', error);
                
                // 顯示錯誤訊息
                if (resetAlert) {
                    resetAlert.style.display = 'block';
                    resetAlert.classList.add('alert-danger');
                    resetAlert.classList.remove('alert-success');
                    
                    if (error.code === 'auth/user-not-found') {
                        resetAlert.textContent = '找不到該電子郵件對應的帳戶';
                    } else if (error.code === 'auth/network-request-failed') {
                        resetAlert.textContent = '網絡請求失敗，請稍後再試或檢查網絡連接';
                    } else {
                        resetAlert.textContent = '發送重設密碼郵件時發生錯誤，請稍後再試';
                    }
                }
            }
        });
    }
}

// 在登入成功後 檢查店家審核狀態
async function checkBusinessStatus(userId) {
    try {
        // 避免重複檢查
        if (statusMessageShown) return;
        
        if (!userId || typeof doc !== 'function' || typeof getDoc !== 'function') {
            console.error('缺少必要參數或函數未加載，無法檢查店家狀態');
            return;
        }
        
        const businessDocRef = doc(db, 'businesses', userId);
        const businessDoc = await getDoc(businessDocRef);
        
        if (businessDoc.exists()) {
            const businessData = businessDoc.data();
            
            // 根據審核狀態處理
            if (businessData.status === 'approved') {
                console.log('登入成功：商家已通過審核，重定向到儀表板');
                // 標記為已進行重定向，避免循環
                localStorage.setItem('redirected_to_dashboard', 'true');
                // 使用絕對路徑確保正確重定向
                window.location.href = 'business-dashboard.html';
                return; // 防止繼續執行
            } else if (businessData.status === 'pending') {
                console.log('登入成功：商家審核中');
                showStatusMessage('pending');
            } else if (businessData.status === 'rejected') {
                console.log('登入失敗：商家審核未通過');
                showStatusMessage('rejected', businessData.rejectReason || '未提供拒絕原因');
            }
        } else {
            // 找不到店家資料，但不要立即登出
            console.error('找不到店家資料');
            showError('找不到店家資料，請聯繫客服');
            // 延遲登出以避免循環
            setTimeout(async () => {
                if (typeof signOut === 'function' && auth) {
                    await signOut(auth);
                }
            }, 2000);
        }
    } catch (error) {
        console.error('檢查審核狀態時發生錯誤:', error);
    }
}

// 輸入清理函數
function sanitizeInput(input) {
    // 防止 XSS 攻擊
    if (!input) return '';
    
    return String(input).replace(/[<>&"']/g, function(match) {
        return {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#39;'
        }[match];
    });
}

// 顯示錯誤訊息
function showError(message) {
    // 先清除之前的錯誤訊息
    clearErrorMessage();
    
    if (!message) return;
    
    // 創建錯誤提示
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-danger login-error-alert mt-3';
    errorAlert.role = 'alert';
    
    // 插入到登入表單之前
    const loginForm = document.getElementById('businessLoginForm');
    if (loginForm) {
        loginForm.parentNode.insertBefore(errorAlert, loginForm);
        
        // 設置錯誤訊息
        errorAlert.textContent = message;
        
        // 自動滾動到錯誤訊息
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// 清除錯誤訊息
function clearErrorMessage() {
    const errorAlerts = document.querySelectorAll('.login-error-alert');
    errorAlerts.forEach(alert => {
        if (alert.parentNode) {
            alert.remove();
        }
    });
}

// 顯示狀態訊息
function showStatusMessage(status, reason = '') {
    // 防止重複顯示狀態訊息
    if (statusMessageShown) return;
    statusMessageShown = true;
    
    // 創建狀態提示
    let alertClass = 'alert-info';
    let message = '';
    let actionButton = '';
    
    if (status === 'pending') {
        alertClass = 'alert-warning';
        message = '您的店家帳戶正在審核中，請耐心等待。審核通過後我們將通過電子郵件通知您。';
        actionButton = '<button class="btn btn-sm btn-outline-warning mt-2" id="logoutBtn">登出</button>';
    } else if (status === 'rejected') {
        alertClass = 'alert-danger';
        message = `很抱歉，您的店家帳戶申請未通過審核。原因：${reason}`;
        actionButton = `
            <div class="mt-3">
                <button class="btn btn-sm btn-outline-danger me-2" id="logoutBtn">登出</button>
                <button class="btn btn-sm btn-danger" id="reapplyBtn">重新申請</button>
            </div>
        `;
    }
    
    // 創建狀態提示容器
    const statusAlert = document.createElement('div');
    statusAlert.className = `alert ${alertClass} mt-4 status-alert`;
    statusAlert.innerHTML = `
        <h5>${status === 'pending' ? '審核中' : '審核未通過'}</h5>
        <p>${message}</p>
        ${actionButton}
    `;
    
    try {
        // 隱藏登入表單
        const loginForm = document.getElementById('businessLoginForm');
        if (loginForm) {
            loginForm.style.display = 'none';
        }
        
        // 隱藏其他元素
        const orDivider = document.querySelector('.or-divider');
        if (orDivider) {
            orDivider.style.display = 'none';
        }
        
        const socialLogin = document.querySelector('.social-login');
        if (socialLogin) {
            socialLogin.style.display = 'none';
        }
        
        const loginFooter = document.querySelector('.login-footer');
        if (loginFooter) {
            loginFooter.style.display = 'none';
        }
        
        // 插入狀態提示
        const loginFormContainer = document.querySelector('.login-form-container');
        if (loginFormContainer) {
            loginFormContainer.appendChild(statusAlert);
        } else {
            // 如果找不到容器，添加到 body
            document.body.appendChild(statusAlert);
        }
        
        // 添加登出按鈕事件處理
        setTimeout(() => {
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async function() {
                    try {
                        if (typeof signOut === 'function' && auth) {
                            await signOut(auth);
                            window.location.reload(); // 登出後重新加載頁面
                        } else {
                            console.error('登出函數未加載');
                            alert('系統錯誤：登出功能未加載，請重新整理頁面');
                        }
                    } catch (error) {
                        console.error('登出時發生錯誤:', error);
                    }
                });
            }
            
            // 添加重新申請按鈕事件處理
            const reapplyBtn = document.getElementById('reapplyBtn');
            if (reapplyBtn && status === 'rejected') {
                reapplyBtn.addEventListener('click', reapplyForApproval);
            }
        }, 100);
    } catch (error) {
        console.error('顯示狀態訊息時發生錯誤:', error);
    }
}

// 重新申請審核函數
async function reapplyForApproval() {
    try {
        // 檢查是否已登入
        if (!auth) {
            console.error('Auth 模組未加載');
            alert('系統尚未準備好，請刷新頁面後重試');
            return;
        }
        
        const user = auth.currentUser;
        
        if (!user) {
            alert('請先登入');
            return;
        }
        
        // 確認是否要重新申請
        const confirmed = confirm('您確定要重新提交店家審核申請嗎？');
        if (!confirmed) return;
        
        // 顯示處理中提示
        const reapplyBtn = document.getElementById('reapplyBtn');
        if (reapplyBtn) {
            reapplyBtn.disabled = true;
            reapplyBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 處理中...';
        }
        
        // 存儲會話標識到localStorage，幫助重新申請頁面恢復認證狀態
        localStorage.setItem('business_reapply_session', user.uid);
        
        // 檢查App Check狀態
        try {
            if (typeof checkAppCheckStatus === 'function') {
                await checkAppCheckStatus();
            }
        } catch (error) {
            console.warn('App Check檢查失敗，但將繼續重新申請流程:', error);
        }
        
        // 重定向到重新申請頁面，帶上店家ID
        window.location.href = `business-reapply.html?id=${user.uid}`;
        
    } catch (error) {
        console.error('準備重新申請時發生錯誤:', error);
        alert('準備重新申請時發生錯誤: ' + error.message);
        
        // 恢復按鈕狀態
        const reapplyBtn = document.getElementById('reapplyBtn');
        if (reapplyBtn) {
            reapplyBtn.disabled = false;
            reapplyBtn.textContent = '重新申請';
        }
    }
}

// 檢測瀏覽器類型函數
function detectBrowser() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    // 檢測iOS
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    
    // 檢測Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    
    // 檢測Chrome
    const isChrome = /chrome/i.test(userAgent);
    
    // 檢測Firefox
    const isFirefox = /firefox/i.test(userAgent);
    
    // 檢測Edge
    const isEdge = /edg/i.test(userAgent);
    
    return {
        isIOS,
        isSafari,
        isChrome,
        isFirefox,
        isEdge,
        userAgent
    };
}

// iOS特定修復函數
function applyIOSFixes() {
    const browserInfo = detectBrowser();
    
    if (browserInfo.isIOS) {
        console.log('檢測到iOS裝置，應用特定修復...');
        
        // 修復1: 防止iOS上的表單自動提交
        document.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', function(e) {
                // 對於非提交按鈕，阻止預設行為
                if (this.type !== 'submit') {
                    e.preventDefault();
                }
            });
        });
        
        // 修復2: 解決iOS上的點擊延遲問題
        document.documentElement.style.cursor = 'pointer';
        
        // 修復3: 確保密碼切換按鈕在iOS上正常工作
        const togglePassword = document.getElementById('togglePassword');
        if (togglePassword) {
            togglePassword.addEventListener('touchend', function(e) {
                e.preventDefault();
                const passwordInput = document.getElementById('password');
                const icon = this.querySelector('i');
                
                if (passwordInput) {
                    if (passwordInput.type === 'password') {
                        passwordInput.type = 'text';
                        if (icon) {
                            icon.classList.remove('fa-eye');
                            icon.classList.add('fa-eye-slash');
                        }
                    } else {
                        passwordInput.type = 'password';
                        if (icon) {
                            icon.classList.remove('fa-eye-slash');
                            icon.classList.add('fa-eye');
                        }
                    }
                }
            });
        }
        
        // 修復4: 確保表單提交在iOS上可靠工作
        const loginForm = document.getElementById('businessLoginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('iOS上的表單提交觸發');
                
                // 在iOS上，直接調用處理函數而不是依賴事件傳播
                if (typeof handleLogin === 'function') {
                    handleLogin(e);
                } else {
                    console.error('handleLogin函數未加載');
                }
            });
        }
    }
}

// 當文檔載入完成時自動調用iOS修復
document.addEventListener('DOMContentLoaded', function() {
    applyIOSFixes();
});

// 使輔助函數可在全局範圍內使用
window.sanitizeInput = sanitizeInput;
window.handleLogin = handleLogin;
window.handleResetPassword = handleResetPassword;
window.showError = showError;
window.clearErrorMessage = clearErrorMessage;
window.checkBusinessStatus = checkBusinessStatus;
window.reapplyForApproval = reapplyForApproval;
window.detectBrowser = detectBrowser;
window.applyIOSFixes = applyIOSFixes;

// 添加初始化完成標記
window.businessLoginJsLoaded = true;
console.log('business-login.js 完全加載完成！');