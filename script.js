document.addEventListener('DOMContentLoaded', function() {
    // 導航欄滾動效果
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 平滑滾動
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 70,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 表單提交處理
    const businessForm = document.getElementById('businessForm');
    if (businessForm) {
        businessForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // 獲取表單數據
            const businessName = document.getElementById('businessName').value;
            const contactPerson = document.getElementById('contactPerson').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const businessType = document.getElementById('businessType').value;
            const message = document.getElementById('message').value;
            
            // 在實際應用中，這裡會發送數據到伺服器
            // 這裡僅顯示提交成功的訊息
            alert(`感謝您的合作意向！\n\n商家名稱: ${businessName}\n聯絡人: ${contactPerson}\n\n我們將盡快與您聯繫。`);
            
            // 重置表單
            businessForm.reset();
        });
    }

    // 添加動畫效果
    const animateElements = document.querySelectorAll('.feature-card, .pain-point-card');
    
    // 檢查元素是否在視窗中
    function checkIfInView() {
        animateElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 150;
            
            if (elementTop < window.innerHeight - elementVisible) {
                element.classList.add('animate');
            }
        });
    }
    
    // 初始檢查
    checkIfInView();
    
    // 滾動時檢查
    window.addEventListener('scroll', checkIfInView);

    // 添加文字淡入效果
    const heroTitle = document.querySelector('.hero-section h1');
    const heroSubtitle = document.querySelector('.hero-section h2');
    const heroParagraph = document.querySelector('.hero-section p');
    
    if (heroTitle && heroSubtitle && heroParagraph) {
        setTimeout(() => {
            heroTitle.style.opacity = '1';
            heroTitle.style.transform = 'translateY(0)';
            
            setTimeout(() => {
                heroSubtitle.style.opacity = '1';
                heroSubtitle.style.transform = 'translateY(0)';
                
                setTimeout(() => {
                    heroParagraph.style.opacity = '1';
                    heroParagraph.style.transform = 'translateY(0)';
                }, 200);
            }, 200);
        }, 300);
    }

    // 添加卡片懸停效果
    const cards = document.querySelectorAll('.feature-card, .pain-point-card');
    
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
            this.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.1)';
            this.style.borderColor = '#b39b7d';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.05)';
            this.style.borderColor = 'rgba(179, 155, 125, 0.1)';
        });
    });

    // 添加圖片懸停效果
    const heroImage = document.querySelector('.hero-image');
    if (heroImage) {
        heroImage.addEventListener('mouseenter', function() {
            this.style.transform = 'perspective(1000px) rotateY(0deg)';
            this.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.4)';
        });
        
        heroImage.addEventListener('mouseleave', function() {
            this.style.transform = 'perspective(1000px) rotateY(-15deg)';
            this.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.3)';
        });
    }
}); 