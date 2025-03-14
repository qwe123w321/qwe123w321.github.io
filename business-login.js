// business-login.js - 使用 ES 模組方式 (CDN 版本)
import { 
    auth, 
    db, 
    onAuthStateChanged, 
    doc, 
    getDoc, 
    printAppCheckStatus,
    getAndAttachAppCheckToken 
} from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    sendEmailVerification, 
    sendPasswordResetEmail 
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';

// 全局變數用於追蹤狀態
let statusMessageShown = false;

// DOM 元素綁定
document.addEventListener('DOMContentLoaded', function() {
    console.log('正在初始化商家登入頁面...');
    
    // 檢查 App Check 狀態
    setTimeout(async () => {
        console.log('正在檢查 App Check 狀態...');
        try {
            const result = await printAppCheckStatus();
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
        if (user) {
            console.log('檢測到用戶已登入:', user.email);
            // 用戶已登入，檢查審核狀態
            setTimeout(() => {
                checkBusinessStatus(user.uid);
            }, 500); // 延遲執行，確保 DOM 已完全準備好
        } else {
            console.log('未檢測到已登入用戶');
        }
    });
});

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
                    
                    const result = await printAppCheckStatus();
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
    const rememberMe = document.getElementById('rememberMe').checked;
    
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
        const appCheckResult = await printAppCheckStatus();
        
        if (!appCheckResult.success) {
            console.warn('App Check 驗證失敗，但仍將嘗試登入');
        } else {
            console.log('App Check 驗證成功，繼續登入流程');
        }
    } catch (error) {
        console.error('App Check 檢查失敗:', error);
        // 仍然繼續嘗試登入
    }
    
    try {
        // 嘗試獲取 App Check 令牌
        await getAndAttachAppCheckToken();
        
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
                        await printAppCheckStatus();
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
            await printAppCheckStatus();
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
                // 添加日誌便於調試
                console.log('登入成功：商家已通過審核，重定向到儀表板');
                
                // 通過審核，重定向到店家後台
                window.location.href = 'business-dashboard.html';
            } else if (businessData.status === 'pending') {
                // 審核中，顯示等待訊息
                console.log('登入成功：商家審核中');
                showStatusMessage('pending');
            } else if (businessData.status === 'rejected') {
                // 審核未通過，顯示原因
                console.log('登入失敗：商家審核未通過');
                showStatusMessage('rejected', businessData.rejectReason || '未提供拒絕原因');
            }
        } else {
            // 找不到店家資料，登出並顯示錯誤
            console.error('找不到店家資料');
            await signOut(auth);
            showError('找不到店家資料，請聯繫客服');
        }
    } catch (error) {
        console.error('檢查審核狀態時發生錯誤:', error);
        showError('檢查審核狀態時發生錯誤，請稍後再試');
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