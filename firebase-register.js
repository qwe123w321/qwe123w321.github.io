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

import { setupSessionManager } from './session-manager.js';

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
    // 參數驗證
    if (!email || email.trim() === '') {
        console.error('嘗試檢查空的電子郵件');
        return { available: false }; // 空的電子郵件被視為不可用
    }

    try {
        // 清理並規範化電子郵件
        const normalizedEmail = email.trim().toLowerCase();
        console.log('開始檢查電子郵件可用性:', normalizedEmail);
        
        // 準備參數 - 使用與 Firebase Function 預期的結構
        const params = { email: normalizedEmail };
        
        // 調用 Firebase 函數 - 使用 { data: ... } 結構
        const result = await checkEmailAvailability(params);
        
        // 記錄完整的回應
        console.log('電子郵件可用性檢查完整回應:', result.data);
        
        // 檢查回應格式
        if (result.data && typeof result.data === 'object' && 'available' in result.data) {
            return {
                available: result.data.available || false,
                timestamp: result.data.timestamp
            };
        } else {
            console.warn('回應格式異常:', result.data);
            return { available: false }; // 出於安全考量，回應異常時假設電子郵件不可用
        }
    } catch (error) {
        // 處理 Firebase Functions 異常
        if (error.code) {
            console.error(`Firebase 函數異常: [${error.code}] ${error.message}`, error);
            if (error.details) {
                console.error('詳細錯誤信息:', error.details);
            }
        } else {
            // 處理所有其他異常
            console.error('檢查電子郵件可用性時發生錯誤:', error);
        }
        
        // 返回錯誤結果
        return { 
            available: false,
            error: error.message
        };
    }
}

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

// 更新密碼強度視覺顯示
function updatePasswordStrength() {
    const password = document.getElementById('password').value;
    const strengthResult = measurePasswordStrength(password);
    
    // 更新強度指示條
    const strengthBar = document.getElementById('password-strength-bar');
    strengthBar.className = `progress-bar ${strengthResult.class}`;
    
    // 根據密碼長度和強度設置寬度
    if (password.length === 0) {
        strengthBar.style.width = '0%';
    } else {
        let percentage;
        if (password.length <= 20) {
            percentage = Math.min(100, (password.length / 20) * 100);
        } else {
            // 如果超過20字符，將進度條設為100%但顏色可能不是綠色(依據複雜度)
            percentage = 100;
        }
        strengthBar.style.width = `${percentage}%`;
    }
    
    // 更新強度標籤
    const strengthLabel = document.getElementById('password-strength-text');
    if (password.length === 0) {
        strengthLabel.textContent = '';
    } else {
        strengthLabel.textContent = `密碼強度: ${strengthResult.strength === 'weak' ? '弱' : strengthResult.strength === 'medium' ? '中' : '強'}`;
    }
    
    // 更新密碼規則檢查
    updatePasswordRulesCheck(password);
}

// 更新密碼規則檢查
function updatePasswordRulesCheck(password) {
    // 檢查各項規則
    const lengthCheck = password.length >= 8 && password.length <= 20;
    const lowercaseCheck = /[a-z]/.test(password);
    const uppercaseCheck = /[A-Z]/.test(password);
    const numberCheck = /[0-9]/.test(password);
    
    // 更新規則顯示
    document.getElementById('rule-length').className = lengthCheck ? 'text-success' : 'text-danger';
    document.getElementById('rule-lowercase').className = lowercaseCheck ? 'text-success' : 'text-danger';
    document.getElementById('rule-uppercase').className = uppercaseCheck ? 'text-success' : 'text-danger';
    document.getElementById('rule-number').className = numberCheck ? 'text-success' : 'text-danger';
    
    // 更新圖標
    document.getElementById('rule-length-icon').className = lengthCheck ? 'fas fa-check' : 'fas fa-times';
    document.getElementById('rule-lowercase-icon').className = lowercaseCheck ? 'fas fa-check' : 'fas fa-times';
    document.getElementById('rule-uppercase-icon').className = uppercaseCheck ? 'fas fa-check' : 'fas fa-times';
    document.getElementById('rule-number-icon').className = numberCheck ? 'fas fa-check' : 'fas fa-times';
    
    // 更新確認密碼檢查
    const confirmPassword = document.getElementById('confirmPassword').value;
    const matchCheck = password === confirmPassword && password !== '';
    
    if (confirmPassword !== '') {
        document.getElementById('rule-match').className = matchCheck ? 'text-success' : 'text-danger';
        document.getElementById('rule-match-icon').className = matchCheck ? 'fas fa-check' : 'fas fa-times';
    }
}

// 密碼強度相關事件監聽
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');

if (passwordInput) {
    passwordInput.addEventListener('input', updatePasswordStrength);
    // 初始化顯示
    updatePasswordStrength();
}

if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', function() {
        const password = document.getElementById('password').value;
        updatePasswordRulesCheck(password);
    });
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
                
                // 使用更新的 validateEmail 函數
                const result = await validateEmail(email.value);
                
                // 恢復按鈕狀態
                nextButton.textContent = originalText;
                nextButton.disabled = false;
                
                if (!result.available) {
                    // 如果有特定錯誤訊息顯示它
                    const errorMessage = result.error ? 
                        `電子郵件檢查失敗: ${result.error}` : 
                        '此電子郵件已被註冊，請使用其他電子郵件';
                    
                    showFieldError(email, errorMessage);
                    isValid = false;
                    
                    // 在控制台中記錄詳細資訊
                    console.warn('電子郵件驗證失敗:', result);
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

// 全局變量存儲上傳的檔案
let uploadedFiles = [];

// 更新上傳預覽區域
function updateUploadPreview() {
    const uploadPreview = document.getElementById('photoPreviewContainer');
    
    // 檢查元素是否存在
    if (!uploadPreview) {
        console.warn('找不到上傳預覽容器元素 (photoPreviewContainer)');
        return; // 提前返回，避免錯誤
    }
    
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
        
        // 更新上傳計數
        updateUploadCount();
    }
}

// 格式化檔案大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
}

// 壓縮圖片
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function() {
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
            };
            img.onerror = function(error) {
                reject(error);
            };
        };
        reader.onerror = function(error) {
            reject(error);
        };
    });
}

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

// 初始化文件上傳功能
function initializeFileUpload() {
    const businessLicenseFile = document.getElementById('businessLicenseFile');
    const photoPreviewContainer = document.getElementById('photoPreviewContainer');
    const uploadProgress = document.getElementById('uploadProgress');
    
    if (!businessLicenseFile || !photoPreviewContainer) {
        console.warn('找不到上傳或預覽元素');
        return;
    }
    
    const MAX_UPLOAD_COUNT = 5; // 最大上傳張數
    const MAX_FILE_SIZE_MB = 5; // 每個文件最大 5MB
    
    // 處理文件上傳
    businessLicenseFile.addEventListener('change', async function(e) {
        const files = Array.from(e.target.files);
        
        if (uploadedFiles.length + files.length > MAX_UPLOAD_COUNT) {
            alert(`最多只能上傳 ${MAX_UPLOAD_COUNT} 張照片`);
            return;
        }
        
        for (const file of files) {
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                alert(`文件 ${file.name} 超過大小限制（${MAX_FILE_SIZE_MB}MB）`);
                continue;
            }
            
            try {
                // 顯示上傳進度
                if (uploadProgress) {
                    uploadProgress.style.display = 'block';
                }
                
                // 壓縮圖片（如果是圖片類型）
                let processedFile = file;
                if (file.type.startsWith('image/')) {
                    processedFile = await compressImage(file);
                }
                
                // 添加到上傳文件列表
                const fileId = `file-${Date.now()}-${uploadedFiles.length}`;
                uploadedFiles.push({
                    id: fileId,
                    file: processedFile,
                    fileName: file.name,
                    preview: URL.createObjectURL(processedFile)
                });
                
                // 更新上傳計數和預覽
                updateUploadCount();
                updateUploadPreview();
                
                // 隱藏上傳進度
                if (uploadProgress) {
                    uploadProgress.style.display = 'none';
                }
            } catch (error) {
                console.error('處理文件錯誤:', error);
                alert(`處理文件 ${file.name} 時發生錯誤`);
                if (uploadProgress) {
                    uploadProgress.style.display = 'none';
                }
            }
        }
        
        // 重置文件輸入，以便可以重新選擇相同的文件
        businessLicenseFile.value = '';
    });
    
    // 使用 DnD (Drag and Drop) 上傳
    const uploadArea = document.querySelector('.custom-file-upload');
    
    if (uploadArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, unhighlight, false);
        });
        
        function highlight() {
            uploadArea.classList.add('highlight');
        }
        
        function unhighlight() {
            uploadArea.classList.remove('highlight');
        }
        
        uploadArea.addEventListener('drop', handleDrop, false);
        
        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            businessLicenseFile.files = files;
            
            // 觸發 change 事件
            const event = new Event('change', { bubbles: true });
            businessLicenseFile.dispatchEvent(event);
        }
    }
    
    // 初始更新預覽
    updateUploadPreview();
    // 初始更新計數
    updateUploadCount();
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
        
        // 如果是第3步，顯示提交按鈕
        if (nextStep === 3) {
            document.querySelector('.btn-submit').style.display = 'block';
        }
        
        // 如果進入第4步，更新摘要信息
        if (nextStep === 4) {
            updateSummaryInfo();
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

// 改進文件上傳處理和預覽顯示
// 添加以下函數到 firebase-register.js

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

// 改進文件上傳處理
function improvedFileUploadHandler(e) {
    const files = Array.from(e.target.files);
    const MAX_UPLOAD_COUNT = 5; // 最大上傳張數
    const MAX_FILE_SIZE_MB = 5; // 每個文件最大 5MB
    
    if (uploadedFiles.length + files.length > MAX_UPLOAD_COUNT) {
        alert(`最多只能上傳 ${MAX_UPLOAD_COUNT} 個檔案`);
        return;
    }
    
    for (const file of files) {
        // 檢查文件類型
        if (!isAllowedFileType(file)) {
            alert(`不支援的檔案類型: ${file.name}\n僅支援 JPG、PNG 和 PDF 格式`);
            continue;
        }
        
        // 檢查文件大小
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            alert(`檔案 ${file.name} 超過大小限制（${MAX_FILE_SIZE_MB}MB）`);
            continue;
        }
        
        try {
            // 顯示上傳進度
            const uploadProgress = document.getElementById('uploadProgress');
            if (uploadProgress) {
                uploadProgress.style.display = 'block';
            }
            
            // 處理檔案（圖片類型將進行壓縮）
            processFile(file).then(processedFile => {
                // 添加到上傳文件列表
                const fileId = `file-${Date.now()}-${uploadedFiles.length}`;
                const fileType = processedFile.type;
                const fileExt = getFileExtension(processedFile.name);
                
                let previewUrl;
                // if (fileType === 'application/pdf') {
                //     // PDF 使用自定義預覽圖示
                //     previewUrl = 'pdf-icon.png'; // 替換為您的PDF圖示URL
                // } else {
                //     // 圖片使用實際預覽
                //     previewUrl = URL.createObjectURL(processedFile);
                // }
                previewUrl = URL.createObjectURL(processedFile);
                
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
                updateUploadPreview();
                
                // 隱藏上傳進度
                if (uploadProgress) {
                    uploadProgress.style.display = 'none';
                }
            }).catch(error => {
                console.error('處理檔案錯誤:', error);
                alert(`處理檔案 ${file.name} 時發生錯誤`);
                
                if (uploadProgress) {
                    uploadProgress.style.display = 'none';
                }
            });
        } catch (error) {
            console.error('文件處理錯誤:', error);
            alert(`處理檔案 ${file.name} 時發生錯誤`);
            
            const uploadProgress = document.getElementById('uploadProgress');
            if (uploadProgress) {
                uploadProgress.style.display = 'none';
            }
        }
    }
    
    // 重置檔案輸入，以便可以重新選擇相同的檔案
    e.target.value = '';
}

// 處理檔案（包括壓縮圖片）
async function processFile(file) {
    return new Promise(async (resolve, reject) => {
        try {
            if (file.type.startsWith('image/')) {
                // 圖片檔案進行壓縮
                const compressedFile = await compressImage(file);
                resolve(compressedFile);
            } else {
                // 其他類型檔案直接傳遞
                resolve(file);
            }
        } catch (error) {
            reject(error);
        }
    });
}

// 創建一個統一的文件預覽渲染函數，可供多處使用
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
    if (showDeleteButton && typeof removeUploadedFile === 'function') {
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
            removeUploadedFile(index);
        });
        
        cardDiv.appendChild(deleteButton);
    }
    
    colDiv.appendChild(cardDiv);
    return colDiv;
}

// 更新檔案預覽顯示
function enhancedUploadPreview() {
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
}


// 3. 添加第四步摘要信息功能
function updateSummaryInfo() {
    const summaryContainer = document.querySelector('.summary-info .row');
    if (!summaryContainer) return;
    
    // 清空原有內容
    summaryContainer.innerHTML = '';
    
    // 獲取各步驟的輸入值
    const email = document.getElementById('email').value;
    const businessName = document.getElementById('businessName').value;
    const businessType = document.getElementById('businessType');
    const businessTypeName = businessType.options[businessType.selectedIndex]?.text || '';
    const businessAddress = document.getElementById('businessAddress').value;
    const businessPhone = document.getElementById('businessPhone').value;
    const contactName = document.getElementById('contactName').value;
    const contactPhone = document.getElementById('contactPhone').value;
    const uploadedFilesCount = uploadedFiles.length;
    
    // 創建摘要項目
    const summaryItems = [
        { label: '電子郵件', value: email },
        { label: '店家名稱', value: businessName },
        { label: '店家類型', value: businessTypeName },
        { label: '店家地址', value: businessAddress },
        { label: '店家電話', value: businessPhone },
        { label: '聯絡人姓名', value: contactName },
        { label: '聯絡人電話', value: contactPhone },
        { label: '上傳證明文件', value: `${uploadedFilesCount}個檔案` }
    ];
    
    // 顯示基本信息
    summaryItems.forEach(item => {
        const col = document.createElement('div');
        col.className = 'col-md-12 mb-2';
        col.innerHTML = `
            <div class="d-flex">
                <div class="fw-bold me-3" style="min-width: 120px;">${item.label}:</div>
                <div class="text-break">${item.value || '尚未填寫'}</div>
            </div>
        `;
        summaryContainer.appendChild(col);
    });
    
    // 添加文件預覽區域（如果有上傳文件）
    if (uploadedFilesCount > 0) {
        // 創建標題行
        const titleRow = document.createElement('div');
        titleRow.className = 'col-12 mt-4 mb-2';
        titleRow.innerHTML = '<h6 class="fw-bold">已上傳檔案:</h6>';
        summaryContainer.appendChild(titleRow);
        
        // 創建預覽區域
        const filesGrid = document.createElement('div');
        filesGrid.className = 'row g-3';
        
        // 使用統一函數渲染預覽，但不顯示刪除按鈕
        uploadedFiles.forEach((file, index) => {
            const filePreviewEl = renderFilePreview(file, index, false);
            filesGrid.appendChild(filePreviewEl);
        });
        
        const filesContainer = document.createElement('div');
        filesContainer.className = 'col-12';
        filesContainer.appendChild(filesGrid);
        summaryContainer.appendChild(filesContainer);
    }
}

// 替換原有的初始化文件上傳功能
function enhancedFileUploadInit() {
    const businessLicenseFile = document.getElementById('businessLicenseFile');
    const uploadArea = document.querySelector('.custom-file-upload');
    
    if (!businessLicenseFile) {
        console.warn('找不到文件上傳輸入元素');
        return;
    }
    
    // 處理文件上傳事件
    businessLicenseFile.addEventListener('change', improvedFileUploadHandler);
    
    // 設置拖放上傳
    if (uploadArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, unhighlight, false);
        });
        
        function highlight() {
            uploadArea.classList.add('highlight');
        }
        
        function unhighlight() {
            uploadArea.classList.remove('highlight');
        }
        
        uploadArea.addEventListener('drop', function(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            // 直接處理拖放文件
            const fileArray = Array.from(files);
            
            const changeEvent = {
                target: {
                    files: files,
                    value: '' // 模擬value，方便重置
                }
            };
            
            improvedFileUploadHandler(changeEvent);
        }, false);
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

// 設置第三步驟的欄位驗證
function setupStep3Validation() {
    // 獲取第三步驟的欄位
    const contactName = document.getElementById('contactName');
    const contactPhone = document.getElementById('contactPhone');
    const termsCheck = document.getElementById('termsCheck');
    
    // 為聯絡人姓名添加事件監聽
    if (contactName) {
        contactName.addEventListener('input', function() {
            if (this.value.trim() !== '') {
                clearFieldError(this);
            }
        });
        
        // 在進入下一步或上一步時也檢查
        contactName.addEventListener('blur', function() {
            if (this.value.trim() === '') {
                showFieldError(this, '請輸入聯絡人姓名');
            }
        });
    }
    
    // 為聯絡人電話添加事件監聽
    if (contactPhone) {
        contactPhone.addEventListener('input', function() {
            if (this.value.trim() !== '') {
                if (isValidPhone(this.value)) {
                    clearFieldError(this);
                } else if (this.value.trim().length >= 4) {
                    // 當輸入超過4個字符時才開始驗證
                    showFieldError(this, '請輸入有效的電話號碼');
                }
            }
        });
        
        contactPhone.addEventListener('blur', function() {
            if (this.value.trim() === '') {
                showFieldError(this, '請輸入聯絡人電話');
            } else if (!isValidPhone(this.value)) {
                showFieldError(this, '請輸入有效的電話號碼');
            }
        });
    }
    
    // 為條款確認框添加事件監聽
    if (termsCheck) {
        termsCheck.addEventListener('change', function() {
            if (this.checked) {
                clearFieldError(this);
            } else {
                showFieldError(this, '請同意服務條款與隱私政策');
            }
        });
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
   
    // 初始化文件上傳功能
    enhancedFileUploadInit();
    
    // 監聽第三步驟的輸入欄位
    setupStep3Validation();

    // 初始化會話管理器
    const sessionManager = setupSessionManager();
    
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
        
        // 文件選擇變更事件 - 使用正確的處理函數
        const fileInput = document.getElementById('businessLicenseFile');
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
        
        // 初始化上傳預覽區域 - 使用增強版
        if (document.getElementById('photoPreviewContainer')) {
            enhancedUploadPreview();
        } else {
            console.warn('初始化時找不到 photoPreviewContainer 元素');
        }
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

// 處理文件上傳按鈕的點擊事件
function uploadBusinessLicense(e) {
    // 檢查是否存在改進的處理函數，如果存在則優先使用
    if (typeof improvedFileUploadHandler === 'function') {
        improvedFileUploadHandler(e);
    }
    // 如果都不存在，直接處理檔案
    else {
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
                    enhancedUploadPreview();
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
window.updateUploadPreview = enhancedUploadPreview;
window.formatFileSize = formatFileSize;

// 密碼顯示/隱藏
window.togglePasswordVisibility = togglePasswordVisibility;

// 註冊表單提交
window.handleRegisterSubmit = handleRegisterSubmit;