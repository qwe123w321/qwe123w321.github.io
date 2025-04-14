// 載入頁腳
document.addEventListener('DOMContentLoaded', function() {
    // 載入頁腳
    fetch('components/footer.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('footer-placeholder').innerHTML = data;
        })
        .catch(error => console.error('載入頁腳時發生錯誤:', error));
    
    // 不再需要載入模態框，因為條款、隱私政策和安全提醒現在是獨立頁面
    // 如果頁面上仍有其他模態框需要載入，可以保留以下代碼並修改路徑
    /*
    fetch('components/other-modals.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('modals-placeholder').innerHTML = data;
        })
        .catch(error => console.error('載入模態框時發生錯誤:', error));
    */
});