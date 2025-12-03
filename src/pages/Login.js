import React from 'react';
// import { useGoogleLogin } from '@react-oauth/google'; // 제거
// import axios from 'axios'; // 제거
import './css/Login.css';
import { supabase } from '../supabaseClient'; // Supabase 클라이언트 가져오기

const imgDeviconGoogle = "/img/google-icon.svg";

// function Login({ onLoginSuccess }) { // onLoginSuccess 제거
function Login() { // 수정
  // const handleGoogleLogin = useGoogleLogin({ ... }); // 제거
  const handleGoogleLogin = async () => { // Supabase OAuth 로그인 시작 함수로 변경
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });

      if (error) {
        console.error('Supabase Google OAuth 로그인 시작 실패:', error);
        alert('로그인 시작 중 오류가 발생했습니다: ' + error.message);
      }
    } catch (err) {
      console.error('handleGoogleLogin 함수 실행 중 예외 발생:', err);
      alert('로그인 시작 중 예상치 못한 오류가 발생했습니다: ' + err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-card-inner">
          <p className="login-title">미림도미</p>
          <button className="google-login-button" onClick={handleGoogleLogin}>
            <div className="google-icon">
              <img alt="Google" src={imgDeviconGoogle} />
            </div>
            <p className="google-login-text">구글 계정으로 로그인</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;