async function handleLogin(e) {
    e.preventDefault();
    
    try {
        // 1. 使用 Firebase Auth 登入
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // 2. 檢查是否為店家
        const businessDoc = await db.collection('businesses').doc(user.uid).get();
        
        if (businessDoc.exists) {
            // 是店家，導向店家後台
            window.location.href = 'business-dashboard.html';
        } else {
            // 不是店家，可能是普通用戶誤入
            await auth.signOut();
            showError('此帳號不是店家帳號，請使用店家帳號登入或註冊新的店家帳號');
        }
    } catch (error) {
        // 處理錯誤...
    }
}

document.getElementById('registerBtn').addEventListener('click', function() {
    window.location.href = 'business-register.html';
});

document.getElementById('signupLink').addEventListener('click', function(e) {
    e.preventDefault();
    window.location.href = 'business-register.html';
});