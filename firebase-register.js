// firebase-register.js - 整合 business-register.html 中的所有 JS 功能
console.log("開始加載 firebase-register.js");

// 立即宣告核心函數，避免順序依賴問題
var nextStep, prevStep, validateStep, togglePasswordVisibility, updatePasswordStrength, updatePasswordRulesCheck;
var handleRegisterSubmit, isEmpty, isValidEmail, isValidPhone, isStrongPassword;
var showFieldError, clearFieldError, removeUploadedFile, enhancedUploadPreview, formatFileSize;

// 全局變量存儲上傳的檔案
var uploadedFiles = [];

// 立即確保基本函數可用於全局
function initializeGlobalFunctions() {
    // 基本的檢查函數
    isEmpty = function(value) {
        return value === null || value === undefined || value.trim() === '';
    };
    
    isValidEmail = function(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };
    
    isValidPhone = function(phone) {
        const cleanedPhone = phone.replace(/[\s\-\(\)]/g, '');
        const phoneRegex = /^(0[2-9]\d{7,8}|09\d{8})$/;
        return phoneRegex.test(cleanedPhone);
    };
    
    isStrongPassword = function(password) {
        return password.length >= 8 && /[0-9]/.test(password) && /[a-zA-Z]/.test(password);
    };
    
    // 錯誤顯示函數
    showFieldError = function(field, message) {
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
    };
    
    clearFieldError = function(field) {
        field.classList.remove('is-invalid');
        
        const parent = (field.type === 'checkbox') ? field.parentNode.parentNode : field.parentNode;
        const errorMessage = parent.querySelector('.field-error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
    };
    
    // 導出所有基本函數到全局
    window.isEmpty = isEmpty;
    window.isValidEmail = isValidEmail;
    window.isValidPhone = isValidPhone;
    window.isStrongPassword = isStrongPassword;
    window.showFieldError = showFieldError;
    window.clearFieldError = clearFieldError;
    
    console.log("基本工具函數已初始化並導出到全局");
}

// 立即執行初始化
initializeGlobalFunctions();

// 開始導入模組
// 使用try-catch確保即使導入失敗，頁面仍可運作
let auth, db, storage, doc, collection, onAuthStateChanged;
let createUserWithEmailAndPassword, sendEmailVerification;
let setDoc, updateDoc, serverTimestamp;
let ref, uploadBytes, getDownloadURL;
let getFunctions, httpsCallable;
let checkAppCheckStatus, getAppCheckToken, installXHRInterceptor, installFetchInterceptor, runFullDiagnostics, addDiagnosticsPanel;
let setupSessionManager;

try {
    // 主要導入
    import('./firebase-config.js').then(module => {
        auth = module.auth;
        db = module.db;
        storage = module.storage;
        doc = module.doc;
        collection = module.collection;
        onAuthStateChanged = module.onAuthStateChanged;
        console.log("Firebase 配置模組導入成功");
    }).catch(error => {
        console.error("Firebase 配置模組導入失敗:", error);
    });

    // Firebase 認證
    import('https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js').then(module => {
        createUserWithEmailAndPassword = module.createUserWithEmailAndPassword;
        sendEmailVerification = module.sendEmailVerification;
        console.log("Firebase 認證模組導入成功");
    }).catch(error => {
        console.error("Firebase 認證模組導入失敗:", error);
    });

    // Firestore
    import('https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js').then(module => {
        setDoc = module.setDoc;
        updateDoc = module.updateDoc;
        serverTimestamp = module.serverTimestamp;
        console.log("Firestore 模組導入成功");
    }).catch(error => {
        console.error("Firestore 模組導入失敗:", error);
    });

    // Storage
    import('https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js').then(module => {
        ref = module.ref;
        uploadBytes = module.uploadBytes;
        getDownloadURL = module.getDownloadURL;
        console.log("Storage 模組導入成功");
    }).catch(error => {
        console.error("Storage 模組導入失敗:", error);
    });

    // Functions
    import('https://www.gstatic.com/firebasejs/9.6.0/firebase-functions.js').then(module => {
        getFunctions = module.getFunctions;
        httpsCallable = module.httpsCallable;
        console.log("Functions 模組導入成功");
    }).catch(error => {
        console.error("Functions 模組導入失敗:", error);
    });

    // App Check 模組
    import('./app-check-module.js').then(module => {
        checkAppCheckStatus = module.checkAppCheckStatus;
        getAppCheckToken = module.getAppCheckToken;
        installXHRInterceptor = module.installXHRInterceptor;
        installFetchInterceptor = module.installFetchInterceptor;
        runFullDiagnostics = module.runFullDiagnostics;
        addDiagnosticsPanel = module.addDiagnosticsPanel;
        console.log("App Check 模組導入成功");
    }).catch(error => {
        console.error("App Check 模組導入失敗:", error);
    });

    // 會話管理
    import('./session-manager.js').then(module => {
        setupSessionManager = module.setupSessionManager;
        console.log("會話管理模組導入成功");
    }).catch(error => {
        console.error("會話管理模組導入失敗:", error);
    });

} catch (error) {
    console.error("模組導入過程中出現錯誤:", error);
}

console.log("所有模塊已導入");

// 確保所有函數導出到全局作用域
function ensureGlobalFunctions() {
    console.log("確保函數導出到全局作用域", new Date().toISOString());
    
    // 建立函數並立即導出
    
    // === 表單步驟控制 ===
    nextStep = async function(currentStep) {
        console.log(`嘗試進入下一步: 從第 ${currentStep} 步到第 ${currentStep + 1} 步`);
        
        // 使用內部函數進行驗證，避免對外部函數的依賴
        let isValid = true;
        
        try {
            if (typeof validateStep === 'function') {
                isValid = await validateStep(currentStep);
            } else {
                // 內部實現備用驗證邏輯
                if (currentStep === 1) {
                    const email = document.getElementById('email');
                    const password = document.getElementById('password');
                    const confirmPassword = document.getElementById('confirmPassword');
                    
                    if (!email.value || !isValidEmail(email.value)) {
                        showFieldError(email, '請輸入有效的電子郵件');
                        isValid = false;
                    } else {
                        clearFieldError(email);
                    }
                    
                    if (!password.value || password.value.length < 8) {
                        showFieldError(password, '密碼長度至少為8位');
                        isValid = false;
                    } else {
                        clearFieldError(password);
                    }
                    
                    if (password.value !== confirmPassword.value) {
                        showFieldError(confirmPassword, '兩次輸入的密碼不一致');
                        isValid = false;
                    } else {
                        clearFieldError(confirmPassword);
                    }
                } else if (currentStep === 2) {
                    // 簡化的第二步驗證
                    const businessName = document.getElementById('businessName');
                    if (!businessName.value) {
                        showFieldError(businessName, '請輸入店家名稱');
                        isValid = false;
                    } else {
                        clearFieldError(businessName);
                    }
                }
            }
        } catch (error) {
            console.error('驗證時發生錯誤:', error);
            isValid = false;
        }
        
        if (isValid) {
            const nextStep = currentStep + 1;
            
            // 切換步驟內容
            // document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
            // const nextStepContent = document.getElementById(`step-${nextStep}-content`);
            // if (nextStepContent) nextStepContent.classList.add('active');
            document.querySelectorAll('.form-step').forEach(step => {
                step.classList.remove('active');
                // 確保隱藏所有步驟
                step.style.display = 'none';
            });
            const nextStepContent = document.getElementById(`step-${nextStep}-content`);
            if (nextStepContent) {
                nextStepContent.classList.add('active');
                // 明確顯示當前步驟，覆蓋內聯樣式
                nextStepContent.style.display = 'block';
            }
            
            // 更新進度指示器
            document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
            const nextStepIndicator = document.getElementById(`step-${nextStep}`);
            if (nextStepIndicator) nextStepIndicator.classList.add('active');
            
            // 如果是第3步，顯示提交按鈕
            const submitButton = document.querySelector('.btn-submit');
            if (submitButton && nextStep === 3) {
                submitButton.style.display = 'block';
            }
            
            // 如果進入第4步，更新摘要信息
            // if (nextStep === 4) {
            //     try {
            //         if (typeof updateSummaryInfo === 'function') {
            //             updateSummaryInfo();
            //         }
            //     } catch (error) {
            //         console.error('更新摘要信息時發生錯誤:', error);
            //     }
            // }
            if (nextStep === 4) {
                console.log('進入步驟 4，開始更新摘要信息');
                try {
                    if (typeof updateSummaryInfo === 'function') {
                        // 使用 setTimeout 確保 DOM 更新完成後再更新摘要
                        setTimeout(() => {
                            updateSummaryInfo();
                            console.log('摘要信息更新完成');
                        }, 100);
                    } else {
                        console.error('updateSummaryInfo 函數未定義');
                    }
                } catch (error) {
                    console.error('更新摘要信息時發生錯誤:', error);
                }
            }
            
            // 滾動到頂部
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    
    prevStep = function(currentStep) {
        if (currentStep > 1) {
            const prevStep = currentStep - 1;
            
            // 切換步驟內容
            document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
            const prevStepContent = document.getElementById(`step-${prevStep}-content`);
            if (prevStepContent) prevStepContent.classList.add('active');
            
            // 更新進度指示器
            document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
            const prevStepIndicator = document.getElementById(`step-${prevStep}`);
            if (prevStepIndicator) prevStepIndicator.classList.add('active');
            
            // 隱藏提交按鈕
            const submitButton = document.querySelector('.btn-submit');
            if (submitButton) submitButton.style.display = 'none';
            
            // 滾動到頂部
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    
    // === 密碼相關函數 ===
    togglePasswordVisibility = function(inputId, toggleBtnId) {
        const passwordInput = document.getElementById(inputId);
        const toggleButton = document.getElementById(toggleBtnId);
        
        if (!passwordInput || !toggleButton) return;
        
        const icon = toggleButton.querySelector('i');
        
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
    };
    
    // 密碼強度測量函數
    function measurePasswordStrength(password) {
        let strength = 0;
        
        // 檢查長度
        if (password.length >= 8 && password.length <= 20) strength += 2;
        else if (password.length > 0) strength += 1;
        
        // 檢查複雜性
        if (/[a-z]/.test(password)) strength += 1; // 小寫字母
        if (/[A-Z]/.test(password)) strength += 1; // 大寫字母
        if (/[0-9]/.test(password)) strength += 1; // 數字
        
        if (strength < 3) return { strength: 'weak', class: 'bg-danger' };
        if (strength < 5) return { strength: 'medium', class: 'bg-warning' };
        return { strength: 'strong', class: 'bg-success' };
    }
    
    updatePasswordStrength = function() {
        const password = document.getElementById('password')?.value || '';
        const strengthResult = measurePasswordStrength(password);
        
        // 更新強度指示條
        const strengthBar = document.getElementById('password-strength-bar');
        if (strengthBar) {
            strengthBar.className = `progress-bar ${strengthResult.class}`;
            
            // 根據密碼長度和強度設置寬度
            if (password.length === 0) {
                strengthBar.style.width = '0%';
            } else {
                let percentage;
                if (password.length <= 20) {
                    percentage = Math.min(100, (password.length / 20) * 100);
                } else {
                    percentage = 100;
                }
                strengthBar.style.width = `${percentage}%`;
            }
        }
        
        // 更新強度標籤
        const strengthLabel = document.getElementById('password-strength-text');
        if (strengthLabel) {
            if (password.length === 0) {
                strengthLabel.textContent = '';
            } else {
                strengthLabel.textContent = `密碼強度: ${strengthResult.strength === 'weak' ? '弱' : strengthResult.strength === 'medium' ? '中' : '強'}`;
            }
        }
        
        // 更新密碼規則檢查
        if (typeof updatePasswordRulesCheck === 'function') {
            updatePasswordRulesCheck(password);
        } else {
            // 備用的規則檢查實現
            basicUpdatePasswordRulesCheck(password);
        }
    };
    
    // 基本的密碼規則檢查
    function basicUpdatePasswordRulesCheck(password) {
        // 檢查各項規則
        const lengthCheck = password.length >= 8 && password.length <= 20;
        const lowercaseCheck = /[a-z]/.test(password);
        const uppercaseCheck = /[A-Z]/.test(password);
        const numberCheck = /[0-9]/.test(password);
        
        // 更新規則顯示
        const ruleLengthElement = document.getElementById('rule-length');
        const ruleLowercaseElement = document.getElementById('rule-lowercase');
        const ruleUppercaseElement = document.getElementById('rule-uppercase');
        const ruleNumberElement = document.getElementById('rule-number');
        
        if (ruleLengthElement) ruleLengthElement.className = lengthCheck ? 'text-success' : 'text-danger';
        if (ruleLowercaseElement) ruleLowercaseElement.className = lowercaseCheck ? 'text-success' : 'text-danger';
        if (ruleUppercaseElement) ruleUppercaseElement.className = uppercaseCheck ? 'text-success' : 'text-danger';
        if (ruleNumberElement) ruleNumberElement.className = numberCheck ? 'text-success' : 'text-danger';
        
        // 更新圖標
        const ruleLengthIconElement = document.getElementById('rule-length-icon');
        const ruleLowercaseIconElement = document.getElementById('rule-lowercase-icon');
        const ruleUppercaseIconElement = document.getElementById('rule-uppercase-icon');
        const ruleNumberIconElement = document.getElementById('rule-number-icon');
        
        if (ruleLengthIconElement) ruleLengthIconElement.className = lengthCheck ? 'fas fa-check' : 'fas fa-times';
        if (ruleLowercaseIconElement) ruleLowercaseIconElement.className = lowercaseCheck ? 'fas fa-check' : 'fas fa-times';
        if (ruleUppercaseIconElement) ruleUppercaseIconElement.className = uppercaseCheck ? 'fas fa-check' : 'fas fa-times';
        if (ruleNumberIconElement) ruleNumberIconElement.className = numberCheck ? 'fas fa-check' : 'fas fa-times';
        
        // 更新確認密碼檢查
        const confirmPassword = document.getElementById('confirmPassword')?.value || '';
        const matchCheck = password === confirmPassword && password !== '';
        
        if (confirmPassword !== '') {
            const ruleMatchElement = document.getElementById('rule-match');
            const ruleMatchIconElement = document.getElementById('rule-match-icon');
            
            if (ruleMatchElement) ruleMatchElement.className = matchCheck ? 'text-success' : 'text-danger';
            if (ruleMatchIconElement) ruleMatchIconElement.className = matchCheck ? 'fas fa-check' : 'fas fa-times';
        }
    }
    
    // 完整的密碼規則檢查
    updatePasswordRulesCheck = function(password) {
        basicUpdatePasswordRulesCheck(password);
    };
    
    // 文件上傳相關函數
    removeUploadedFile = function(index) {
        if (index >= 0 && index < uploadedFiles.length) {
            // 釋放 URL 對象
            URL.revokeObjectURL(uploadedFiles[index].preview);
            
            // 從列表中移除
            uploadedFiles.splice(index, 1);
            
            // 更新預覽
            if (typeof enhancedUploadPreview === 'function') {
                enhancedUploadPreview();
            }
            
            // 更新上傳計數
            updateUploadCount();
        }
    };
    
    formatFileSize = function(bytes) {
        if (bytes < 1024) return bytes + ' Bytes';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        else return (bytes / 1048576).toFixed(2) + ' MB';
    };
    
    // 更新預覽顯示函數
    enhancedUploadPreview = function() {
        const uploadPreview = document.getElementById('photoPreviewContainer');
        
        if (!uploadPreview) {
            console.warn('找不到上傳預覽容器元素 (photoPreviewContainer)');
            return;
        }
        
        // 清空預覽區域
        uploadPreview.innerHTML = '';
        
        if (uploadedFiles.length === 0) {
            uploadPreview.innerHTML = `
                <div class="empty-preview-message">
                    <i class="fas fa-images mb-2" style="font-size: 2rem; color: #ced4da;"></i>
                    <p>尚未上傳任何檔案</p>
                </div>
            `;
            return;
        }
        
        // 創建檔案預覽網格
        const previewGrid = document.createElement('div');
        previewGrid.className = 'row g-3';
        
        // 使用統一函數渲染每個文件預覽
        uploadedFiles.forEach((uploadedFile, index) => {
            const filePreviewEl = renderFilePreview(uploadedFile, index, true);
            previewGrid.appendChild(filePreviewEl);
        });
        
        uploadPreview.appendChild(previewGrid);
    };

    // 驗證步驟的函數
    validateStep = async function(stepNumber) {
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
                    
                    // 使用簡化的驗證方式，避免依賴外部函數
                    let emailAvailable = true;
                    try {
                        if (typeof validateEmail === 'function') {
                            const result = await validateEmail(email.value);
                            emailAvailable = result.available;
                            if (!emailAvailable) {
                                const errorMessage = result.error ? 
                                    `電子郵件檢查失敗: ${result.error}` : 
                                    '此電子郵件已被註冊，請使用其他電子郵件';
                                
                                showFieldError(email, errorMessage);
                            }
                        }
                    } catch (emailError) {
                        console.error('驗證電子郵件時發生錯誤:', emailError);
                        // 在錯誤情況下假設郵件可用，避免阻塞流程
                        emailAvailable = true;
                    }
                    
                    // 恢復按鈕狀態
                    nextButton.textContent = originalText;
                    nextButton.disabled = false;
                    
                    if (!emailAvailable) {
                        isValid = false;
                    }
                } catch (error) {
                    console.error('驗證過程中發生錯誤:', error);
                    
                    // 恢復按鈕狀態
                    const nextButton = document.querySelector('.btn-next[data-step="1"]');
                    if (nextButton) {
                        nextButton.textContent = '下一步';
                        nextButton.disabled = false;
                    }
                    
                    // 在錯誤情況下繼續流程
                    isValid = true;
                }
            }
            
            if (!password.value) {
                showFieldError(password, '請輸入密碼');
                isValid = false;
            } else if (password.value.length < 8) {
                showFieldError(password, '密碼長度至少為8位');
                isValid = false;
            } else {
                clearFieldError(password);
            }
            
            if (password.value !== confirmPassword.value) {
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
            const businessDescription = document.getElementById('businessDescription');
            
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
            
            if (!businessDescription.value.trim()) {
                showFieldError(businessDescription, '請輸入店家介紹');
                isValid = false;
            } else {
                clearFieldError(businessDescription);
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
    };
    
    // 立即導出所有核心函數到全局
    if (typeof window !== 'undefined') {
        window.nextStep = nextStep;
        window.prevStep = prevStep;
        window.validateStep = validateStep;
        window.togglePasswordVisibility = togglePasswordVisibility;
        window.updatePasswordStrength = updatePasswordStrength;
        window.updatePasswordRulesCheck = updatePasswordRulesCheck;
        window.removeUploadedFile = removeUploadedFile;
        window.enhancedUploadPreview = enhancedUploadPreview;
        window.formatFileSize = formatFileSize;
    }
    
    console.log("核心函數已導出:", 
        typeof window.nextStep === 'function' ? '✓' : '✗', 
        typeof window.validateStep === 'function' ? '✓' : '✗',
        typeof window.togglePasswordVisibility === 'function' ? '✓' : '✗',
        typeof window.updatePasswordStrength === 'function' ? '✓' : '✗'
    );
    
    return true;
}

// 立即嘗試導出核心函數
ensureGlobalFunctions();

// ===== 檢查電子郵件可用性 =====
let validateEmail;

// 簡單的電子郵件驗證函數，避免依賴外部API
validateEmail = async function(email) {
    // 參數驗證
    if (!email || email.trim() === '') {
        console.error('嘗試檢查空的電子郵件');
        return { available: false }; // 空的電子郵件被視為不可用
    }

    try {
        // 清理並規範化電子郵件
        const normalizedEmail = email.trim().toLowerCase();
        console.log('開始檢查電子郵件可用性:', normalizedEmail);
        
        // 嘗試使用Firebase Functions檢查
        if (typeof getFunctions === 'function' && typeof httpsCallable === 'function') {
            try {
                const functions = getFunctions();
                const checkEmailAvailability = httpsCallable(functions, 'checkEmailAvailability');
                
                // 調用 Firebase 函數
                const result = await checkEmailAvailability({ email: normalizedEmail });
                
                // 檢查回應格式
                if (result.data && typeof result.data === 'object' && 'available' in result.data) {
                    return {
                        available: result.data.available || false,
                        timestamp: result.data.timestamp
                    };
                }
            } catch (firebaseError) {
                console.warn('Firebase函數調用失敗，使用備用檢查:', firebaseError);
                // 繼續使用備用方式
            }
        }
        
        // 備用：假設電子郵件可用（避免阻塞用戶註冊流程）
        console.log('使用備用電子郵件檢查邏輯');
        return { available: true, backup: true };
        
    } catch (error) {
        console.error('檢查電子郵件可用性時發生錯誤:', error);
        // 在錯誤情況下假設可用，避免阻塞流程
        return { 
            available: true,
            backup: true,
            error: error.message
        };
    }
};

// ===== 文件上傳處理 =====

// 更新上傳計數
function updateUploadCount() {
   const uploadCountElement = document.getElementById('uploadCount');
   const uploadLabel = document.getElementById('uploadLabel');
   const MAX_UPLOAD_COUNT = 5; // 最大上傳張數
   
   if (uploadCountElement) {
       uploadCountElement.textContent = uploadedFiles.length;
   }
   
   if (uploadLabel) {
       if (uploadedFiles.length >= MAX_UPLOAD_COUNT) {
           uploadLabel.style.display = 'none';
       } else {
           uploadLabel.style.display = 'block';
       }
   }
}

// 獲取上傳的文件列表
function getUploadedBusinessLicenseFiles() {
   return uploadedFiles;
}

// 檢查文件類型是否被允許
function isAllowedFileType(file) {
   const allowedTypes = [
       'image/jpeg', 
       'image/jpg', 
       'image/png', 
       'application/pdf'
   ];
   return allowedTypes.includes(file.type);
}

// 獲取文件擴展名
function getFileExtension(fileName) {
   return fileName.split('.').pop().toLowerCase();
}

// 壓縮圖片
async function compressImage(file) {
   return new Promise((resolve, reject) => {
       try {
           const reader = new FileReader();
           reader.readAsDataURL(file);
           reader.onload = function(event) {
               const img = new Image();
               img.src = event.target.result;
               img.onload = function() {
                   try {
                       const canvas = document.createElement('canvas');
                       const ctx = canvas.getContext('2d');
                       
                       // 計算新的尺寸，保持寬高比
                       let width = img.width;
                       let height = img.height;
                       const maxDimension = 1024; // 最大寬度/高度
                       
                       if (width > height && width > maxDimension) {
                           height = Math.round((height * maxDimension) / width);
                           width = maxDimension;
                       } else if (height > maxDimension) {
                           width = Math.round((width * maxDimension) / height);
                           height = maxDimension;
                       }
                       
                       canvas.width = width;
                       canvas.height = height;
                       ctx.drawImage(img, 0, 0, width, height);
                       
                       // 轉換為 Blob
                       canvas.toBlob(
                           (blob) => {
                               if (!blob) {
                                   console.warn('壓縮後的Blob為空，使用原始文件');
                                   resolve(file);
                                   return;
                               }
                               
                               // 創建新文件對象
                               const compressedFile = new File([blob], file.name, {
                                   type: 'image/jpeg',
                                   lastModified: Date.now()
                               });
                               resolve(compressedFile);
                           },
                           'image/jpeg',
                           0.7 // 設置壓縮質量 (0.7 = 70% 質量)
                       );
                   } catch (canvasError) {
                       console.warn('Canvas操作失敗:', canvasError);
                       resolve(file); // 失敗時使用原始文件
                   }
               };
               
               img.onerror = function(error) {
                   console.warn('圖片加載錯誤:', error);
                   resolve(file); // 失敗時使用原始文件
               };
           };
           
           reader.onerror = function(error) {
               console.warn('文件讀取錯誤:', error);
               resolve(file); // 失敗時使用原始文件
           };
       } catch (error) {
           console.warn('壓縮圖片過程中發生錯誤:', error);
           resolve(file); // 失敗時使用原始文件
       }
   });
}

// 處理檔案
async function processFile(file) {
   try {
       if (file.type.startsWith('image/')) {
           // 圖片檔案進行壓縮
           const compressedFile = await compressImage(file);
           return compressedFile;
       } else {
           // 其他類型檔案直接傳遞
           return file;
       }
   } catch (error) {
       console.warn('處理檔案錯誤:', error);
       return file; // 失敗時使用原始文件
   }
}

// 改進文件上傳處理
function improvedFileUploadHandler(e) {
   try {
       const files = Array.from(e.target.files || []);
       const MAX_UPLOAD_COUNT = 5; // 最大上傳張數
       const MAX_FILE_SIZE_MB = 5; // 每個文件最大 5MB
       
       if (uploadedFiles.length + files.length > MAX_UPLOAD_COUNT) {
           alert(`最多只能上傳 ${MAX_UPLOAD_COUNT} 個檔案`);
           return;
       }
       
       // 顯示上傳進度
       const uploadProgress = document.getElementById('uploadProgress');
       if (uploadProgress) {
           uploadProgress.style.display = 'block';
       }
       
       // 處理每個文件
       files.forEach(async (file) => {
           try {
               // 檢查文件類型
               if (!isAllowedFileType(file)) {
                   alert(`不支援的檔案類型: ${file.name}\n僅支援 JPG、PNG 和 PDF 格式`);
                   return;
               }
               
               // 檢查文件大小
               if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                   alert(`檔案 ${file.name} 超過大小限制（${MAX_FILE_SIZE_MB}MB）`);
                   return;
               }
               
               // 處理檔案（圖片類型將進行壓縮）
               const processedFile = await processFile(file);
               
               // 添加到上傳文件列表
               const fileId = `file-${Date.now()}-${uploadedFiles.length}`;
               const fileType = processedFile.type;
               const fileExt = getFileExtension(processedFile.name);
               
               let previewUrl = URL.createObjectURL(processedFile);
               
               uploadedFiles.push({
                   id: fileId,
                   file: processedFile,
                   fileName: processedFile.name,
                   fileType: fileType,
                   fileExt: fileExt,
                   preview: previewUrl,
                   isPDF: fileType === 'application/pdf'
               });
               
               // 更新上傳計數和預覽
               updateUploadCount();
               if (typeof enhancedUploadPreview === 'function') {
                   enhancedUploadPreview();
               }
           } catch (fileError) {
               console.error('處理文件時發生錯誤:', fileError);
               alert(`處理檔案 ${file.name} 時發生錯誤`);
           }
       });
       
       // 隱藏上傳進度
       if (uploadProgress) {
           setTimeout(() => {
               uploadProgress.style.display = 'none';
           }, 500);
       }
   } catch (error) {
       console.error('上傳處理過程中發生錯誤:', error);
       alert('文件上傳處理發生錯誤，請稍後再試');
   }
   
   // 重置檔案輸入，以便可以重新選擇相同的檔案
   if (e.target && e.target.value) {
       e.target.value = '';
   }
}

// 渲染文件預覽
function renderFilePreview(file, index, showDeleteButton = true) {
   const isPDF = file.file.type === 'application/pdf';
   const colDiv = document.createElement('div');
   colDiv.className = 'col-md-6 col-lg-4 mb-3';
   
   // 創建卡片容器
   const cardDiv = document.createElement('div');
   cardDiv.className = 'card h-100 file-preview-card';
   cardDiv.style.borderRadius = '8px';
   cardDiv.style.overflow = 'hidden';
   cardDiv.style.boxShadow = '0 3px 8px rgba(0,0,0,0.1)';
   
   // 創建卡片內容
   let cardContent = '';
   
   // 預覽區域 - PDF或圖片
   if (isPDF) {
       cardContent += `
           <div class="card-img-top bg-light d-flex align-items-center justify-content-center" style="height: 160px;">
               <i class="fas fa-file-pdf text-danger" style="font-size: 3rem;"></i>
           </div>
       `;
   } else {
       cardContent += `
           <div class="card-img-top" style="height: 160px; background-image: url('${file.preview}'); background-size: cover; background-position: center;"></div>
       `;
   }
   
   // 文件信息區域
   cardContent += `
       <div class="card-body p-3">
           <h6 class="card-title text-truncate mb-1" title="${file.fileName}">${file.fileName}</h6>
           <p class="card-text text-muted small mb-0">${formatFileSize(file.file.size)}</p>
       </div>
   `;
   
   cardDiv.innerHTML = cardContent;
   
   // 如果需要，添加刪除按鈕
   if (showDeleteButton) {
       const deleteButton = document.createElement('button');
       deleteButton.className = 'position-absolute btn btn-sm btn-danger rounded-circle';
       deleteButton.style.top = '8px';
       deleteButton.style.right = '8px';
       deleteButton.style.width = '28px';
       deleteButton.style.height = '28px';
       deleteButton.style.padding = '0';
       deleteButton.style.display = 'flex';
       deleteButton.style.alignItems = 'center';
       deleteButton.style.justifyContent = 'center';
       deleteButton.style.fontSize = '12px';
       deleteButton.style.zIndex = '10';
       deleteButton.innerHTML = '<i class="fas fa-times"></i>';
       
       // 為刪除按鈕添加點擊事件
       deleteButton.addEventListener('click', function(e) {
           e.stopPropagation(); // 阻止事件冒泡
           
           // 使用全局函數或內部函數刪除文件
           if (typeof window.removeUploadedFile === 'function') {
               window.removeUploadedFile(index);
           } else {
               // 備用刪除邏輯
               if (index >= 0 && index < uploadedFiles.length) {
                   // 釋放 URL 對象
                   URL.revokeObjectURL(uploadedFiles[index].preview);
                   
                   // 從列表中移除
                   uploadedFiles.splice(index, 1);
                   
                   // 更新預覽
                   enhancedUploadPreview();
                   
                   // 更新上傳計數
                   updateUploadCount();
               }
           }
       });
       
       cardDiv.appendChild(deleteButton);
   }
   
   colDiv.appendChild(cardDiv);
   return colDiv;
}

// 更新摘要信息
function updateSummaryInfo() {
  try {
    const summaryContainer = document.querySelector('.summary-info .row');
    if (!summaryContainer) {
      console.warn('⚠️ 找不到 .summary-info .row 容器');
      return;
    }

    console.log('updateSummaryInfo 執行中...', {
      email: !!document.getElementById('email'),
      businessName: !!document.getElementById('businessName'),
      uploadedFilesDefined: typeof uploadedFiles !== 'undefined'
    });

    // 清空舊內容
    summaryContainer.innerHTML = '';

    // 取資料
    const email = document.getElementById('email')?.value || '';
    const businessName = document.getElementById('businessName')?.value || '';
    const businessType = document.getElementById('businessType')?.value || '';
    const businessDescription = document.getElementById('businessDescription')?.value || '';
    const businessAddress = document.getElementById('businessAddress')?.value || '';
    const businessPhone = document.getElementById('businessPhone')?.value || '';
    const contactName = document.getElementById('contactName')?.value || '';
    const contactPhone = document.getElementById('contactPhone')?.value || '';
    const files = Array.isArray(uploadedFiles) ? uploadedFiles : [];
    const uploadedFilesCount = files.length;

    // 建立摘要資料
    const infoList = [
      { label: '電子郵件', value: email },
      { label: '店家名稱', value: businessName },
      { label: '店家類型', value: businessType },
      { label: '店家地址', value: businessAddress },
      { label: '店家電話', value: businessPhone },
      { label: '店家介紹', value: businessDescription },
      { label: '聯絡人姓名', value: contactName },
      { label: '聯絡人電話', value: contactPhone },
      { label: '上傳證明文件', value: `${uploadedFilesCount} 個檔案` }
    ];

    // 加入基本資料
    infoList.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-12 mb-2';
      col.innerHTML = `
        <div class="d-flex">
          <div class="fw-bold me-2" style="min-width: 130px;">${item.label}：</div>
          <div>${item.value || '（尚未填寫）'}</div>
        </div>`;
      summaryContainer.appendChild(col);
    });

    // 加入上傳檔案預覽（如果有）
    if (uploadedFilesCount > 0) {
      const title = document.createElement('div');
      title.className = 'col-12 mt-3 mb-2';
      title.innerHTML = `<h6 class="fw-bold">已上傳檔案：</h6>`;
      summaryContainer.appendChild(title);

      const fileGrid = document.createElement('div');
      fileGrid.className = 'row g-3';

      files.forEach((file, index) => {
        try {
          const filePreviewEl = renderFilePreview(file, index, false);
          if (filePreviewEl) fileGrid.appendChild(filePreviewEl);
        } catch (err) {
          console.warn('renderFilePreview 出錯，略過該檔案：', err);
        }
      });

      const fileContainer = document.createElement('div');
      fileContainer.className = 'col-12';
      fileContainer.appendChild(fileGrid);
      summaryContainer.appendChild(fileContainer);
    }

    console.log('✅ 摘要內容更新完成');
  } catch (err) {
    console.error('❌ updateSummaryInfo 發生錯誤：', err);
  }
}


// 初始化文件上傳功能
function enhancedFileUploadInit() {
   try {
       const businessLicenseFile = document.getElementById('businessLicenseFile');
       const uploadArea = document.querySelector('.custom-file-upload');
       
       if (!businessLicenseFile) {
           console.warn('找不到文件上傳輸入元素');
           return;
       }
       
       // 處理文件上傳事件
       businessLicenseFile.addEventListener('change', function(e) {
           try {
               improvedFileUploadHandler(e);
           } catch (error) {
               console.error('上傳處理事件失敗:', error);
               alert('文件上傳處理失敗，請稍後再試');
           }
       });
       
       // 設置拖放上傳
       if (uploadArea) {
           ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
               uploadArea.addEventListener(eventName, function(e) {
                   e.preventDefault();
                   e.stopPropagation();
               }, false);
           });
           
           ['dragenter', 'dragover'].forEach(eventName => {
               uploadArea.addEventListener(eventName, function() {
                   uploadArea.classList.add('highlight');
               }, false);
           });
           
           ['dragleave', 'drop'].forEach(eventName => {
               uploadArea.addEventListener(eventName, function() {
                   uploadArea.classList.remove('highlight');
               }, false);
           });
           
           uploadArea.addEventListener('drop', function(e) {
               try {
                   const dt = e.dataTransfer;
                   const files = dt.files;
                   
                   // 直接處理拖放文件
                   const changeEvent = {
                       target: {
                           files: files,
                           value: '' // 模擬value，方便重置
                       }
                   };
                   
                   improvedFileUploadHandler(changeEvent);
               } catch (error) {
                   console.error('拖放處理失敗:', error);
                   alert('文件拖放處理失敗，請使用點擊上傳');
               }
           }, false);
       }
   } catch (error) {
       console.error('初始化文件上傳功能失敗:', error);
   }
}

// 處理註冊表單提交
handleRegisterSubmit = async function(e) {
   if (e && e.preventDefault) {
       e.preventDefault();
   }
   
   console.log('表單提交處理開始');
   
   // 檢查第三步的必填字段是否已填寫
   let canProceed = true;
   try {
       if (typeof validateStep === 'function') {
           canProceed = await validateStep(3);
       }
   } catch (error) {
       console.warn('驗證第三步時發生錯誤:', error);
       // 繼續處理，避免阻塞
       canProceed = true;
   }
   
   if (!canProceed) {
       console.log('表單驗證失敗，停止提交');
       return;
   }
   
   // 禁用提交按鈕防止重複提交
   const submitButton = document.querySelector('.btn-submit');
   if (submitButton) {
       submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 處理中...';
       submitButton.disabled = true;
   }
   
   try {
       // 檢查必要的Firebase組件是否可用
       if (!auth || !db || !storage) {
           throw new Error('Firebase組件未完全加載，請刷新頁面後重試');
       }
       
       // 獲取表單數據
       const email = document.getElementById('email')?.value;
       const password = document.getElementById('password')?.value;
       const businessName = document.getElementById('businessName')?.value;
       const businessType = document.getElementById('businessType')?.value;
       const businessAddress = document.getElementById('businessAddress')?.value;
       const businessPhone = document.getElementById('businessPhone')?.value;
       const businessDescription = document.getElementById('businessDescription')?.value;
       const contactName = document.getElementById('contactName')?.value;
       const contactPhone = document.getElementById('contactPhone')?.value;
       
       if (!email || !password || !businessName) {
           throw new Error('必要資料不完整，請檢查表單');
       }
       
       console.log("提交表單資料:", {email, businessName, businessType});
       
       // 嘗試App Check驗證
       let appCheckVerified = true;
       try {
           if (typeof checkAppCheckStatus === 'function') {
               const appCheckResult = await checkAppCheckStatus();
               appCheckVerified = appCheckResult.success;
               
               if (!appCheckVerified) {
                   console.warn('App Check 驗證失敗，但仍將嘗試註冊');
               }
           }
       } catch (appCheckError) {
           console.warn('App Check 檢查過程中發生錯誤:', appCheckError);
           // 繼續處理，避免阻塞
       }
       
       // 1. 創建 Firebase 用戶
       const userCredential = await createUserWithEmailAndPassword(auth, email, password);
       const user = userCredential.user;
       
       // 2. 發送驗證郵件
       try {
           await sendEmailVerification(user);
       } catch (emailVerificationError) {
           console.warn('發送驗證郵件失敗:', emailVerificationError);
           // 繼續流程，不阻斷註冊
       }
       
       // 3. 存儲店家資訊到 Firestore
       await setDoc(doc(db, 'businesses', user.uid), {
           businessName: businessName,
           businessType: businessType,
           address: businessAddress,
           phoneNumber: businessPhone,
           description: businessDescription,
           contactName: contactName,
           contactPhone: contactPhone,
           email: email,
           ownerId: user.uid,
           status: 'pending', 
           createdAt: serverTimestamp(),
           updatedAt: serverTimestamp()
       });
       
       // 4. 處理營業執照上傳
       let licenseUrls = [];
       
       if (uploadedFiles.length > 0) {
           // 建立照片URL陣列
           for (const uploadedFile of uploadedFiles) {
               try {
                   const file = uploadedFile.file;
                   const storageReference = ref(storage, `licenses/${user.uid}/${uploadedFile.fileName}`);
                   
                   // 上傳檔案
                   await uploadBytes(storageReference, file);
                   
                   // 獲取下載 URL
                   const licenseUrl = await getDownloadURL(storageReference);
                   licenseUrls.push(licenseUrl);
               } catch (uploadError) {
                   console.warn(`上傳文件 ${uploadedFile.fileName} 失敗:`, uploadError);
                   // 繼續處理其他文件
               }
           }
           
           // 更新店家文檔添加執照 URL 數組
           if (licenseUrls.length > 0) {
               try {
                   await updateDoc(doc(db, 'businesses', user.uid), {
                       licenseUrls: licenseUrls
                   });
               } catch (updateError) {
                   console.warn('更新執照URL失敗:', updateError);
                   // 繼續流程
               }
           }
       }
       
       // 5. 創建審核請求
       await setDoc(doc(db, 'businessApprovalRequests', user.uid), {
           userId: user.uid,
           businessName: businessName,
           businessType: businessType,
           address: businessAddress,
           phoneNumber: businessPhone,
           description: businessDescription,
           contactName: contactName,
           contactPhone: contactPhone,
           email: email,
           licenseUrls: licenseUrls,
           status: 'pending',
           rejectReason: null,
           createdAt: serverTimestamp(),
           updatedAt: serverTimestamp()
       });
       
       // 6. 登出用戶（因為需要等待審核）
       try {
           await auth.signOut();
       } catch (signOutError) {
           console.warn('登出失敗:', signOutError);
           // 繼續流程
       }
       
       // 顯示成功訊息
       const successAlert = document.createElement('div');
       successAlert.className = 'alert alert-success mt-4';
       successAlert.innerHTML = `
           <h5>註冊申請已成功提交！</h5>
           <p>我們將盡快審核您的申請，並請確認您的郵箱完成驗證。</p>
           <p>5秒後將自動跳轉到登入頁面...</p>
       `;
       
       const formContainer = document.querySelector('.register-form-container');
       if (formContainer) {
           formContainer.appendChild(successAlert);
       }
       
       // 5秒後跳轉到登入頁面
       setTimeout(() => {
           window.location.href = 'business-login.html?status=registered';
       }, 5000);
       
   } catch (error) {
       console.error('註冊時發生錯誤:', error);
       
       // 恢復按鈕狀態
       const submitButton = document.querySelector('.btn-submit');
       if (submitButton) {
           submitButton.innerHTML = '提交註冊';
           submitButton.disabled = false;
       }
       
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
       } else if (error.message) {
           errorMessage = error.message;
       }
       
       // 添加錯誤提示元素（如果不存在）
       let errorAlert = document.querySelector('.register-error-alert');
       if (!errorAlert) {
           errorAlert = document.createElement('div');
           errorAlert.className = 'alert alert-danger register-error-alert mt-3';
           errorAlert.role = 'alert';
           
           const formHeader = document.querySelector('.register-form-header');
           if (formHeader) {
               formHeader.after(errorAlert);
           }
       }
       
       errorAlert.textContent = errorMessage;
       
       // 滾動到錯誤信息
       if (errorAlert.scrollIntoView) {
           errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
       }
   }
}

// 修復可能的reCAPTCHA跨域問題
function fixReCaptchaCORSIssue() {
   try {
       console.log('正在嘗試修復 reCAPTCHA 跨域問題...');
       
       // 檢查是否已存在 reCAPTCHA 腳本
       const existingScript = document.querySelector('script[src*="recaptcha/api.js"]');
       
       if (existingScript) {
           console.log('找到現有的 reCAPTCHA 腳本，將嘗試修復');
           
           // 創建 reCAPTCHA 容器（如果需要）
           let recaptchaContainer = document.getElementById('recaptcha-container');
           if (!recaptchaContainer) {
               recaptchaContainer = document.createElement('div');
               recaptchaContainer.id = 'recaptcha-container';
               recaptchaContainer.style.display = 'none';
               document.body.appendChild(recaptchaContainer);
           }
           
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
                           
                           // 執行測試以確認功能
                           try {
                               grecaptcha.execute(siteKey, {action: 'test'})
                                   .then(function(token) {
                                       console.log('reCAPTCHA 令牌獲取成功');
                                       // 如果有App Check模塊，重新初始化
                                       if (typeof checkAppCheckStatus === 'function') {
                                           checkAppCheckStatus().then(result => {
                                               console.log('App Check 檢查結果:', result);
                                           });
                                       }
                                   })
                                   .catch(function(error) {
                                       console.warn('reCAPTCHA 執行測試失敗:', error);
                                   });
                           } catch (recaptchaError) {
                               console.warn('reCAPTCHA 執行失敗:', recaptchaError);
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

// 強制重新初始化App Check
async function forceInitializeAppCheck() {
   try {
       console.log('強制重新初始化 App Check...');
       
       // 檢查 App Check 狀態
       if (typeof checkAppCheckStatus === 'function') {
           const result = await checkAppCheckStatus();
           
           if (result.success) {
               console.log('App Check 已成功初始化');
               return true;
           } else {
               console.warn('App Check 狀態檢查失敗, 錯誤:', result.error);
           }
       } else {
           console.warn('App Check 狀態檢查函數不可用');
       }
       
       // 嘗試修復 reCAPTCHA
       fixReCaptchaCORSIssue();
       
       // 安裝 XHR 和 fetch 攔截器
       if (typeof installXHRInterceptor === 'function') {
           installXHRInterceptor();
       }
       
       if (typeof installFetchInterceptor === 'function') {
           installFetchInterceptor();
       }
       
       // 嘗試獲取 App Check 令牌
       if (typeof getAppCheckToken === 'function') {
           try {
               const token = await getAppCheckToken();
               if (token) {
                   console.log('成功獲取 App Check 令牌');
                   return true;
               } else {
                   console.warn('App Check 令牌獲取失敗');
               }
           } catch (tokenError) {
               console.warn('獲取 App Check 令牌時發生錯誤:', tokenError);
           }
       }
       
       // 嘗試其他方法修復...
       return false;
       
   } catch (error) {
       console.error('強制初始化 App Check 時發生錯誤:', error);
       return false;
   }
}

// 添加錯誤恢復機制
function setupAutoRecovery() {
   console.log('設置自動錯誤恢復機制...');
   
   // 檢測關鍵函數並修復
   let recoveryInterval = setInterval(() => {
       try {
           const missingFunctions = [];
           
           // 檢查關鍵函數
           if (typeof window.nextStep !== 'function') missingFunctions.push('nextStep');
           if (typeof window.prevStep !== 'function') missingFunctions.push('prevStep');
           if (typeof window.togglePasswordVisibility !== 'function') missingFunctions.push('togglePasswordVisibility');
           if (typeof window.updatePasswordStrength !== 'function') missingFunctions.push('updatePasswordStrength');
           
           // 如果有缺失函數，嘗試重新導出
           if (missingFunctions.length > 0) {
               console.warn('檢測到缺失函數:', missingFunctions.join(', '), '- 嘗試修復');
               ensureGlobalFunctions();
               
               // 檢查是否修復成功
               const stillMissing = [];
               if (typeof window.nextStep !== 'function') stillMissing.push('nextStep');
               if (typeof window.prevStep !== 'function') stillMissing.push('prevStep');
               
               // 如果核心功能仍然缺失，手動綁定按鈕事件
               if (stillMissing.length > 0) {
                   console.warn('核心函數仍缺失，嘗試直接綁定按鈕事件');
                   setupDirectButtonHandlers();
               }
           }
           
           // 檢查App Check狀態
           if (window._appCheckFailed && !window._appCheckRecoveryAttempted) {
               console.warn('檢測到App Check失敗，嘗試恢復');
               window._appCheckRecoveryAttempted = true;
               forceInitializeAppCheck();
           }
           
           // 恢復次數限制
           window._recoveryAttempts = (window._recoveryAttempts || 0) + 1;
           if (window._recoveryAttempts >= 5) {
               console.log('已達到最大恢復嘗試次數，停止自動恢復');
               clearInterval(recoveryInterval);
           }
           
       } catch (error) {
           console.error('恢復過程中發生錯誤:', error);
       }
   }, 5000); // 每5秒檢查一次
   
   // 60秒後停止自動恢復
   setTimeout(() => {
       if (recoveryInterval) {
           clearInterval(recoveryInterval);
           console.log('自動恢復機制已停止');
       }
   }, 60000);
}

// 直接設置按鈕處理程序（不依賴全局函數）
function setupDirectButtonHandlers() {
   try {
       console.log('正在設置直接按鈕處理程序...');
       
       // 下一步按鈕
       document.querySelectorAll('.btn-next').forEach(button => {
           // 移除現有事件
           const newButton = button.cloneNode(true);
           button.parentNode.replaceChild(newButton, button);
           
           // 添加新事件處理
           newButton.addEventListener('click', function(e) {
               e.preventDefault();
               const currentStep = parseInt(this.getAttribute('data-step'));
               console.log("下一步按鈕被點擊，當前步驟:", currentStep);
               
               // 直接實現下一步邏輯
               const nextStepNum = currentStep + 1;
               
               // 切換步驟內容
               document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
               const nextStepContent = document.getElementById(`step-${nextStepNum}-content`);
               if (nextStepContent) nextStepContent.classList.add('active');
               
               // 更新進度指示器
               document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
               const nextStepIndicator = document.getElementById(`step-${nextStepNum}`);
               if (nextStepIndicator) nextStepIndicator.classList.add('active');
               
               // 特殊處理
               if (nextStepNum === 4) {
                   // 嘗試更新摘要信息
                   try {
                       updateSummaryInfo();
                   } catch (error) {
                       console.warn('更新摘要信息時發生錯誤:', error);
                   }
               }
               
               // 滾動到頂部
               window.scrollTo({ top: 0, behavior: 'smooth' });
           });
       });
       
       // 上一步按鈕
       document.querySelectorAll('.btn-prev').forEach(button => {
           // 移除現有事件
           const newButton = button.cloneNode(true);
           button.parentNode.replaceChild(newButton, button);
           
           // 添加新事件處理
           newButton.addEventListener('click', function(e) {
               e.preventDefault();
               const currentStep = parseInt(this.getAttribute('data-step'));
               
               if (currentStep > 1) {
                   const prevStepNum = currentStep - 1;
                   
                   // 切換步驟內容
                   document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
                   const prevStepContent = document.getElementById(`step-${prevStepNum}-content`);
                   if (prevStepContent) prevStepContent.classList.add('active');
                   
                   // 更新進度指示器
                   document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
                   const prevStepIndicator = document.getElementById(`step-${prevStepNum}`);
                   if (prevStepIndicator) prevStepIndicator.classList.add('active');
                   
                   // 滾動到頂部
                   window.scrollTo({ top: 0, behavior: 'smooth' });
               }
           });
       });
       
       // 提交按鈕
       const submitButton = document.querySelector('.btn-submit');
       if (submitButton) {
           // 移除現有事件
           const newSubmitButton = submitButton.cloneNode(true);
           submitButton.parentNode.replaceChild(newSubmitButton, submitButton);
           
           // 添加新事件處理
           newSubmitButton.addEventListener('click', function(e) {
               e.preventDefault();
               console.log('提交按鈕被點擊');
               
               // 使用獨立提交處理函數
               handleRegisterSubmit(e);
           });
       }
       
       // 表單提交
       const registerForm = document.getElementById('businessRegisterForm');
       if (registerForm) {
           // 移除現有事件
           const newForm = registerForm.cloneNode(true);
           registerForm.parentNode.replaceChild(newForm, registerForm);
           
           // 添加新事件處理
           newForm.addEventListener('submit', function(e) {
               e.preventDefault();
               console.log('表單提交被觸發');
               
               // 使用獨立提交處理函數
               handleRegisterSubmit(e);
           });
       }
       
       // 密碼顯示切換按鈕
       const togglePassword = document.getElementById('togglePassword');
       if (togglePassword) {
           // 移除現有事件
           const newTogglePassword = togglePassword.cloneNode(true);
           togglePassword.parentNode.replaceChild(newTogglePassword, togglePassword);
           
           // 添加新事件處理
           newTogglePassword.addEventListener('click', function() {
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
       
       const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
       if (toggleConfirmPassword) {
           // 移除現有事件
           const newToggleConfirm = toggleConfirmPassword.cloneNode(true);
           toggleConfirmPassword.parentNode.replaceChild(newToggleConfirm, toggleConfirmPassword);
           
           // 添加新事件處理
           newToggleConfirm.addEventListener('click', function() {
               const confirmPasswordInput = document.getElementById('confirmPassword');
               const icon = this.querySelector('i');
               
               if (confirmPasswordInput) {
                   if (confirmPasswordInput.type === 'password') {
                       confirmPasswordInput.type = 'text';
                       if (icon) {
                           icon.classList.remove('fa-eye');
                           icon.classList.add('fa-eye-slash');
                       }
                   } else {
                       confirmPasswordInput.type = 'password';
                       if (icon) {
                           icon.classList.remove('fa-eye-slash');
                           icon.classList.add('fa-eye');
                       }
                   }
               }
           });
       }
       
       // 密碼強度更新
       const passwordInput = document.getElementById('password');
       if (passwordInput) {
           // 移除現有事件
           const newPasswordInput = passwordInput.cloneNode(true);
           passwordInput.parentNode.replaceChild(newPasswordInput, passwordInput);
           
           // 添加新事件處理
           newPasswordInput.addEventListener('input', function() {
               try {
                   if (typeof updatePasswordStrength === 'function') {
                       updatePasswordStrength();
                   } else {
                       // 內部實現
                       const password = this.value;
                       
                       // 計算強度
                       let strength = 0;
                       if (password.length >= 8 && password.length <= 20) strength += 2;
                       else if (password.length > 0) strength += 1;
                       if (/[a-z]/.test(password)) strength += 1;
                       if (/[A-Z]/.test(password)) strength += 1;
                       if (/[0-9]/.test(password)) strength += 1;
                       
                       let strengthClass = 'bg-danger';
                       let strengthText = '弱';
                       
                       if (strength >= 5) {
                           strengthClass = 'bg-success';
                           strengthText = '強';
                       } else if (strength >= 3) {
                           strengthClass = 'bg-warning';
                           strengthText = '中';
                       }
                       
                       // 更新強度指示條
                       const strengthBar = document.getElementById('password-strength-bar');
                       if (strengthBar) {
                           strengthBar.className = `progress-bar ${strengthClass}`;
                           
                           // 根據密碼長度設置寬度
                           if (password.length === 0) {
                               strengthBar.style.width = '0%';
                           } else {
                               let percentage = Math.min(100, (password.length / 20) * 100);
                               strengthBar.style.width = `${percentage}%`;
                           }
                       }
                       
                       // 更新強度文字
                       const strengthLabel = document.getElementById('password-strength-text');
                       if (strengthLabel) {
                           strengthLabel.textContent = password.length > 0 ? `密碼強度: ${strengthText}` : '';
                       }
                       
                       // 更新規則檢查
                       const lengthCheck = password.length >= 8 && password.length <= 20;
                       const lowercaseCheck = /[a-z]/.test(password);
                       const uppercaseCheck = /[A-Z]/.test(password);
                       const numberCheck = /[0-9]/.test(password);
                       
                       // 更新各規則狀態
                       const ruleLengthElement = document.getElementById('rule-length');
                       const ruleLowercaseElement = document.getElementById('rule-lowercase');
                       const ruleUppercaseElement = document.getElementById('rule-uppercase');
                       const ruleNumberElement = document.getElementById('rule-number');
                       
                       if (ruleLengthElement) ruleLengthElement.className = lengthCheck ? 'text-success' : 'text-danger';
                       if (ruleLowercaseElement) ruleLowercaseElement.className = lowercaseCheck ? 'text-success' : 'text-danger';
                       if (ruleUppercaseElement) ruleUppercaseElement.className = uppercaseCheck ? 'text-success' : 'text-danger';
                       if (ruleNumberElement) ruleNumberElement.className = numberCheck ? 'text-success' : 'text-danger';
                       
                       // 更新各規則圖標
                       const ruleLengthIconElement = document.getElementById('rule-length-icon');
                       const ruleLowercaseIconElement = document.getElementById('rule-lowercase-icon');
                       const ruleUppercaseIconElement = document.getElementById('rule-uppercase-icon');
                       const ruleNumberIconElement = document.getElementById('rule-number-icon');
                       
                       if (ruleLengthIconElement) ruleLengthIconElement.className = lengthCheck ? 'fas fa-check' : 'fas fa-times';
                       if (ruleLowercaseIconElement) ruleLowercaseIconElement.className = lowercaseCheck ? 'fas fa-check' : 'fas fa-times';
                       if (ruleUppercaseIconElement) ruleUppercaseIconElement.className = uppercaseCheck ? 'fas fa-check' : 'fas fa-times';
                       if (ruleNumberIconElement) ruleNumberIconElement.className = numberCheck ? 'fas fa-check' : 'fas fa-times';
                   }
               } catch (error) {
                   console.warn('密碼強度更新過程中發生錯誤:', error);
               }
           });
       }
       
       // 確認密碼更新
       const confirmPasswordInput = document.getElementById('confirmPassword');
       if (confirmPasswordInput) {
           // 移除現有事件
           const newConfirmInput = confirmPasswordInput.cloneNode(true);
           confirmPasswordInput.parentNode.replaceChild(newConfirmInput, confirmPasswordInput);
           
           // 添加新事件處理
           newConfirmInput.addEventListener('input', function() {
               try {
                   const password = document.getElementById('password')?.value || '';
                   const confirmPassword = this.value;
                   const matchCheck = password === confirmPassword && password !== '';
                   
                   // 更新匹配規則
                   const ruleMatchElement = document.getElementById('rule-match');
                   const ruleMatchIconElement = document.getElementById('rule-match-icon');
                   
                   if (confirmPassword !== '') {
                       if (ruleMatchElement) ruleMatchElement.className = matchCheck ? 'text-success' : 'text-danger';
                       if (ruleMatchIconElement) ruleMatchIconElement.className = matchCheck ? 'fas fa-check' : 'fas fa-times';
                   }
               } catch (error) {
                   console.warn('確認密碼更新過程中發生錯誤:', error);
               }
           });
       }
       
       console.log('直接按鈕處理程序設置完成');
   } catch (error) {
       console.error('設置直接按鈕處理程序失敗:', error);
   }
}

// 函數導出到全局作用域
window.validateEmail = validateEmail;
window.handleRegisterSubmit = handleRegisterSubmit;
window.updateSummaryInfo = updateSummaryInfo;
window.enhancedFileUploadInit = enhancedFileUploadInit;
window.improvedFileUploadHandler = improvedFileUploadHandler;
window.fixReCaptchaCORSIssue = fixReCaptchaCORSIssue;
window.forceInitializeAppCheck = forceInitializeAppCheck;
window.setupAutoRecovery = setupAutoRecovery;
window.setupDirectButtonHandlers = setupDirectButtonHandlers;

// 設置 DOMContentLoaded 事件監聽器
console.log("設置 DOMContentLoaded 事件監聽器", new Date().toISOString());

document.addEventListener('DOMContentLoaded', function() {
   console.log('註冊頁面正在初始化...', new Date().toISOString());
   
   // 確保核心函數導出
   const exportStatus = ensureGlobalFunctions();
   
   // 修復可能的reCAPTCHA跨域問題
   setTimeout(() => {
       fixReCaptchaCORSIssue();
   }, 1000);
   
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
           
           let appCheckInitSuccess = false;
           
           // 確保 App Check 模塊已導入
           if (typeof checkAppCheckStatus === 'function') {
               try {
                   const result = await checkAppCheckStatus();
                   appCheckInitSuccess = result.success;
                   
                   if (appCheckInitSuccess) {
                       console.log('App Check 驗證成功！註冊流程可以正常進行');
                       
                       if (statusElement) {
                           statusElement.className = 'success';
                           statusElement.textContent = 'App Check: 已驗證 ✓';
                           setTimeout(() => { statusElement.style.display = 'none'; }, 3000);
                       }
                       
                       // 確保攔截器已安裝
                       if (typeof installXHRInterceptor === 'function') {
                           installXHRInterceptor();
                       }
                       
                       if (typeof installFetchInterceptor === 'function') {
                           installFetchInterceptor();
                       }
                   } else {
                       console.warn('App Check 驗證失敗，將嘗試修復:', result.error);
                       
                       // 設置狀態標記
                       window._appCheckFailed = true;
                       
                       if (statusElement) {
                           statusElement.className = 'error';
                           statusElement.textContent = 'App Check: 驗證失敗，嘗試修復...';
                       }
                       
                       // 嘗試重新初始化 App Check
                       setTimeout(() => {
                           forceInitializeAppCheck();
                       }, 1000);
                   }
               } catch (appCheckError) {
                   console.error('App Check 檢查過程中發生錯誤:', appCheckError);
                   
                   if (statusElement) {
                       statusElement.className = 'error';
                       statusElement.textContent = 'App Check: 檢查出錯 ✗';
                       setTimeout(() => { statusElement.style.display = 'none'; }, 5000);
                   }
               }
           } else {
               console.warn('App Check 模塊未導入，嘗試延遲重試');
               
               // 5秒後重試
               setTimeout(async () => {
                   if (typeof checkAppCheckStatus === 'function') {
                       try {
                           const result = await checkAppCheckStatus();
                           console.log('延遲加載 App Check 結果:', result);
                           
                           if (result.success && statusElement) {
                               statusElement.className = 'success';
                               statusElement.textContent = 'App Check: 已驗證 ✓';
                               setTimeout(() => { statusElement.style.display = 'none'; }, 3000);
                           }
                       } catch (error) {
                           console.warn('延遲 App Check 檢查失敗:', error);
                       }
                   }
               }, 5000);
           }
       } catch (error) {
           console.error('檢查 App Check 狀態時發生錯誤:', error);
       }
   }, 1000);
   
   // 初始化文件上傳功能
   try {
       if (typeof enhancedFileUploadInit === 'function') {
           enhancedFileUploadInit();
       }
   } catch (uploadInitError) {
       console.warn('初始化文件上傳功能失敗:', uploadInitError);
   }
   
   // 初始化會話管理器
   try {
       if (typeof setupSessionManager === 'function') {
           setupSessionManager();
       }
   } catch (sessionError) {
       console.warn('初始化會話管理器失敗:', sessionError);
   }
   
   // 綁定按鈕事件
   try {
       const registerForm = document.getElementById('businessRegisterForm');
       
       if (registerForm) {
           console.log("找到註冊表單元素", registerForm);
           
           // 註冊表單提交事件
           registerForm.addEventListener('submit', function(e) {
               e.preventDefault();
               console.log("表單提交事件觸發");
               
               // 調用提交處理函數
               if (typeof window.handleRegisterSubmit === 'function') {
                   window.handleRegisterSubmit(e);
               } else {
                   console.error("handleRegisterSubmit 函數不可用");
                   alert("提交處理函數不可用，請刷新頁面後重試");
               }
           });
           
           // 下一步按鈕點擊事件
           const nextButtons = document.querySelectorAll('.btn-next');
           console.log("找到下一步按鈕:", nextButtons.length);
           
           nextButtons.forEach(button => {
               console.log("設置按鈕事件:", button.getAttribute('data-step'));
               
               button.addEventListener('click', function(e) {
                   e.preventDefault();
                   const currentStep = parseInt(this.getAttribute('data-step'));
                   console.log("下一步按鈕被點擊，當前步驟:", currentStep);
                   
                   // 調用下一步函數
                   if (typeof window.nextStep === 'function') {
                       window.nextStep(currentStep);
                   } else {
                       console.error("nextStep 函數不可用，使用備用處理方式");
                       
                       // 使用備用方式處理下一步
                       const nextStepNum = currentStep + 1;
                       document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
                       document.getElementById(`step-${nextStepNum}-content`).classList.add('active');
                       
                       document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
                       document.getElementById(`step-${nextStepNum}`).classList.add('active');
                       
                       window.scrollTo({ top: 0, behavior: 'smooth' });
                   }
               });
           });
           
           // 上一步按鈕點擊事件
           const prevButtons = document.querySelectorAll('.btn-prev');
           prevButtons.forEach(button => {
               button.addEventListener('click', function(e) {
                   e.preventDefault();
                   const currentStep = parseInt(this.getAttribute('data-step'));
                   
                   // 調用上一步函數
                   if (typeof window.prevStep === 'function') {
                       window.prevStep(currentStep);
                   } else {
                       console.error("prevStep 函數不可用，使用備用處理方式");
                       
                       // 使用備用方式處理上一步
                       if (currentStep > 1) {
                           const prevStepNum = currentStep - 1;
                           document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
                           document.getElementById(`step-${prevStepNum}-content`).classList.add('active');
                           
                           document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
                           document.getElementById(`step-${prevStepNum}`).classList.add('active');
                           
                           window.scrollTo({ top: 0, behavior: 'smooth' });
                       }
                   }
               });
           });
           
           // 密碼顯示/隱藏按鈕點擊事件
           const togglePassword = document.getElementById('togglePassword');
           if (togglePassword) {
               togglePassword.addEventListener('click', function() {
                   if (typeof window.togglePasswordVisibility === 'function') {
                       window.togglePasswordVisibility('password', 'togglePassword');
                   } else {
                       console.error("togglePasswordVisibility 函數不可用，使用備用處理方式");
                       
                       // 使用備用方式處理密碼顯示/隱藏
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
                   }
               });
           }
           
           const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
           if (toggleConfirmPassword) {
               toggleConfirmPassword.addEventListener('click', function() {
                   if (typeof window.togglePasswordVisibility === 'function') {
                       window.togglePasswordVisibility('confirmPassword', 'toggleConfirmPassword');
                   } else {
                       console.error("togglePasswordVisibility 函數不可用，使用備用處理方式");
                       
                       // 使用備用方式處理密碼顯示/隱藏
                       const confirmPasswordInput = document.getElementById('confirmPassword');
                       const icon = this.querySelector('i');
                       
                       if (confirmPasswordInput.type === 'password') {
                           confirmPasswordInput.type = 'text';
                           icon.classList.remove('fa-eye');
                           icon.classList.add('fa-eye-slash');
                       } else {
                           confirmPasswordInput.type = 'password';
                           icon.classList.remove('fa-eye-slash');
                           icon.classList.add('fa-eye');
                       }
                   }
               });
           }
       }
       else {
           console.warn("未找到註冊表單元素");
       }
       
       // 添加診斷信息
       console.log("DOM初始化完成，診斷關鍵函數:");
       console.log("- nextStep:", typeof window.nextStep === 'function' ? '可用' : '不可用');
       console.log("- prevStep:", typeof window.prevStep === 'function' ? '可用' : '不可用');
       console.log("- validateStep:", typeof window.validateStep === 'function' ? '可用' : '不可用');
       console.log("- togglePasswordVisibility:", typeof window.togglePasswordVisibility === 'function' ? '可用' : '不可用');
   } catch (buttonError) {
       console.error('綁定按鈕事件過程中發生錯誤:', buttonError);
   }
   
   // 密碼強度相關事件監聽
   try {
       const passwordInput = document.getElementById('password');
       const confirmPasswordInput = document.getElementById('confirmPassword');
       
       if (passwordInput) {
           passwordInput.addEventListener('input', function() {
               if (typeof window.updatePasswordStrength === 'function') {
                   window.updatePasswordStrength();
               }
           });
           
           // 初始化密碼強度顯示
           if (typeof window.updatePasswordStrength === 'function') {
               window.updatePasswordStrength();
           }
       }
       
       if (confirmPasswordInput) {
           confirmPasswordInput.addEventListener('input', function() {
               const password = document.getElementById('password').value;
               if (typeof window.updatePasswordRulesCheck === 'function') {
                   window.updatePasswordRulesCheck(password);
               }
           });
       }
   } catch (passwordError) {
       console.warn('設置密碼相關事件監聽器時發生錯誤:', passwordError);
   }
   
   // 添加診斷按鈕
   try {
       // 建議：使診斷按鈕更加隱蔽，以免影響用戶體驗
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
           if (typeof addDiagnosticsPanel === 'function') {
               addDiagnosticsPanel();
               diagnosticsBtn.style.display = 'none';
           } else {
               alert('診斷功能未加載，請刷新頁面後重試');
           }
       });
       
       // 添加到頁面
       document.body.appendChild(diagnosticsBtn);
   } catch (diagnosticsError) {
       console.warn('添加診斷按鈕時發生錯誤:', diagnosticsError);
   }
   
   // 設置自動恢復機制
   setTimeout(() => {
       setupAutoRecovery();
   }, 3000);
});

// 處理文件上傳按鈕的點擊事件
function uploadBusinessLicense(e) {
   // 優先使用改進的處理函數
   if (typeof improvedFileUploadHandler === 'function') {
       improvedFileUploadHandler(e);
   } else {
       console.warn('找不到文件上傳處理函數，使用內建處理');
       
       // 簡單的文件處理邏輯
       const files = e.target.files || (e.dataTransfer ? e.dataTransfer.files : null);
       if (files && files.length > 0) {
           Array.from(files).forEach(file => {
               // 創建檔案預覽
               const reader = new FileReader();
               reader.onload = function(event) {
                   uploadedFiles.push({
                       id: `file-${Date.now()}-${uploadedFiles.length}`,
                       file: file,
                       fileName: file.name,
                       preview: event.target.result,
                       isPDF: file.type === 'application/pdf'
                   });
                   
                   // 更新上傳計數和預覽
                   updateUploadCount();
                   if (typeof enhancedUploadPreview === 'function') {
                       enhancedUploadPreview();
                   }
               };
               reader.readAsDataURL(file);
           });
       }
   }
   
   // 如果是input元素，重置它的value，以便可以重複選擇相同文件
   if (e.target && e.target.type === 'file') {
       e.target.value = '';
   }
}

// 延遲檢查函數是否可用，並添加備用處理
setTimeout(function() {
   console.log("延遲檢查關鍵函數...", new Date().toISOString());
   
   // 檢查函數可用性
   const nextStepAvailable = typeof window.nextStep === 'function';
   const prevStepAvailable = typeof window.prevStep === 'function';
   const togglePasswordAvailable = typeof window.togglePasswordVisibility === 'function';
   const updatePasswordStrengthAvailable = typeof window.updatePasswordStrength === 'function';
   
   console.log("關鍵函數可用性檢查:", {
       nextStep: nextStepAvailable ? '✓' : '✗',
       prevStep: prevStepAvailable ? '✓' : '✗',
       togglePassword: togglePasswordAvailable ? '✓' : '✗',
       updatePasswordStrength: updatePasswordStrengthAvailable ? '✓' : '✗'
   });
   
   // 添加備用處理機制
   if (!nextStepAvailable || !prevStepAvailable || !togglePasswordAvailable || !updatePasswordStrengthAvailable) {
       console.warn("檢測到部分函數不可用，嘗試重新導出全局函數");
       ensureGlobalFunctions();
       
       // 再次檢查
       setTimeout(() => {
           const stillMissing = [];
           if (typeof window.nextStep !== 'function') stillMissing.push('nextStep');
           if (typeof window.prevStep !== 'function') stillMissing.push('prevStep');
           if (typeof window.togglePasswordVisibility !== 'function') stillMissing.push('togglePasswordVisibility');
           if (typeof window.updatePasswordStrength !== 'function') stillMissing.push('updatePasswordStrength');
           
           if (stillMissing.length > 0) {
               console.warn("嘗試導出後仍有缺失函數:", stillMissing.join(', '));
               
               // 直接設置事件處理程序，繞過全局函數
               console.log("嘗試直接設置按鈕事件處理程序");
               setupDirectButtonHandlers();
               
               // 檢查並修復可能的 reCAPTCHA 跨域問題
               console.log("嘗試修復 reCAPTCHA 跨域問題");
               fixReCaptchaCORSIssue();
           } else {
               console.log("函數重新導出成功");
           }
       }, 500);
   }
}, 2000);

// 在頁面加載完成後執行最終檢查
window.addEventListener('load', function() {
   console.log("頁面完全加載完成，進行最終檢查...");
   
   // 最終檢查所有關鍵功能
   const finalCheck = {
       nextStep: typeof window.nextStep === 'function',
       prevStep: typeof window.prevStep === 'function',
       validateStep: typeof window.validateStep === 'function',
       togglePasswordVisibility: typeof window.togglePasswordVisibility === 'function',
       updatePasswordStrength: typeof window.updatePasswordStrength === 'function',
       handleRegisterSubmit: typeof window.handleRegisterSubmit === 'function'
   };
   
   console.log("最終功能檢查結果:", finalCheck);
   
   // 如果仍有問題，嘗試最後的修復
   const missingFunctions = Object.entries(finalCheck)
       .filter(([_, available]) => !available)
       .map(([name, _]) => name);
   
   if (missingFunctions.length > 0) {
       console.warn("頁面加載完成後仍有缺失函數:", missingFunctions.join(', '));
       console.log("執行最終緊急修復...");
       
       // 強制重新導出
       ensureGlobalFunctions();
       
       // 直接綁定事件處理
       setupDirectButtonHandlers();
       
       // 嘗試修復 App Check
       forceInitializeAppCheck();
   } else {
       console.log("所有核心功能已正確加載");
   }
   
   // 最後檢查文件上傳功能
   const uploadContainer = document.getElementById('photoPreviewContainer');
   const uploadInput = document.getElementById('businessLicenseFile');
   
   if (uploadContainer && uploadInput) {
       console.log("檢查文件上傳功能...");
       
       // 確保預覽區域正確初始化
       if (typeof enhancedUploadPreview === 'function') {
           enhancedUploadPreview();
       }
       
       // 確保上傳事件處理
       if (typeof improvedFileUploadHandler === 'function') {
           uploadInput.removeEventListener('change', uploadBusinessLicense);
           uploadInput.addEventListener('change', improvedFileUploadHandler);
       }
   }
   
   // 添加狀態指示器（可選）
   const statusElement = document.createElement('div');
   statusElement.style.position = 'fixed';
   statusElement.style.bottom = '5px';
   statusElement.style.left = '5px';
   statusElement.style.fontSize = '10px';
   statusElement.style.color = '#007bff';
   statusElement.style.zIndex = '9999';
   statusElement.style.opacity = '0.5';
   statusElement.textContent = '頁面已完全加載';
   document.body.appendChild(statusElement);
   
   // 3秒後隱藏
   setTimeout(() => {
       statusElement.style.display = 'none';
   }, 3000);
});