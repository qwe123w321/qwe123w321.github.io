// business-login.js - 使用 ES 模組方式 (CDN 版本)
console.log("開始加載 business-login.js");

// 宣告核心模組變數並使用var避免重複宣告問題
var auth, db, onAuthStateChanged, doc, getDoc;
var signInWithEmailAndPassword, signOut, sendEmailVerification, sendPasswordResetEmail;
var checkAppCheckStatus, getAppCheckToken, installXHRInterceptor;
var setupSessionManager;

// 全局變數用於追蹤狀態
var statusMessageShown = false;

// 使用模組導入
try {
    // 從Firebase配置導入必要的模組
    import('./firebase-config.js').then(module => {
        auth = module.auth;
        db = module.db;
        onAuthStateChanged = module.onAuthStateChanged;
        doc = module.doc;
        getDoc = module.getDoc;
        console.log('Firebase 配置模組導入成功');
        
        // 導入完成後初始化監聽器
        initializeAuthListener();
    }).catch(error => {
        console.error('Firebase 配置模組導入失敗:', error);
    });

    // 從Firebase Auth導入認證功能
    import('https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js').then(module => {
        signInWithEmailAndPassword = module.signInWithEmailAndPassword;
        signOut = module.signOut;
        sendEmailVerification = module.sendEmailVerification;
        sendPasswordResetEmail = module.sendPasswordResetEmail;
        console.log('Firebase 認證模組導入成功');
    }).catch(error => {
        console.error('Firebase 認證模組導入失敗:', error);
    });

    // 從App Check模組導入
    import('./app-check-module.js').then(module => {
        checkAppCheckStatus = module.checkAppCheckStatus;
        getAppCheckToken = module.getAppCheckToken;
        installXHRInterceptor = module.installXHRInterceptor;
        console.log('App Check 模組導入成功');
    }).catch(error => {
        console.error('App Check 模組導入失敗:', error);
    });

    // 從會話管理器導入
    import('./session-manager.js').then(module => {
        setupSessionManager = module.setupSessionManager;
        console.log('會話管理模組導入成功');
    }).catch(error => {
        console.error('會話管理模組導入失敗:', error);
    });
} catch (error) {
    console.error('模組導入過程中出現錯誤:', error);
}

// DOM 元素綁定
document.addEventListener('DOMContentLoaded', function() {
    console.log('正在初始化商家登入頁面...');
    
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
                console.warn('App Check 狀態檢查函數不可用');
                // 延遲再試一次
                setTimeout(async () => {
                    if (typeof checkAppCheckStatus === 'function') {
                        try {
                            const result = await checkAppCheckStatus();
                            console.log('延遲 App Check 檢查結果:', result);
                        } catch (error) {
                            console.warn('延遲 App Check 檢查失敗:', error);
                        }
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('檢查 App Check 狀態時發生錯誤:', error);
        }
    }, 1000);
    
    // 登入表單處理
    const loginForm = document.getElementById('businessLoginForm');
    if (loginForm) {
        console.log('已找到登入表單，設置提交事件');
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (typeof handleLogin === 'function') {
                handleLogin(e);
            } else {
                console.error('handleLogin函數不可用');
                showError('登入功能暫時不可用，請刷新頁面後重試');
            }
        });
    } else {
        console.warn('找不到登入表單元素');
    }
    
    // 註冊按鈕
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        const navigateToRegister = function(e) {
            // 阻止所有默認行為
            e.preventDefault();
            e.stopPropagation();
            
            // 防止重複觸發
            if (registerBtn.dataset.navigating === 'true') return;
            
            // 設置標誌避免重複觸發
            registerBtn.dataset.navigating = 'true';
            
            // 添加視覺反饋
            registerBtn.style.opacity = '0.7';
            
            // 添加小延遲避免快速連續點擊
            setTimeout(function() {
                window.location.href = 'business-register.html';
            }, 50);
        };
        
        // 使用這些事件處理所有裝置
        registerBtn.addEventListener('click', navigateToRegister);
        registerBtn.addEventListener('touchend', navigateToRegister);
    }
    
    // 密碼顯示/隱藏切換
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            const passwordInput = document.getElementById('password');
            if (!passwordInput) return;
            
            const icon = this.querySelector('i');
            if (!icon) return;
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }
    
    // 忘記密碼點擊事件
    const forgotPassword = document.querySelector('.forgot-password');
    if (forgotPassword) {
        forgotPassword.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof handleResetPassword === 'function') {
                handleResetPassword(e);
            } else {
                console.error('handleResetPassword函數不可用');
                showError('忘記密碼功能暫時不可用，請刷新頁面後重試');
            }
        });
    }

    // 檢查URL參數
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    const businessId = urlParams.get('id');
    
    // 如果是從重新申請頁面被重定向回來的
    if (redirect === 'reapply' && businessId) {
        showInfo(`您需要先登入店家帳戶 (ID: ${businessId.substring(0, 5)}...) 才能進行重新申請。登入後將自動跳轉到重新申請頁面。`);
        
        // 存儲重定向信息，登入成功後使用
        sessionStorage.setItem('redirect_after_login', `business-reapply.html?id=${businessId}`);
    }
    
    // 初始化會話管理器
    if (typeof setupSessionManager === 'function') {
        setupSessionManager();
    } else {
        console.warn('會話管理器初始化函數不可用');
    }
});

// 初始化身份驗證監聽器
function initializeAuthListener() {
    if (typeof onAuthStateChanged !== 'function' || !auth) {
        console.warn('onAuthStateChanged或auth不可用，無法設置身份驗證監聽器');
        return;
    }
    
    // 自動檢查登入狀態
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
                        if (typeof checkBusinessStatus === 'function') {
                            checkBusinessStatus(user.uid);
                        } else {
                            console.error('checkBusinessStatus函數不可用');
                        }
                    }, 1000);
                }
            }
            
            // 檢查登入後重定向
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
        if (infoAlert.scrollIntoView) {
            infoAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

// 添加 App Check 警告
function addAppCheckWarning() {
    // 檢查是否已經存在警告
    if (document.getElementById('appCheckWarning')) return;
    
    const warningDiv = document.createElement('div');
    warningDiv.className = 'alert alert-warning alert-dismissible fade show mt-3';
    warningDiv.id = 'appCheckWarning';
    warningDiv.innerHTML = `
        <strong>注意:</strong> App Check 驗證未完成，這可能導致請求被拒絕(請重新整理網頁)。
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="關閉"></button>
        <div class="mt-2">
            <button class="btn btn-sm btn-warning" id="retryAppCheck">重試 App Check 驗證</button>
        </div>
    `;
    
    // 添加到登入表單前
    const loginForm = document.getElementById('businessLoginForm');
    if (loginForm) {
        loginForm.parentNode.insertBefore(warningDiv, loginForm);
        
        // 添加重試按鈕事件
        setTimeout(() => {
            const retryBtn = document.getElementById('retryAppCheck');
            if (retryBtn) {
                retryBtn.addEventListener('click', async function() {
                    this.disabled = true;
                    this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 驗證中...';
                    
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
                        showError('App Check 驗證功能暫時不可用，請刷新頁面後重試。');
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
            successAlert.remove();
        }, 5000);
    }
}

// 登入處理函數 - 添加 App Check 令牌
async function handleLogin(e) {
    if (e && e.preventDefault) {
        e.preventDefault();
    }
    
    // 獲取輸入值
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberMeInput = document.getElementById('rememberMe');
    
    if (!emailInput || !passwordInput) {
        showError('找不到必要的表單元素，請刷新頁面重試');
        return;
    }
    
    const email = sanitizeInput(emailInput.value);
    const password = passwordInput.value;
    const rememberMe = rememberMeInput ? rememberMeInput.checked : false;
    
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
        showError('找不到提交按鈕，請刷新頁面重試');
        return;
    }
    
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 登入中...';
    submitButton.disabled = true;
    
    // 先檢查 App Check
    let appCheckSuccess = false;
    try {
        console.log('登入前檢查 App Check 狀態...');
        if (typeof checkAppCheckStatus === 'function') {
            const appCheckResult = await checkAppCheckStatus();
            appCheckSuccess = appCheckResult.success;
            
            if (!appCheckSuccess) {
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
            console.warn('App Check 檢查函數不可用，繼續嘗試登入');
            window.appCheckFailed = true;
        }
    } catch (error) {
        console.error('App Check 檢查失敗:', error);
        // 記錄 App Check 失敗但繼續嘗試
        window.appCheckFailed = true;
    }
    
    try {
        // 檢查必要的Firebase組件是否可用
        if (!auth || typeof signInWithEmailAndPassword !== 'function') {
            throw new Error('Firebase認證組件未完全加載，請刷新頁面後重試');
        }
        
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
            
            return;
        }
        
        // 檢查是否為店家
        if (!db || typeof doc !== 'function' || typeof getDoc !== 'function') {
            throw new Error('Firestore組件未完全加載，請刷新頁面後重試');
        }
        
        const businessDocRef = doc(db, 'businesses', user.uid);
        const businessDoc = await getDoc(businessDocRef);
        
        if (businessDoc.exists()) {
            const businessData = businessDoc.data();
            
            // 根據審核狀態處理
            if (businessData.status === 'approved') {
                // 通過審核，導向到店家後台
                window.location.href = 'business-dashboard.html';
            } else if (businessData.status === 'pending') {
                // 審核中，顯示等待訊息
                showStatusMessage('pending');
            } else if (businessData.status === 'rejected') {
                // 審核未通過，顯示原因
                showStatusMessage('rejected', businessData.rejectReason || '未提供拒絕原因');
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
                            alert('App Check 驗證功能暫時不可用，請刷新頁面後重試');
                        }
                    });
                    errorAlert.appendChild(retryBtn);
                }
            }, 100);
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        // 顯示錯誤訊息
        showError(errorMessage);
        
        // 重置按鈕
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
    }
}

// 處理忘記密碼
async function handleResetPassword(e) {
    if (e && e.preventDefault) {
        e.preventDefault();
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
    let resetModal;
    try {
        resetModal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
        resetModal.show();
    } catch (error) {
        console.error('顯示模態對話框失敗:', error);
        alert('無法顯示密碼重設對話框，請刷新頁面後重試');
        return;
    }
    
    // 處理發送重設郵件
    const sendResetEmailBtn = document.getElementById('sendResetEmailBtn');
    if (sendResetEmailBtn) {
        sendResetEmailBtn.addEventListener('click', async function() {
            const resetEmail = document.getElementById('resetEmail').value;
            const resetPasswordAlert = document.getElementById('resetPasswordAlert');
            
            if (!resetEmail) {
                if (resetPasswordAlert) {
                    resetPasswordAlert.style.display = 'block';
                    resetPasswordAlert.classList.add('alert-danger');
                    resetPasswordAlert.classList.remove('alert-success');
                    resetPasswordAlert.textContent = '請輸入電子郵件';
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
                // 檢查必要的Firebase組件是否可用
                if (!auth || typeof sendPasswordResetEmail !== 'function') {
                    throw new Error('密碼重設功能暫時不可用，請刷新頁面後重試');
                }
                
                // 發送重設密碼郵件
                await sendPasswordResetEmail(auth, resetEmail);
                
                // 顯示成功訊息
                if (resetPasswordAlert) {
                    resetPasswordAlert.style.display = 'block';
                    resetPasswordAlert.classList.remove('alert-danger');
                    resetPasswordAlert.classList.add('alert-success');
                    resetPasswordAlert.textContent = '重設密碼郵件已發送，請查收您的信箱';
                }
                
                // 禁用發送按鈕
                this.disabled = true;
                
                // 3秒後關閉模態對話框
                setTimeout(function() {
                    if (resetModal) {
                        resetModal.hide();
                    }
                    
                    // 移除模態對話框
                    setTimeout(function() {
                        const modalElement = document.getElementById('resetPasswordModal');
                        if (modalElement) {
                            modalElement.remove();
                        }
                    }, 500);
                }, 3000);
            } catch (error) {
                console.error('發送重設密碼郵件時發生錯誤:', error);
                
                // 顯示錯誤訊息
                if (resetPasswordAlert) {
                    resetPasswordAlert.style.display = 'block';
                    resetPasswordAlert.classList.add('alert-danger');
                    resetPasswordAlert.classList.remove('alert-success');
                    
                    if (error.code === 'auth/user-not-found') {
                        resetPasswordAlert.textContent = '找不到該電子郵件對應的帳戶';
                    } else {
                        resetPasswordAlert.textContent = '發送重設密碼郵件時發生錯誤，請稍後再試';
                    }
                }
            }
        });
    }
}

// 在登入成功後 檢查店家審核狀態
async function checkBusinessStatus(userId) {
    if (!userId) {
        console.error('檢查店家狀態時未提供用戶ID');
        return;
    }
    
    try {
        // 避免重複檢查
        if (statusMessageShown) return;
        
        // 檢查必要的Firebase組件是否可用
        if (!db || typeof doc !== 'function' || typeof getDoc !== 'function') {
            console.error('檢查店家狀態時Firestore組件不可用');
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
   if (!input) return '';
   
   return input.replace(/[<>&"']/g, function(match) {
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
       if (errorAlert.scrollIntoView) {
           errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
       }
   } else {
       // 如果找不到表單，直接彈出警告
       alert(message);
   }
}

// 清除錯誤訊息
function clearErrorMessage() {
   const errorAlert = document.querySelector('.login-error-alert');
   if (errorAlert) {
       errorAlert.remove();
   }
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
                           console.error('登出功能暫時不可用');
                           alert('登出功能暫時不可用，請刷新頁面後重試');
                       }
                   } catch (error) {
                       console.error('登出時發生錯誤:', error);
                   }
               });
           }
           
           // 添加重新申請按鈕事件處理
           const reapplyBtn = document.getElementById('reapplyBtn');
           if (reapplyBtn && status === 'rejected') {
               reapplyBtn.addEventListener('click', function() {
                   if (typeof reapplyForApproval === 'function') {
                       reapplyForApproval();
                   } else {
                       console.error('重新申請功能暫時不可用');
                       alert('重新申請功能暫時不可用，請刷新頁面後重試');
                   }
               });
           }
       }, 100);
   } catch (error) {
       console.error('顯示狀態訊息時發生錯誤:', error);
   }
}

// 重新申請審核函數
async function reapplyForApproval() {
   try {
       // 檢查用戶是否登入
       if (!auth || !auth.currentUser) {
           alert('請先登入');
           return;
       }
       
       const user = auth.currentUser;
       
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
       alert('準備重新申請時發生錯誤: ' + (error.message || '未知錯誤'));
       
       // 恢復按鈕狀態
       const reapplyBtn = document.getElementById('reapplyBtn');
       if (reapplyBtn) {
           reapplyBtn.disabled = false;
           reapplyBtn.textContent = '重新申請';
       }
   }
}

// 解決可能的 App Check 跨域問題
function fixAppCheckCORSIssue() {
   console.log('正在嘗試修復 App Check 跨域問題...');
   
   try {
       // 檢查 reCAPTCHA 腳本
       const existingScript = document.querySelector('script[src*="recaptcha/api.js"]');
       
       if (existingScript) {
           console.log('找到現有的 reCAPTCHA 腳本，將嘗試修復');
           
           // 從URL中獲取 site key
           const siteKeyMatch = existingScript.src.match(/render=([^&]+)/);
           const siteKey = siteKeyMatch ? siteKeyMatch[1] : '6Lf0pfMqAAAAAPWeK67sgdduOfMbWeB5w0-0bG6G';
           
           // 移除現有腳本
           existingScript.remove();
           
           // 手動加載 reCAPTCHA
           const newScript = document.createElement('script');
           newScript.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
           newScript.async = true;
           newScript.defer = true;
           
           // 添加成功和失敗處理
           newScript.onload = function() {
               console.log('reCAPTCHA 腳本重新加載成功');
               
               // 確保 grecaptcha 對象可用
               setTimeout(function() {
                   if (window.grecaptcha) {
                       grecaptcha.ready(function() {
                           console.log('reCAPTCHA 已準備就緒');
                           
                           // 再次檢查 App Check 狀態
                           if (typeof checkAppCheckStatus === 'function') {
                               checkAppCheckStatus().then(result => {
                                   console.log('App Check 修復結果:', result);
                               }).catch(error => {
                                   console.warn('App Check 修復檢查失敗:', error);
                               });
                           }
                       });
                   } else {
                       console.warn('grecaptcha 對象不可用');
                   }
               }, 1000);
           };
           
           newScript.onerror = function() {
               console.error('reCAPTCHA 腳本重新加載失敗');
           };
           
           document.head.appendChild(newScript);
       } else {
           console.log('未找到現有的 reCAPTCHA 腳本，將嘗試加載新腳本');
           
           // 加載新的 reCAPTCHA 腳本
           const script = document.createElement('script');
           script.src = 'https://www.google.com/recaptcha/api.js?render=6Lf0pfMqAAAAAPWeK67sgdduOfMbWeB5w0-0bG6G';
           script.async = true;
           script.defer = true;
           
           script.onload = function() {
               console.log('reCAPTCHA 腳本加載成功');
           };
           
           script.onerror = function() {
               console.error('reCAPTCHA 腳本加載失敗');
           };
           
           document.head.appendChild(script);
       }
   } catch (error) {
       console.error('修復 reCAPTCHA 問題時發生錯誤:', error);
   }
}

// 添加自動恢復機制
function setupAutoRecovery() {
   console.log('設置自動錯誤恢復機制...');
   
   let recoveryInterval = setInterval(() => {
       try {
           // 檢查重要函數
           const missingFunctions = [];
           
           if (typeof handleLogin !== 'function') missingFunctions.push('handleLogin');
           if (typeof handleResetPassword !== 'function') missingFunctions.push('handleResetPassword');
           if (typeof showError !== 'function') missingFunctions.push('showError');
           
           if (missingFunctions.length > 0) {
               console.warn('檢測到缺失函數:', missingFunctions.join(', '), '- 嘗試修復');
               
               // 確保函數已定義
               if (!window.handleLogin) window.handleLogin = handleLogin;
               if (!window.handleResetPassword) window.handleResetPassword = handleResetPassword;
               if (!window.showError) window.showError = showError;
               if (!window.clearErrorMessage) window.clearErrorMessage = clearErrorMessage;
               if (!window.checkBusinessStatus) window.checkBusinessStatus = checkBusinessStatus;
               if (!window.reapplyForApproval) window.reapplyForApproval = reapplyForApproval;
           }
           
           // 修復可能的跨域問題
           if (window.appCheckFailed) {
               console.warn('檢測到App Check失敗，嘗試修復');
               fixAppCheckCORSIssue();
               window.appCheckFailed = false;
           }
           
           // 恢復次數限制
           window._recoveryAttempts = (window._recoveryAttempts || 0) + 1;
           if (window._recoveryAttempts >= 3) {
               console.log('已達到最大恢復嘗試次數，停止自動恢復');
               clearInterval(recoveryInterval);
               recoveryInterval = null;
           }
       } catch (error) {
           console.error('恢復過程中發生錯誤:', error);
       }
   }, 5000);
   
   // 30秒後停止自動恢復
   setTimeout(() => {
       if (recoveryInterval) {
           clearInterval(recoveryInterval);
           console.log('自動恢復機制已停止');
       }
   }, 30000);
}

// 頁面加載後立即修復跨域問題並設置恢復機制
window.addEventListener('load', function() {
   console.log('頁面完全加載完成，進行最終檢查...');
   
   // 修復可能的reCAPTCHA跨域問題
   setTimeout(fixAppCheckCORSIssue, 1000);
   
   // 設置自動恢復機制
   setTimeout(setupAutoRecovery, 2000);
   
   // 使輔助函數可在全局範圍內使用
   window.sanitizeInput = sanitizeInput;
   window.handleLogin = handleLogin;
   window.handleResetPassword = handleResetPassword;
   window.showError = showError;
   window.clearErrorMessage = clearErrorMessage;
   window.checkBusinessStatus = checkBusinessStatus;
   window.reapplyForApproval = reapplyForApproval;
   window.fixAppCheckCORSIssue = fixAppCheckCORSIssue;
});

// 最終導出以保證函數可用
setTimeout(function() {
   console.log("延遲檢查關鍵函數...", new Date().toISOString());
   
   // 使輔助函數可在全局範圍內使用（最終確保）
   window.sanitizeInput = sanitizeInput;
   window.handleLogin = handleLogin;
   window.handleResetPassword = handleResetPassword;
   window.showError = showError;
   window.clearErrorMessage = clearErrorMessage;
   window.checkBusinessStatus = checkBusinessStatus;
   window.reapplyForApproval = reapplyForApproval;
   window.fixAppCheckCORSIssue = fixAppCheckCORSIssue;
   
   console.log("關鍵函數再次檢查:", {
       handleLogin: typeof window.handleLogin === 'function' ? '✓' : '✗',
       handleResetPassword: typeof window.handleResetPassword === 'function' ? '✓' : '✗',
       showError: typeof window.showError === 'function' ? '✓' : '✗',
       checkBusinessStatus: typeof window.checkBusinessStatus === 'function' ? '✓' : '✗'
   });
}, 3000);