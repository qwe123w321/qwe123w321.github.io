// firebase-register.js - 整合 business-register.html 中的所有 JS 功能
import { auth, db, storage, doc, collection, onAuthStateChanged } from './firebase-config.js';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
import { setDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-functions.js';

// 導入 App Check 模組的功能
import { 
    checkAppCheckStatus, 
    getAppCheckToken, 
    installXHRInterceptor,
    installFetchInterceptor,
    runFullDiagnostics,
    addDiagnosticsPanel
} from './app-check-module.js';

// ===== 驗證相關函數 =====

// 檢查欄位是否為空
function isEmpty(value) {
    return value === null || value === undefined || value.trim() === '';
}

// 驗證電子郵件格式
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 驗證電話號碼格式 (台灣)
function isValidPhone(phone) {
    const cleanedPhone = phone.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^(0[2-9]\d{7,8}|09\d{8})$/;
    return phoneRegex.test(cleanedPhone);
}

// 驗證密碼強度
function isStrongPassword(password) {
    // 至少8個字符，並包含至少一個數字和一個字母
    return password.length >= 8 && /[0-9]/.test(password) && /[a-zA-Z]/.test(password);
}

// 顯示欄位錯誤
function showFieldError(field, message) {
    // 清除之前的錯誤
    clearFieldError(field);
    
    // 創建錯誤提示
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error-message text-danger mt-1';
    errorDiv.innerHTML = `<small><i class="fas fa-exclamation-circle"></i> ${message}</small>`;
    
    // 對於 checkbox 特殊處理
    if (field.type === 'checkbox') {
        field.parentNode.parentNode.appendChild(errorDiv);
    } else {
        field.parentNode.appendChild(errorDiv);
    }
    
    // 添加錯誤樣式
    field.classList.add('is-invalid');
}

// 清除欄位錯誤
function clearFieldError(field) {
    field.classList.remove('is-invalid');
    
    const parent = (field.type === 'checkbox') ? field.parentNode.parentNode : field.parentNode;
    const errorMessage = parent.querySelector('.field-error-message');
    if (errorMessage) {
        errorMessage.remove();
    }
}

// 獲取 Firebase Functions 實例
const functions = getFunctions();

// 創建可調用函數引用
const checkEmailAvailability = httpsCallable(functions, 'checkEmailAvailability');

// 檢查電子郵件是否可用（未被註冊）
async function validateEmail(email) {
    try {
        const result = await checkEmailAvailability({ data: { email } });
        return result.data;
    } catch (error) {
        console.error('檢查電子郵件可用性時發生錯誤:', error);
        throw error;
    }
}

// 驗證某個步驟的所有欄位
async function validateStep(stepNumber) {
    let isValid = true;
    
    if (stepNumber === 1) {
        // 驗證第一步：電子郵件和密碼
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        
        if (!email.value) {
            showFieldError(email, '請輸入電子郵件');
            isValid = false;
        } else if (!isValidEmail(email.value)) {
            showFieldError(email, '請輸入有效的電子郵件格式');
            isValid = false;
        } else {
            clearFieldError(email);
            
            // 檢查電子郵件是否可用
            try {
                const nextButton = document.querySelector('.btn-next[data-step="1"]');
                const originalText = nextButton.textContent;
                nextButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 檢查中...';
                nextButton.disabled = true;
                
                const result = await validateEmail(email.value);
                
                nextButton.textContent = originalText;
                nextButton.disabled = false;
                
                if (!result.available) {
                    showFieldError(email, '此電子郵件已被註冊，請使用其他電子郵件');
                    isValid = false;
                }
            } catch (error) {
                console.error('驗證電子郵件時發生錯誤:', error);
                
                // 恢復按鈕狀態
                const nextButton = document.querySelector('.btn-next[data-step="1"]');
                nextButton.textContent = '下一步';
                nextButton.disabled = false;
                
                showFieldError(email, '驗證電子郵件時發生錯誤，請稍後再試');
                isValid = false;
            }
        }
        
        if (!password.value) {
            showFieldError(password, '請輸入密碼');
            isValid = false;
        } else if (!isStrongPassword(password.value)) {
            showFieldError(password, '密碼長度至少需要8個字元，且包含數字和字母');
            isValid = false;
        } else {
            clearFieldError(password);
        }
        
        if (!confirmPassword.value) {
            showFieldError(confirmPassword, '請再次輸入密碼');
            isValid = false;
        } else if (password.value !== confirmPassword.value) {
            showFieldError(confirmPassword, '兩次輸入的密碼不一致');
            isValid = false;
        } else {
            clearFieldError(confirmPassword);
        }
    } else if (stepNumber === 2) {
        // 驗證第二步：店家資訊
        const businessName = document.getElementById('businessName');
        const businessType = document.getElementById('businessType');
        const businessAddress = document.getElementById('businessAddress');
        const businessPhone = document.getElementById('businessPhone');
        
        if (!businessName.value) {
            showFieldError(businessName, '請輸入店家名稱');
            isValid = false;
        } else {
            clearFieldError(businessName);
        }
        
        if (!businessType.value) {
            showFieldError(businessType, '請選擇店家類型');
            isValid = false;
        } else {
            clearFieldError(businessType);
        }
        
        if (!businessAddress.value) {
            showFieldError(businessAddress, '請輸入店家地址');
            isValid = false;
        } else {
            clearFieldError(businessAddress);
        }
        
        if (!businessPhone.value) {
            showFieldError(businessPhone, '請輸入店家電話');
            isValid = false;
        } else if (!isValidPhone(businessPhone.value)) {
            showFieldError(businessPhone, '請輸入有效的電話號碼');
            isValid = false;
        } else {
            clearFieldError(businessPhone);
        }
    } else if (stepNumber === 3) {
        // 驗證第三步：聯絡人與條款
        const contactName = document.getElementById('contactName');
        const contactPhone = document.getElementById('contactPhone');
        const termsCheck = document.getElementById('termsCheck');
        
        if (!contactName.value) {
            showFieldError(contactName, '請輸入聯絡人姓名');
            isValid = false;
        } else {
            clearFieldError(contactName);
        }
        
        if (!contactPhone.value) {
            showFieldError(contactPhone, '請輸入聯絡人電話');
            isValid = false;
        } else if (!isValidPhone(contactPhone.value)) {
            showFieldError(contactPhone, '請輸入有效的電話號碼');
            isValid = false;
        } else {
            clearFieldError(contactPhone);
        }
        
        if (!termsCheck.checked) {
            showFieldError(termsCheck, '請同意服務條款與隱私政策');
            isValid = false;
        } else {
            clearFieldError(termsCheck);
        }
    }
    
    return isValid;
}

// ===== 檔案上傳相關 =====

// 存儲上傳的檔案
let uploadedFiles = [];

// 上傳營業執照檔案
function uploadBusinessLicense() {
    const fileInput = document.getElementById('businessLicense');
    const uploadPreview = document.getElementById('uploadPreview');
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // 檢查檔案類型
        if (!file.type.match('image.*')) {
            alert('請上傳圖片格式的檔案！');
            return;
        }
        
        // 檢查檔案大小 (限制為 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('檔案大小不能超過 5MB！');
            return;
        }
        
        // 建立唯一的檔案名稱
        const timestamp = new Date().getTime();
        const fileName = `license_${timestamp}_${file.name}`;
        
        // 加入到上傳檔案列表
        uploadedFiles.push({
            file: file,
            fileName: fileName,
            preview: URL.createObjectURL(file)
        });
        
        // 更新預覽區域
        updateUploadPreview();
        
        // 重置檔案輸入框
        fileInput.value = '';
    }
}

// 更新上傳預覽區域
function updateUploadPreview() {
    const uploadPreview = document.getElementById('uploadPreview');
    uploadPreview.innerHTML = '';
    
    if (uploadedFiles.length === 0) {
        uploadPreview.innerHTML = '<p class="text-muted">尚未上傳任何檔案</p>';
        return;
    }
    
    // 創建檔案預覽元素
    uploadedFiles.forEach((uploadedFile, index) => {
        const previewCard = document.createElement('div');
        previewCard.className = 'card mb-2';
        previewCard.style.maxWidth = '320px';
        
        previewCard.innerHTML = `
            <div class="card-body p-2">
                <div class="d-flex align-items-center">
                    <div class="flex-shrink-0 me-3">
                        <img src="${uploadedFile.preview}" alt="預覽" class="img-thumbnail" style="width: 80px; height: 60px; object-fit: cover;">
                    </div>
                    <div class="flex-grow-1">
                        <p class="card-text small mb-1 text-truncate">${uploadedFile.file.name}</p>
                        <p class="card-text small mb-0 text-muted">${formatFileSize(uploadedFile.file.size)}</p>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeUploadedFile(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        
        uploadPreview.appendChild(previewCard);
    });
}

// 移除已上傳檔案
function removeUploadedFile(index) {
    if (index >= 0 && index < uploadedFiles.length) {
        // 釋放 URL 對象
        URL.revokeObjectURL(uploadedFiles[index].preview);
        
        // 從列表中移除
        uploadedFiles.splice(index, 1);
        
        // 更新預覽
        updateUploadPreview();
    }
}

// 獲取已上傳的檔案
function getUploadedBusinessLicenseFiles() {
    return uploadedFiles;
}

// 格式化檔案大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
}

// ===== 表單步驟控制 =====

// 切換到下一步
async function nextStep(currentStep) {
    console.log(`嘗試進入下一步: 從第 ${currentStep} 步到第 ${currentStep + 1} 步`);
    
    // 驗證當前步驟
    if (await validateStep(currentStep)) {
        const nextStep = currentStep + 1;
        
        // 切換步驟內容
        document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
        document.getElementById(`step-${nextStep}-content`).classList.add('active');
        
        // 更新進度指示器
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        document.getElementById(`step-${nextStep}`).classList.add('active');
        
        // 如果是最後一步，顯示提交按鈕
        if (nextStep === 3) {
            document.querySelector('.btn-submit').style.display = 'block';
        }
        
        // 滾動到頂部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// 返回上一步
function prevStep(currentStep) {
    if (currentStep > 1) {
        const prevStep = currentStep - 1;
        
        // 切換步驟內容
        document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
        document.getElementById(`step-${prevStep}-content`).classList.add('active');
        
        // 更新進度指示器
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        document.getElementById(`step-${prevStep}`).classList.add('active');
        
        // 隱藏提交按鈕
        document.querySelector('.btn-submit').style.display = 'none';
        
        // 滾動到頂部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ===== 註冊表單提交 =====

// 處理註冊表單提交
async function handleRegisterSubmit(e) {
    e.preventDefault();
    
    // 檢查第三步的必填字段是否已填寫
    if (!await validateStep(3)) {
        return;
    }
    
    // 禁用提交按鈕防止重複提交
    const submitButton = document.querySelector('.btn-submit');
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 處理中...';
    submitButton.disabled = true;
    
    try {
        // 先檢查 App Check 狀態
        console.log('註冊前再次檢查 App Check 狀態...');
        const appCheckResult = await checkAppCheckStatus();
        
        if (!appCheckResult.success) {
            console.warn('App Check 驗證失敗，註冊可能會被拒絕');
            
            // 顯示警告但允許繼續嘗試
            const warningDiv = document.createElement('div');
            warningDiv.className = 'alert alert-warning mt-3';
            warningDiv.innerHTML = `
                <strong>警告:</strong> App Check 驗證失敗，但仍將嘗試註冊。如果失敗，請刷新頁面後重試。
            `;
            document.querySelector('.register-form-header').after(warningDiv);
        } else {
            console.log('App Check 驗證成功，繼續註冊流程');
            
            // 確保攔截器已安裝
            installXHRInterceptor();
            installFetchInterceptor();
        }
        
        // 獲取表單數據
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const businessName = document.getElementById('businessName').value;
        const businessType = document.getElementById('businessType').value;
        const businessAddress = document.getElementById('businessAddress').value;
        const businessPhone = document.getElementById('businessPhone').value;
        const contactName = document.getElementById('contactName').value;
        const contactPhone = document.getElementById('contactPhone').value;
        
        console.log("提交表單資料:", {email, businessName, businessType});
        
        // 等待 App Check 令牌取得後再繼續
        const appCheckToken = await getAppCheckToken();
        if (!appCheckToken) {
            console.warn('未能獲取有效的 App Check 令牌，但仍嘗試繼續');
        } else {
            console.log('成功獲取 App Check 令牌，繼續註冊流程');
        }
        
        // 1. 創建 Firebase 用戶
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 2. 發送驗證郵件
        await sendEmailVerification(user);
        
        // 3. 確保用戶已完全認證
        await new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (authUser) => {
                if (authUser) {
                    unsubscribe();
                    resolve();
                }
            });
        });
        
        // 4. 存儲店家資訊到 Firestore
        await setDoc(doc(db, 'businesses', user.uid), {
            businessName: businessName,
            businessType: businessType,
            address: businessAddress,
            phoneNumber: businessPhone,
            contactName: contactName,
            contactPhone: contactPhone,
            ownerId: user.uid,
            status: 'pending', 
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // 5. 處理營業執照上傳
        let licenseUrls = [];
        
        if (uploadedFiles.length > 0) {
            // 建立照片URL陣列
            for (const uploadedFile of uploadedFiles) {
                const file = uploadedFile.file;
                const storageReference = ref(storage, `licenses/${user.uid}/${uploadedFile.fileName}`);
                
                // 上傳檔案
                await uploadBytes(storageReference, file);
                
                // 獲取下載 URL
                const licenseUrl = await getDownloadURL(storageReference);
                licenseUrls.push(licenseUrl);
            }
            
            // 更新店家文檔添加執照 URL 數組
            await updateDoc(doc(db, 'businesses', user.uid), {
                licenseUrls: licenseUrls
            });
        }
        
        // 6. 創建審核請求
        await setDoc(doc(db, 'businessApprovalRequests', user.uid), {
            userId: user.uid,
            businessName: businessName,
            businessType: businessType,
            address: businessAddress,
            phoneNumber: businessPhone,
            contactName: contactName,
            contactPhone: contactPhone,
            licenseUrls: licenseUrls,
            status: 'pending',
            rejectReason: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // 7. 登出用戶（因為需要等待審核）
        await auth.signOut();
        
        // 顯示成功訊息
        const successAlert = document.createElement('div');
        successAlert.className = 'alert alert-success mt-4';
        successAlert.innerHTML = `
            <h5>註冊申請已成功提交！</h5>
            <p>我們將盡快審核您的申請，並請確認您的郵箱完成驗證。</p>
            <p>5秒後將自動跳轉到登入頁面...</p>
        `;
        document.querySelector('.register-form-container').appendChild(successAlert);
        
        // 5秒後跳轉到登入頁面
        setTimeout(() => {
            window.location.href = 'business-login.html?status=registered';
        }, 5000);
        
    } catch (error) {
        console.error('註冊時發生錯誤:', error);
        
        // 恢復按鈕狀態
        submitButton.innerHTML = '提交註冊';
        submitButton.disabled = false;
        
        // 顯示錯誤訊息
        let errorMessage = '註冊過程中發生錯誤，請稍後再試';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = '此電子郵件已被使用';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = '無效的電子郵件格式';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = '密碼強度不夠，請設置更複雜的密碼';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = '網絡連接失敗，請檢查您的網絡連接';
        } else if (error.code === 'auth/firebase-app-check-token-is-invalid') {
            errorMessage = 'App Check 驗證失敗。請刷新頁面後重試，或檢查您的瀏覽器設置。';
            
            // 添加 App Check 診斷按鈕
            setTimeout(() => {
                const errorAlert = document.querySelector('.register-error-alert');
                if (errorAlert) {
                    const diagBtn = document.createElement('button');
                    diagBtn.className = 'btn btn-sm btn-warning mt-2';
                    diagBtn.textContent = '執行 App Check 診斷';
                    diagBtn.addEventListener('click', async function() {
                        // 重新檢查 App Check 狀態
                        this.disabled = true;
                        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 診斷中...';
                        
                        const result = await checkAppCheckStatus();
                        
                        if (result.success) {
                            alert('App Check 診斷結果: 驗證成功！請重新嘗試註冊。');
                            window.location.reload(); // 自動刷新頁面
                        } else {
                            alert(`App Check 診斷結果: 驗證失敗。\n錯誤信息: ${result.error || '未知錯誤'}`);
                            this.disabled = false;
                            this.textContent = '重新診斷';
                            
                            // 添加高級診斷選項
                            const advDiagBtn = document.createElement('button');
                            advDiagBtn.className = 'btn btn-sm btn-danger mt-2 ms-2';
                            advDiagBtn.textContent = '高級診斷';
                            advDiagBtn.addEventListener('click', function() {
                                addDiagnosticsPanel();
                            });
                            errorAlert.appendChild(advDiagBtn);
                        }
                    });
                    errorAlert.appendChild(diagBtn);
                }
            }, 100);
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        // 添加錯誤提示元素（如果不存在）
        let errorAlert = document.querySelector('.register-error-alert');
        if (!errorAlert) {
            errorAlert = document.createElement('div');
            errorAlert.className = 'alert alert-danger register-error-alert mt-3';
            errorAlert.role = 'alert';
            document.querySelector('.register-form-header').after(errorAlert);
        }
        
        errorAlert.textContent = errorMessage;
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// ===== 密碼顯示/隱藏功能 =====

function togglePasswordVisibility(inputId, toggleBtnId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = document.getElementById(toggleBtnId);
    const icon = toggleButton.querySelector('i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// ===== 頁面初始化 =====

document.addEventListener('DOMContentLoaded', function() {
    console.log('註冊頁面正在初始化...');
    
    // 檢查 App Check 狀態
    setTimeout(async () => {
        try {
            const statusElement = document.getElementById('appCheckStatus');
            if (statusElement) {
                statusElement.className = 'initializing';
                statusElement.textContent = 'App Check: 初始化中...';
                statusElement.style.display = 'block';
            }
            
            console.log('註冊頁面正在檢查 App Check 狀態...');
            const result = await checkAppCheckStatus();
            
            if (result.success) {
                console.log('App Check 驗證成功！註冊流程可以正常進行');
                
                if (statusElement) {
                    statusElement.className = 'success';
                    statusElement.textContent = 'App Check: 已驗證 ✓';
                    setTimeout(() => { statusElement.style.display = 'none'; }, 3000);
                }
                
                // 安裝 XHR 和 fetch 攔截器
                installXHRInterceptor();
                installFetchInterceptor();
            } else {
                console.warn('App Check 驗證失敗，註冊可能會被拒絕:', result.error);
                
                if (statusElement) {
                    statusElement.className = 'error';
                    statusElement.textContent = 'App Check: 驗證失敗 ✗';
                    setTimeout(() => { statusElement.style.display = 'none'; }, 5000);
                }
                
                // 添加警告提示
                const registerForm = document.getElementById('businessRegisterForm');
                if (registerForm) {
                    const warningDiv = document.createElement('div');
                    warningDiv.className = 'alert alert-warning mt-3';
                    warningDiv.innerHTML = `
                        <strong>注意:</strong> 安全驗證失敗，註冊功能可能無法正常使用。
                        <button type="button" class="btn btn-sm btn-warning mt-2" id="retryAppCheck">重新嘗試驗證</button>
                    `;
                    
                    const formHeader = document.querySelector('.register-form-header');
                    if (formHeader) {
                        formHeader.after(warningDiv);
                        
                        // 添加重試按鈕事件
                        setTimeout(() => {
                            const retryBtn = document.getElementById('retryAppCheck');
                            if (retryBtn) {
                                retryBtn.addEventListener('click', async () => {
                                    await checkAppCheckStatus();
                                    window.location.reload(); // 重新載入頁面
                                });
                            }
                        }, 100);
                    }
                }
            }
        } catch (error) {
            console.error('檢查 App Check 狀態時發生錯誤:', error);
        }
    }, 1000);
    
    // 獲取註冊表單
    const registerForm = document.getElementById('businessRegisterForm');
    
    if (registerForm) {
        // 註冊表單提交事件
        registerForm.addEventListener('submit', handleRegisterSubmit);
        
        // 下一步按鈕點擊事件
        const nextButtons = document.querySelectorAll('.btn-next');
        nextButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const currentStep = parseInt(this.getAttribute('data-step'));
                nextStep(currentStep);
            });
        });
        
        // 上一步按鈕點擊事件
        const prevButtons = document.querySelectorAll('.btn-prev');
        prevButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const currentStep = parseInt(this.getAttribute('data-step'));
                prevStep(currentStep);
            });
        });
        
        // 文件上傳按鈕點擊事件
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', function(e) {
                e.preventDefault();
                document.getElementById('businessLicense').click();
            });
        }
        
        // 文件選擇變更事件
        const fileInput = document.getElementById('businessLicense');
        if (fileInput) {
            fileInput.addEventListener('change', uploadBusinessLicense);
        }
        
        // 密碼顯示/隱藏按鈕點擊事件
        const togglePassword = document.getElementById('togglePassword');
        if (togglePassword) {
            togglePassword.addEventListener('click', function() {
                togglePasswordVisibility('password', 'togglePassword');
            });
        }
        
        const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
        if (toggleConfirmPassword) {
            toggleConfirmPassword.addEventListener('click', function() {
                togglePasswordVisibility('confirmPassword', 'toggleConfirmPassword');
            });
        }
        
        // 初始化上傳預覽區域
        updateUploadPreview();
    }
    
    // 添加診斷按鈕
    const diagnosticsBtn = document.createElement('button');
    diagnosticsBtn.id = 'appCheckDiagnosticsBtn';
    diagnosticsBtn.innerHTML = '🔍';
    diagnosticsBtn.title = 'App Check 診斷';
    diagnosticsBtn.style.position = 'fixed';
    diagnosticsBtn.style.bottom = '20px';
    diagnosticsBtn.style.right = '20px';
    diagnosticsBtn.style.width = '50px';
    diagnosticsBtn.style.height = '50px';
    diagnosticsBtn.style.borderRadius = '50%';
    diagnosticsBtn.style.backgroundColor = '#007bff';
    diagnosticsBtn.style.color = 'white';
    diagnosticsBtn.style.border = 'none';
    diagnosticsBtn.style.fontSize = '20px';
    diagnosticsBtn.style.display = 'flex';
    diagnosticsBtn.style.alignItems = 'center';
    diagnosticsBtn.style.justifyContent = 'center';
    diagnosticsBtn.style.cursor = 'pointer';
    diagnosticsBtn.style.zIndex = '9999';
    diagnosticsBtn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    
    // 添加點擊事件
    diagnosticsBtn.addEventListener('click', () => {
        addDiagnosticsPanel();
        diagnosticsBtn.style.display = 'none';
    });
    
    // 添加到頁面
    document.body.appendChild(diagnosticsBtn);
});

// ===== 導出公共函數到全局作用域 =====

// 驗證函數
window.validateStep = validateStep;
window.validateEmail = validateEmail;
window.isValidEmail = isValidEmail;
window.isValidPhone = isValidPhone;
window.isStrongPassword = isStrongPassword;
window.showFieldError = showFieldError;
window.clearFieldError = clearFieldError;

// 表單步驟控制
window.nextStep = nextStep;
window.prevStep = prevStep;

// 檔案上傳
window.uploadBusinessLicense = uploadBusinessLicense;
window.removeUploadedFile = removeUploadedFile;
window.getUploadedBusinessLicenseFiles = getUploadedBusinessLicenseFiles;
window.updateUploadPreview = updateUploadPreview;
window.formatFileSize = formatFileSize;

// 密碼顯示/隱藏
window.togglePasswordVisibility = togglePasswordVisibility;

// 註冊表單提交
window.handleRegisterSubmit = handleRegisterSubmit;