// business-login.js - 使用 ES 模組方式 (CDN 版本)
import { 
    auth, 
    db, 
    onAuthStateChanged, 
    doc, 
    getDoc
} from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    sendEmailVerification, 
    sendPasswordResetEmail 
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';

// 從統一的 App Check 模組導入需要的函數
import { 
    checkAppCheckStatus,
    getAppCheckToken,
    installXHRInterceptor
} from './app-check-module.js';

import { setupSessionManager } from './session-manager.js';

// 全局變數用於追蹤狀態
let statusMessageShown = false;

// DOM 元素綁定
document.addEventListener('DOMContentLoaded', function() {
    console.log('正在初始化商家登入頁面...');
    
    // 檢查 App Check 狀態
    setTimeout(async () => {
        console.log('正在檢查 App Check 狀態...');
        try {
            const result = await checkAppCheckStatus();
            if (result.success) {
                console.log('App Check 驗證成功！');
            } else {
                console.error('App Check 驗證失敗，可能導致未經驗證的請求錯誤');
                // 添加錯誤提示到頁面
                addAppCheckWarning();
            }
        } catch (error) {
            console.error('檢查 App Check 狀態時發生錯誤:', error);
        }
    }, 1000);
    
    // 登入表單處理
    const loginForm = document.getElementById('businessLoginForm');
    if (loginForm) {
        console.log('submit');
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // 註冊按鈕事件
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', function() {
            window.location.href = 'business-register.html';
        });
    }
    
    // 註冊連結事件
    const signupLink = document.getElementById('signupLink');
    if (signupLink) {
        signupLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'business-register.html';
        });
    }
    
    // 密碼顯示/隱藏切換
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            const passwordInput = document.getElementById('password');
            const icon = this.querySelector('i');
            
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
        forgotPassword.addEventListener('click', handleResetPassword);
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
    
    // 檢查登入狀態，如果已登入且有重定向信息，則執行重定向
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
    // 初始化會話管理器
    const sessionManager = setupSessionManager();
});

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
        <strong>注意:</strong> App Check 驗證未完成，這可能導致請求被拒絕。
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
    loginForm.parentNode.insertBefore(successAlert, loginForm);
    
    // 5秒后自動移除
    setTimeout(() => {
        successAlert.remove();
    }, 5000);
}

// 登入處理函數 - 添加 App Check 令牌
async function handleLogin(e) {
    e.preventDefault();
    
    // 獲取輸入值
    const email = sanitizeInput(document.getElementById('email').value);
    const password = document.getElementById('password').value;
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
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 登入中...';
    submitButton.disabled = true;
    
    // 先檢查 App Check
    try {
        console.log('登入前檢查 App Check 狀態...');
        const appCheckResult = await checkAppCheckStatus();
        
        if (!appCheckResult.success) {
            console.warn('App Check 驗證失敗，但仍將嘗試登入');
            // 添加標誌，指示 App Check 失敗但允許登入嘗試
            window.appCheckFailed = true;
        } else {
            console.log('App Check 驗證成功，繼續登入流程');
            window.appCheckFailed = false;
            // 設置 XHR 攔截器來添加 App Check 令牌
            installXHRInterceptor();
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
            await sendEmailVerification(user);
            await signOut(auth);
            
            // 顯示錯誤訊息
            showError('您的電子郵件尚未驗證，我們已發送一封新的驗證郵件，請完成驗證後再登入');
            
            // 重置按鈕
            submitButton.innerHTML = originalButtonText;
            submitButton.disabled = false;
            
            return;
        }
        
        // 檢查是否為店家
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
            await signOut(auth);
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
                        await checkAppCheckStatus();
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
    }
}

// 處理忘記密碼
async function handleResetPassword(e) {
    e.preventDefault();
    
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
    document.getElementById('sendResetEmailBtn').addEventListener('click', async function() {
        const resetEmail = document.getElementById('resetEmail').value;
        
        if (!resetEmail) {
            document.getElementById('resetPasswordAlert').style.display = 'block';
            document.getElementById('resetPasswordAlert').classList.add('alert-danger');
            document.getElementById('resetPasswordAlert').classList.remove('alert-success');
            document.getElementById('resetPasswordAlert').textContent = '請輸入電子郵件';
            return;
        }
        
        // 檢查 App Check 狀態
        try {
            await checkAppCheckStatus();
        } catch (error) {
            console.warn('重設密碼前檢查 App Check 失敗:', error);
        }
        
        try {
            // 發送重設密碼郵件
            await sendPasswordResetEmail(auth, resetEmail);
            
            // 顯示成功訊息
            document.getElementById('resetPasswordAlert').style.display = 'block';
            document.getElementById('resetPasswordAlert').classList.remove('alert-danger');
            document.getElementById('resetPasswordAlert').classList.add('alert-success');
            document.getElementById('resetPasswordAlert').textContent = '重設密碼郵件已發送，請查收您的信箱';
            
            // 禁用發送按鈕
            document.getElementById('sendResetEmailBtn').disabled = true;
            
            // 3秒後關閉模態對話框
            setTimeout(function() {
                resetModal.hide();
                
                // 移除模態對話框
                setTimeout(function() {
                    document.getElementById('resetPasswordModal').remove();
                }, 500);
            }, 3000);
        } catch (error) {
            console.error('發送重設密碼郵件時發生錯誤:', error);
            
            // 顯示錯誤訊息
            document.getElementById('resetPasswordAlert').style.display = 'block';
            document.getElementById('resetPasswordAlert').classList.add('alert-danger');
            document.getElementById('resetPasswordAlert').classList.remove('alert-success');
            
            if (error.code === 'auth/user-not-found') {
                document.getElementById('resetPasswordAlert').textContent = '找不到該電子郵件對應的帳戶';
            } else {
                document.getElementById('resetPasswordAlert').textContent = '發送重設密碼郵件時發生錯誤，請稍後再試';
            }
        }
    });
}

// 在登入成功後 檢查店家審核狀態
async function checkBusinessStatus(userId) {
    try {
        // 避免重複檢查
        if (statusMessageShown) return;
        
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
                await signOut(auth);
            }, 2000);
        }
    } catch (error) {
        console.error('檢查審核狀態時發生錯誤:', error);
    }
}

// 輸入清理函數
function sanitizeInput(input) {
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
    loginForm.parentNode.insertBefore(errorAlert, loginForm);
    
    // 設置錯誤訊息
    errorAlert.textContent = message;
    
    // 自動滾動到錯誤訊息
    errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
                        await signOut(auth);
                        window.location.reload(); // 登出後重新加載頁面
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
            await checkAppCheckStatus();
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

// 使輔助函數可在全局範圍內使用
window.sanitizeInput = sanitizeInput;
window.handleLogin = handleLogin;
window.handleResetPassword = handleResetPassword;
window.showError = showError;
window.clearErrorMessage = clearErrorMessage;
window.checkBusinessStatus = checkBusinessStatus;
window.reapplyForApproval = reapplyForApproval;