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

// 設置一些安全性選項
const auth = firebase.auth();
auth.useDeviceLanguage();
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

// 初始化其他服務
const db = firebase.firestore();
const storage = firebase.storage();

// 將服務暴露至全局範圍
window.auth = auth;
window.db = db;
window.storage = storage;