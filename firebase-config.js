// Firebase 配置
const firebaseConfig = {
    apiKey: "AIzaSyDslE4rgN8ZiUam3MCT_bJiSfusUxZS-wU",
    authDomain: "test1-b1d68.firebaseapp.com",
    databaseURL: "https://test1-b1d68-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "test1-b1d68",
    storageBucket: "test1-b1d68.appspot.com",
    messagingSenderId: "1010412789448",
    appId: "1:1010412789448:web:2843afa459b3644d118ffd",
    measurementId: "G-X7RQ8DRZ7P"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// 設置一些安全性選項
auth.useDeviceLanguage(); // 使用用戶設備語言

// 網頁會話持久性設置
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);