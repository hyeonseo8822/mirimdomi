import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/notice.css';
import { supabase } from '../supabaseClient';

// 로컬 이미지 경로
const arrowRightIcon = "/img/arrow-right.svg";

function Notice() {
  const navigate = useNavigate();
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  // 현재 날짜 포맷팅
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 날짜 포맷팅 함수 (created_at을 YYYY.MM.DD 형식으로 변환)
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 공지사항 데이터 가져오기
  const fetchNotices = async () => {
    setLoading(true);
    try {
      console.log('공지사항 데이터 가져오기 시작...');
      
      // 먼저 'notice' 테이블 시도
      let { data, error } = await supabase
        .from('notice')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('공지사항 쿼리 결과 (notice):', { data, error, dataLength: data?.length });

      // 에러가 있고 테이블을 찾을 수 없다면 'notices' 시도
      if (error && (error.message?.includes('relation') || error.message?.includes('does not exist'))) {
        console.log('notice 테이블을 찾을 수 없음, notices 테이블 시도...');
        const result = await supabase
          .from('notices')
          .select('*')
          .order('created_at', { ascending: false });
        data = result.data;
        error = result.error;
        console.log('공지사항 쿼리 결과 (notices):', { data, error, dataLength: data?.length });
      }

      if (error) {
        console.error('공지사항 불러오기 실패:', error);
        console.error('에러 상세:', JSON.stringify(error, null, 2));
        alert('공지사항을 불러오는 중 오류가 발생했습니다: ' + error.message);
        setNotices([]);
        return;
      }

      if (!data) {
        console.warn('데이터가 null입니다.');
        setNotices([]);
        return;
      }

      console.log('가져온 공지사항 데이터:', data);
      console.log('데이터 개수:', data.length);

      // 데이터 포맷 변환
      const formattedNotices = (data || []).map(notice => {
        if (!notice) {
          console.warn('null notice 발견');
          return null;
        }
        return {
          id: notice.id,
          title: notice.title || '(제목 없음)',
          date: formatDate(notice.created_at),
          content: notice.content || '',
        };
      }).filter(notice => notice !== null); // null 제거

      console.log('포맷팅된 공지사항:', formattedNotices);
      console.log('포맷팅된 공지사항 개수:', formattedNotices.length);
      
      setNotices(formattedNotices);
    } catch (error) {
      console.error('공지사항 가져오기 중 오류:', error);
      console.error('에러 스택:', error.stack);
      alert('공지사항을 불러오는 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
      setNotices([]);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 공지사항 가져오기
  useEffect(() => {
    fetchNotices();
  }, []);

  const handleNoticeClick = (notice) => {
    setSelectedNotice(notice);
  };

  // 디버깅: 렌더링 시 notices 상태 확인
  console.log('Notice 컴포넌트 렌더링:', { loading, noticesCount: notices.length, notices });

  return (
    <div className="notice">
      <div className="notice-header">
        <button className="back-button" onClick={() => navigate('/')}>
          <img src={arrowRightIcon} alt="뒤로가기" className="back-icon" />
        </button>
        <div className="notice-header-content">
          <h1 className="notice-title">공지사항</h1>
          <p className="notice-date">{getCurrentDate()}</p>
        </div>
      </div>

      <div className="notice-list-container">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>
        ) : (
          <div className="notice-list">
            {notices.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>공지사항이 없습니다.</div>
            ) : (
              notices.map((notice) => {
                console.log('공지사항 렌더링:', notice);
                return (
                  <div 
                    key={notice.id} 
                    className="notice-item"
                    onClick={() => handleNoticeClick(notice)}
                  >
                    <div className="notice-content">
                      <div className="notice-dot"></div>
                      <p className="notice-title-text">{notice.title}</p>
                    </div>
                    <p className="notice-date-text">{notice.date}</p>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 공지사항 상세 */}
      {selectedNotice && (
        <div className="notice-detail-container">
          <div className="notice-detail-header">
            <div className="notice-detail-title-section">
              <div className="notice-detail-title-row">
                <h2 className="notice-detail-title">{selectedNotice.title}</h2>
                <p className="notice-detail-date">{selectedNotice.date}</p>
              </div>
            </div>
          </div>
          <div className="notice-detail-content">
            <p>{selectedNotice.content}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Notice;
