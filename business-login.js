// business-login.js - 使用 ES 模組方式
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, collection } from 'firebase/firestore';

// DOM 元素綁定
document.addEventListener('DOMContentLoaded', function() {
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
});

// 登入處理函數
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
    
    try {
        // 使用 Firebase Auth 登入
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 檢查郵箱是否已驗證
        if (!user.emailVerified) {
            // 未驗證，發送新的驗證郵件
            await user.sendEmailVerification();
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
        
        try {
            // 發送重設密碼郵件
            await auth.sendPasswordResetEmail(resetEmail);
            
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
                        await firebase.auth().signOut();
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

// 導出函數，以便其他模組使用
export { handleLogin, handleResetPassword, showError, clearErrorMessage, showStatusMessage };