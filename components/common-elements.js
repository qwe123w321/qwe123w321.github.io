// 載入頁腳
document.addEventListener('DOMContentLoaded', function() {
    // 載入頁腳
    fetch('components/footer.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('footer-placeholder').innerHTML = data;
        })
        .catch(error => console.error('載入頁腳時發生錯誤:', error));
    
    // 載入模態框
    fetch('components/terms.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('modals-placeholder').innerHTML = data;
        })
        .catch(error => console.error('載入模態框時發生錯誤:', error));
});