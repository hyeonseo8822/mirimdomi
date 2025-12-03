import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import UserInfoForm from './pages/UserInfoForm';
import Layout from './components/Layout/Layout';
import Main from './pages/main';
import Application from './pages/application';
import Community from './pages/community';
import Laundry from './pages/laundryResv';
import Profile from './pages/ProfileDetail';
import Notice from './pages/notice';
import Alarm from './pages/alarm';
import { supabase } from './supabaseClient'; // Supabase 클라이언트 임포트

import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // 초기 로딩 상태 추가

  // Supabase에서 사용자 프로필 정보 가져오기
  const fetchUserProfile = async (googleUserId) => {
    if (!googleUserId) {
      setUserInfo(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', googleUserId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116은 row not found, 새 사용자일 수 있음
        throw error;
      }

      if (data) {
        setUserInfo(data);
        setIsNewUser(!data.infocomplete); // 'infocomplete' 컬럼으로 새 사용자인지 판단
      } else {
        // Supabase에 정보가 없으면 새로운 사용자
        setUserInfo(prev => ({ ...prev, id: googleUserId })); // Google ID만 임시로 설정
        setIsNewUser(true);
      }
    } catch (error) {
      console.error('사용자 프로필 불러오기 실패:', error);
      // 에러 발생 시에도 새 사용자로 처리
      setUserInfo(prev => ({ ...prev, id: googleUserId }));
      setIsNewUser(true);
    }
  };

  // 페이지 로드 시 로그인 상태 확인 및 사용자 정보 로드
  useEffect(() => {
    let mounted = true;
    let authListener = null;

    // 사용자 프로필 로드 및 상태 설정 함수
    const loadUserProfile = async (session, forceReload = false) => {
      if (!mounted) return;
      
      if (!session || !session.user) {
        // 세션이 없으면 로그아웃 처리 (단, 초기화 중이 아니고 확실히 SIGNED_OUT인 경우만)
        // 여기서는 세션이 없으면 로그아웃으로 처리하지 않고 상태 유지
        setIsLoading(false);
        return;
      }

      // 세션이 있으면 먼저 로그인 상태로 설정 (프로필 로드 실패해도 로그인 상태 유지)
      setIsLoggedIn(true);
      
      try {
        // Supabase OAuth를 통해 로그인한 경우, Google 사용자 정보는 user metadata에 있음
        const googleUserId = session.user.user_metadata?.sub || 
                            session.user.user_metadata?.google_id || 
                            session.user.id;
        
        // Google 사용자 정보를 localStorage에 저장
        if (googleUserId && googleUserId !== session.user.id) {
          localStorage.setItem('googleUserId', googleUserId);
        } else if (!localStorage.getItem('googleUserId')) {
          // Supabase user ID를 사용 (users 테이블의 id가 Supabase UUID를 사용하는 경우)
          localStorage.setItem('googleUserId', session.user.id);
        }

        const googleUserIdFromStorage = localStorage.getItem('googleUserId');
        const userIdToFetch = googleUserIdFromStorage || session.user.id;
        
        // 프로필 로드 (forceReload가 false이고 이미 userInfo가 있으면 스킵)
        if (!forceReload && userInfo && userInfo.id === userIdToFetch) {
          console.log('사용자 정보가 이미 로드되어 있음 - 스킵');
          setIsLoading(false);
          return;
        }

        if (userIdToFetch) {
          await fetchUserProfile(userIdToFetch);
        } else {
          console.warn("Google User ID를 찾을 수 없습니다.");
          await fetchUserProfile(session.user.id);
        }
      } catch (error) {
        console.error('사용자 프로필 로드 중 오류:', error);
        // 프로필 로드 실패해도 세션이 있으면 로그인 상태는 유지
        // userInfo가 없으면 기본 정보라도 설정
        setUserInfo(prev => {
          if (prev && prev.id) {
            // 이미 userInfo가 있으면 유지
            return prev;
          }
          // 없으면 기본 정보 설정
          if (session?.user) {
            return {
              id: session.user.user_metadata?.sub || session.user.user_metadata?.google_id || session.user.id,
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '사용자',
            };
          }
          return null;
        });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // 초기 세션 확인 및 인증 리스너 설정
    const initializeAuth = async () => {
      try {
        // Supabase 인증 상태 변경 리스너 추가
        const { data: listenerData } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Supabase Auth State Change Event:', event);
            console.log('Supabase Auth State Change Session:', session ? '있음' : '없음');

            if (!mounted) return;

            // SIGNED_OUT 이벤트만 확실히 로그아웃 처리
            if (event === 'SIGNED_OUT') {
              setIsLoggedIn(false);
              setUserInfo(null);
              setIsLoading(false);
              localStorage.removeItem('googleAccessToken');
              localStorage.removeItem('googleUserId');
              return;
            }

            // SIGNED_IN 이벤트만 프로필 강제 리로드
            if (event === 'SIGNED_IN') {
              if (session && session.user) {
                await loadUserProfile(session, true); // 강제 리로드
                
                // OAuth 콜백인 경우 URL 정리
                if (window.location.hash.includes('access_token') || window.location.hash.includes('code=')) {
                  window.history.replaceState({}, document.title, '/main');
                }
              }
              return;
            }

            // TOKEN_REFRESHED나 INITIAL_SESSION은 세션이 있으면 상태만 확인 (프로필 리로드 안 함)
            if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
              if (session && session.user) {
                // 세션이 유효하면 로그인 상태 유지 (프로필은 리로드하지 않음)
                setIsLoggedIn(true);
                // userInfo가 없을 때만 로드
                if (!userInfo || !userInfo.id) {
                  await loadUserProfile(session);
                }
              } else {
                // 세션이 없지만 SIGNED_OUT이 아닌 경우는 무시 (갱신 중일 수 있음)
                console.log('세션이 없지만 SIGNED_OUT 이벤트가 아님 - 상태 유지');
              }
              return;
            }
          }
        );
        authListener = listenerData;

        // 초기 세션 확인
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('세션 확인 오류:', error);
          setIsLoading(false);
          // 에러가 발생해도 일단 로딩은 해제하고, 리스너가 나중에 처리하도록 함
          // 네트워크 오류 등일 수 있으므로 바로 로그아웃 처리하지 않음
          if (error.message?.includes('network') || error.message?.includes('fetch')) {
            // 네트워크 오류는 일시적일 수 있으므로 상태 유지
            console.warn('네트워크 오류로 세션 확인 실패 - 상태 유지');
            // 기존 로그인 상태가 있으면 유지
            if (isLoggedIn && userInfo) {
              // 상태 유지
            } else {
              setIsLoggedIn(false);
              setUserInfo(null);
            }
          } else {
            setIsLoggedIn(false);
            setUserInfo(null);
          }
          return;
        }

        if (session && session.user) {
          await loadUserProfile(session);
        } else {
          // 세션이 없으면 로그아웃 상태
          setIsLoggedIn(false);
          setUserInfo(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('인증 초기화 중 오류:', error);
        if (mounted) {
          setIsLoading(false);
          setIsLoggedIn(false);
          setUserInfo(null);
        }
      }
    };

    // 타임아웃 추가 - 최대 5초 후에는 무조건 로딩 해제
    const timeoutId = setTimeout(async () => {
      if (mounted && isLoading) {
        console.warn('세션 확인 타임아웃 - 로딩 상태 해제');
        setIsLoading(false);
        // 타임아웃 시에도 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          // 세션이 있으면 로그인 상태 유지
          setIsLoggedIn(true);
          if (!userInfo || !userInfo.id) {
            // userInfo가 없으면 로드
            await loadUserProfile(session);
          }
        } else if (!isLoggedIn) {
          setIsLoggedIn(false);
          setUserInfo(null);
        }
      }
    }, 5000);

    // 인증 초기화 실행
    initializeAuth();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (authListener) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);


  const handleUserInfoSubmit = async (formData) => {
    if (!userInfo?.id) {
      alert("사용자 정보를 저장할 ID를 찾을 수 없습니다.");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: formData.name,
          student_id: formData.studentId,
          room_number: formData.roomNumber,
          address: formData.address,
          infocomplete: true // 사용자 정보 입력 완료
        })
        .eq('id', userInfo.id);

      if (error) throw error;

      await fetchUserProfile(userInfo.id); // 업데이트 후 최신 정보 다시 가져오기
    } catch (error) {
      console.error('사용자 정보 업데이트 실패:', error);
      alert('사용자 정보 업데이트 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleLogout = async () => {
    // Supabase 세션 초기화
    await supabase.auth.signOut();
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleUserId');
    setIsLoggedIn(false);
    setIsNewUser(false);
    setUserInfo(null);
  };

  const handleUserProfileUpdate = async (updatedUserInfo) => {
    // ProfileDetail 또는 UserInfoForm에서 업데이트가 완료되면 호출되어 최신 정보를 가져옴
    // 즉시 로컬 상태 업데이트 (옵셔널)
    if (updatedUserInfo) {
      setUserInfo(updatedUserInfo);
    }
    
    // 서버에서 최신 정보 가져오기
    const userIdToFetch = updatedUserInfo?.id || userInfo?.id;
    if (userIdToFetch) {
      await fetchUserProfile(userIdToFetch);
    }
  };

  // 로딩 중일 때는 아무것도 렌더링하지 않음
  if (isLoading) {
    return (
      <div className="App" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>로딩 중...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {!isLoggedIn ? (
            <>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : isNewUser ? (
            <>
              <Route path="/user-info" element={<UserInfoForm userInfo={userInfo} onSubmit={handleUserInfoSubmit} onCancel={() => handleLogout()} />} />
              <Route path="*" element={<Navigate to="/user-info" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Layout userInfo={userInfo} onLogout={handleLogout} />}>
                <Route index element={<Navigate to="/main" replace />} />
                <Route path="main" element={<Main userInfo={userInfo} />} />
                <Route path="application" element={<Application userInfo={userInfo} />} />
                <Route path="community" element={<Community userInfo={userInfo} />} />
                <Route path="laundry" element={<Laundry userInfo={userInfo} />} />
                <Route path="profile" element={<Profile userInfo={userInfo} onUserProfileUpdate={handleUserProfileUpdate} />} />
                <Route path="notice" element={<Notice />} />
                <Route path="alarm" element={<Alarm />} />
              </Route>
              <Route path="*" element={<Navigate to="/main" replace />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App;