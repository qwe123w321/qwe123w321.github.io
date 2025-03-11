// 創建新文件 error-handler.js
// 集中處理錯誤顯示和日誌記錄

/**
 * 顯示錯誤訊息
 * @param {string} message - 要顯示的錯誤訊息
 * @param {string} type - 消息類型: 'danger', 'warning', 'info', 'success'
 * @param {HTMLElement} container - 要插入錯誤提示的容器元素
 */
function showAlert(message, type = 'danger', container = document.body) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // 如果容器是body，讓提示顯示在頂部
    if (container === document.body) {
        alertDiv.style.position = 'fixed';
        alertDiv.style.top = '20px';
        alertDiv.style.left = '50%';
        alertDiv.style.transform = 'translateX(-50%)';
        alertDiv.style.zIndex = '9999';
        alertDiv.style.minWidth = '300px';
    }
    
    container.prepend(alertDiv);
    
    // 5秒後自動消失
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
    
    // 同時記錄到控制台
    console.log(`${type.toUpperCase()}: ${message}`);
}

/**
 * 處理 Firebase 錯誤
 * @param {Error} error - Firebase 錯誤對象
 * @param {string} context - 錯誤發生的上下文
 * @returns {string} 用戶友好的錯誤訊息
 */
function handleFirebaseError(error, context = '') {
    // 記錄詳細錯誤信息
    console.error(`Firebase 錯誤 (${context}):`, error);
    
    // 返回用戶友好的錯誤訊息
    switch (error.code) {
        case 'auth/user-not-found':
            return '找不到該電子郵件對應的帳戶';
        case 'auth/wrong-password':
            return '密碼錯誤';
        case 'auth/email-already-in-use':
            return '此電子郵件已被使用';
        case 'auth/invalid-email':
            return '無效的電子郵件格式';
        case 'auth/weak-password':
            return '密碼強度不夠，請設置更複雜的密碼';
        case 'auth/too-many-requests':
            return '嘗試登入次數過多，請稍後再試';
        case 'auth/user-disabled':
            return '此帳戶已被停用，請聯繫客服';
        default:
            return `${context} 過程中發生錯誤，請稍後再試`;
    }
}