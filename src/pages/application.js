import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/application.css';
import { supabase } from '../supabaseClient';

// 로컬 이미지 경로
const calendarIcon = "/img/calendar-icon.svg";

function Application({ userInfo }) {
  const navigate = useNavigate();
  const [selectedMainTab, setSelectedMainTab] = useState('외박/잔류');
  const [selectedSubTab, setSelectedSubTab] = useState('외박');
  const [showOutgoingCalendar, setShowOutgoingCalendar] = useState(false);
  
  // 외출 날짜를 Date 객체로 관리
  const [outgoingDateObj, setOutgoingDateObj] = useState(new Date());
  const outgoingDate = `${outgoingDateObj.getFullYear()}. ${String(outgoingDateObj.getMonth() + 1).padStart(2, '0')}. ${String(outgoingDateObj.getDate()).padStart(2, '0')}`;
  
  const [outgoingReason, setOutgoingReason] = useState('');

  // 현재 날짜 정보
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  // 현재 달의 첫 토요일 계산
  const getFirstSaturday = () => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    // 첫 토요일 계산
    // 일요일(0) -> 6일, 월요일(1) -> 5일, 화요일(2) -> 4일, 수요일(3) -> 3일
    // 목요일(4) -> 2일, 금요일(5) -> 1일, 토요일(6) -> 1일
    if (firstDay === 6) return 1; // 첫날이 토요일
    if (firstDay === 0) return 6; // 첫날이 일요일
    return 7 - firstDay; // 나머지 경우
  };
  
  const [selectedDate, setSelectedDate] = useState(getFirstSaturday());

  // 이미 신청된 날짜들 (나중에 API에서 가져올 예정) - 실제 예약된 날짜만
  // 예시: 현재 달의 토요일 중 예약된 날짜들
  const appliedDates = [1, 8, 15, 22, 29]; // 실제로는 API에서 가져올 예정

  // 현재 날짜 포맷팅
  const getCurrentDate = () => {
    const year = currentYear;
    const month = String(currentMonth).padStart(2, '0');
    const day = String(currentDay).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 현재 달 달력 데이터 생성
  const generateCalendar = () => {
    const year = currentYear;
    const month = currentMonth;
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    
    const calendar = [];
    const weeks = [];
    
    // 이전 달 마지막 날들
    for (let i = prevMonthDays - firstDay + 1; i <= prevMonthDays; i++) {
      calendar.push({ day: i, isCurrentMonth: false, isWeekend: false });
    }
    
    // 현재 달 날들
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month - 1, i);
      const dayOfWeek = date.getDay();
      const isSaturday = dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;
      // 이미 예약된 날짜만 applied 표시 (토요일이면서 예약된 날짜)
      const isApplied = isSaturday && appliedDates.includes(i);
      calendar.push({ 
        day: i, 
        isCurrentMonth: true, 
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isSelected: i === selectedDate,
        isApplied: isApplied,
        isSaturday: isSaturday,
        isSunday: isSunday
      });
    }
    
    // 다음 달 첫 날들
    const remainingDays = 42 - calendar.length;
    for (let i = 1; i <= remainingDays; i++) {
      calendar.push({ day: i, isCurrentMonth: false, isWeekend: false });
    }
    
    // 7일씩 묶어서 주 단위로 만들기
    for (let i = 0; i < calendar.length; i += 7) {
      weeks.push(calendar.slice(i, i + 7));
    }
    
    return weeks;
  };

  const calendarWeeks = generateCalendar();
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  // 선택된 날짜가 토요일인지 확인
  const isSelectedDateSaturday = () => {
    const date = new Date(currentYear, currentMonth - 1, selectedDate);
    return date.getDay() === 6;
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (dateInfo) => {
    if (!dateInfo.isCurrentMonth) return;
    
    // 토요일만 선택 가능
    if (dateInfo.isSaturday) {
      setSelectedDate(dateInfo.day);
    } else {
      alert('외박/잔류 신청은 토요일만 가능합니다.');
    }
  };

  // 저장 버튼 핸들러
  const handleSave = async () => {
    console.log('외박/잔류 저장 시도 - userInfo:', userInfo);
    if (!userInfo?.student_id) {
      console.error('학번 정보 없음:', { userInfo, student_id: userInfo?.student_id });
      alert('학번 정보를 찾을 수 없습니다. 로그인 상태를 확인해주세요.');
      return;
    }

    if (!isSelectedDateSaturday()) {
      alert('외박/잔류 신청은 토요일만 가능합니다.');
      return;
    }

    try {
      // 날짜 형식 변환 (YYYY-MM-DD)
      const selectedDateObj = new Date(currentYear, currentMonth - 1, selectedDate);
      const dateStr = `${selectedDateObj.getFullYear()}-${String(selectedDateObj.getMonth() + 1).padStart(2, '0')}-${String(selectedDateObj.getDate()).padStart(2, '0')}`;
      
      // type 변환
      // enum 값: 'out' (외박), 'return' (잔류)
      const leaveType = selectedSubTab === '외박' ? 'out' : 'return';

      const insertData = {
        student_id: userInfo.student_id,
        type: leaveType,
        date: dateStr,
        status: 'pending'
      };

      console.log('저장 시도:', insertData);

      const { data, error } = await supabase
        .from('temporary_leave')
        .insert([insertData])
        .select();

      if (error) {
        console.error('외박/잔류 신청 실패:', error);
        console.error('에러 상세:', JSON.stringify(error, null, 2));
        console.error('입력 데이터:', insertData);
        console.error('에러 코드:', error.code);
        console.error('에러 메시지:', error.message);
        console.error('에러 힌트:', error.hint);
        
        // enum 타입 오류인 경우 더 명확한 메시지
        if (error.message?.includes('invalid input value for enum') || 
            error.message?.includes('enum') || 
            error.code === '23502' ||
            error.code === '22P02') {
          alert(`enum 타입 오류가 발생했습니다.\n\n입력한 값:\n- type: ${leaveType}\n- status: pending\n\n콘솔(F12)을 확인하여 정확한 enum 값을 확인해주세요.\n\n에러: ${error.message}`);
        } else {
          alert('신청 중 오류가 발생했습니다: ' + error.message);
        }
        return;
      }

      console.log('저장 성공:', data);
      alert(`${selectedSubTab} 신청이 완료되었습니다.`);
      
      // /main으로 이동
      navigate('/main');
    } catch (error) {
      console.error('외박/잔류 신청 중 오류:', error);
      alert('신청 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  };

  // 현재 달 이름 가져오기
  const getCurrentMonthName = () => {
    return `${currentMonth}월`;
  };

  // 외출용 달력 데이터 생성
  const generateOutgoingCalendar = (year, month) => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    
    const calendar = [];
    const weeks = [];
    
    // 이전 달 마지막 날들
    for (let i = prevMonthDays - firstDay + 1; i <= prevMonthDays; i++) {
      calendar.push({ day: i, isCurrentMonth: false, date: new Date(year, month - 2, i) });
    }
    
    // 현재 달 날들
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month - 1, i);
      calendar.push({ 
        day: i, 
        isCurrentMonth: true,
        date: date
      });
    }
    
    // 다음 달 첫 날들
    const remainingDays = 42 - calendar.length;
    for (let i = 1; i <= remainingDays; i++) {
      calendar.push({ day: i, isCurrentMonth: false, date: new Date(year, month, i) });
    }
    
    // 7일씩 묶어서 주 단위로 만들기
    for (let i = 0; i < calendar.length; i += 7) {
      weeks.push(calendar.slice(i, i + 7));
    }
    
    return weeks;
  };

  // 외출 날짜 선택 핸들러
  const handleOutgoingDateSelect = (date) => {
    setOutgoingDateObj(date);
    setShowOutgoingCalendar(false);
  };

  // 외출 달력 년/월 상태
  const [outgoingCalendarYear, setOutgoingCalendarYear] = useState(outgoingDateObj.getFullYear());
  const [outgoingCalendarMonth, setOutgoingCalendarMonth] = useState(outgoingDateObj.getMonth() + 1);
  
  const outgoingCalendarWeeks = generateOutgoingCalendar(outgoingCalendarYear, outgoingCalendarMonth);

  // 외출 달력 이전/다음 달 이동
  const handleOutgoingCalendarPrevMonth = () => {
    if (outgoingCalendarMonth === 1) {
      setOutgoingCalendarYear(outgoingCalendarYear - 1);
      setOutgoingCalendarMonth(12);
    } else {
      setOutgoingCalendarMonth(outgoingCalendarMonth - 1);
    }
  };

  const handleOutgoingCalendarNextMonth = () => {
    if (outgoingCalendarMonth === 12) {
      setOutgoingCalendarYear(outgoingCalendarYear + 1);
      setOutgoingCalendarMonth(1);
    } else {
      setOutgoingCalendarMonth(outgoingCalendarMonth + 1);
    }
  };

  // 외출 신청 저장 핸들러
  const handleOutgoingSubmit = async () => {
    console.log('외출 저장 시도 - userInfo:', userInfo);
    if (!userInfo?.student_id) {
      console.error('학번 정보 없음:', { userInfo, student_id: userInfo?.student_id });
      alert('학번 정보를 찾을 수 없습니다. 로그인 상태를 확인해주세요.');
      return;
    }

    if (!outgoingReason.trim()) {
      alert('외출 사유를 입력해주세요.');
      return;
    }

    try {
      // 날짜 형식 변환 (YYYY-MM-DD)
      const dateStr = `${outgoingDateObj.getFullYear()}-${String(outgoingDateObj.getMonth() + 1).padStart(2, '0')}-${String(outgoingDateObj.getDate()).padStart(2, '0')}`;

      console.log('외출 신청 시도:', {
        student_id: userInfo.student_id,
        date: dateStr,
        reason: outgoingReason.trim(),
        status: 'pending'
      });

      const { data, error } = await supabase
        .from('temporary_exit')
        .insert([
          {
            student_id: userInfo.student_id,
            date: dateStr,
            reason: outgoingReason.trim(),
            status: 'pending'
          }
        ])
        .select();

      if (error) {
        console.error('외출 신청 실패:', error);
        console.error('에러 상세:', JSON.stringify(error, null, 2));
        alert('신청 중 오류가 발생했습니다: ' + error.message);
        return;
      }

      console.log('저장 성공:', data);
      alert('외출 신청이 완료되었습니다.');
      
      // /main으로 이동
      navigate('/main');
    } catch (error) {
      console.error('외출 신청 중 오류:', error);
      alert('신청 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  };

  // 외부 클릭 시 달력 닫기
  const calendarRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowOutgoingCalendar(false);
      }
    };

    if (showOutgoingCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOutgoingCalendar]);

  return (
    <div className="application">
      <div className="application-header">
        <h1 className="application-title">신청 관리</h1>
        <p className="application-date">{getCurrentDate()}</p>
      </div>

      {/* 상단 탭 */}
      <div className="main-tabs">
        <button
          className={`main-tab ${selectedMainTab === '외박/잔류' ? 'active' : ''}`}
          onClick={() => setSelectedMainTab('외박/잔류')}
        >
          외박/잔류
        </button>
        <button
          className={`main-tab ${selectedMainTab === '외출' ? 'active' : ''}`}
          onClick={() => setSelectedMainTab('외출')}
        >
          외출
        </button>
      </div>

      {selectedMainTab === '외박/잔류' ? (
        <>
          {/* 캘린더 */}
          <div className="calendar-container">
            <div className="calendar-header">
              <div className="calendar-month">
                <p>{getCurrentMonthName()}</p>
              </div>
            </div>
            <div className="calendar-grid">
              {/* 요일 헤더 */}
              <div className="calendar-weekdays">
                {weekDays.map((day, index) => (
                  <div key={index} className={`weekday ${index === 0 || index === 6 ? 'weekend' : ''}`}>
                    {day}
                  </div>
                ))}
              </div>
              
              {/* 날짜 그리드 */}
              <div className="calendar-days">
                {calendarWeeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="calendar-week">
                    {week.map((dateInfo, dayIndex) => {
                      const isSelected = dateInfo.isSelected && dateInfo.isCurrentMonth;
                      const isWeekend = dateInfo.isWeekend && dateInfo.isCurrentMonth;
                      const isOtherMonth = !dateInfo.isCurrentMonth;
                      const isApplied = dateInfo.isApplied && dateInfo.isCurrentMonth;
                      const isSaturday = dateInfo.isSaturday && dateInfo.isCurrentMonth;
                      const isSunday = dateInfo.isSunday && dateInfo.isCurrentMonth;
                      const isDisabled = dateInfo.isCurrentMonth && !isSaturday;
                      
                      return (
                        <div
                          key={dayIndex}
                          className={`calendar-day ${isSelected ? 'selected' : ''} ${isWeekend ? 'weekend' : ''} ${isOtherMonth ? 'other-month' : ''} ${isApplied ? 'applied' : ''} ${isDisabled ? 'disabled' : ''} ${isSunday ? 'sunday' : ''}`}
                          onClick={() => handleDateClick(dateInfo)}
                        >
                          {dateInfo.day}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 하단 섹션 */}
          <div className="bottom-section">
            <h3 className="section-date">{currentMonth}월 {selectedDate}일</h3>
            {isSelectedDateSaturday() ? (
              <div className="sub-tabs">
                <button
                  className={`sub-tab ${selectedSubTab === '외박' ? 'active' : ''}`}
                  onClick={() => setSelectedSubTab('외박')}
                >
                  외박
                </button>
                <button
                  className={`sub-tab ${selectedSubTab === '잔류' ? 'active' : ''}`}
                  onClick={() => setSelectedSubTab('잔류')}
                >
                  잔류
                </button>
              </div>
            ) : (
              <div className="sub-tabs-disabled">
                <p className="disabled-message">외박/잔류 신청은 토요일만 가능합니다.</p>
              </div>
            )}
          </div>

          {/* 저장 버튼 */}
          {isSelectedDateSaturday() && (
            <button className="save-button" onClick={() => handleSave()}>
              저장
            </button>
          )}
        </>
      ) : (
        <>
          {/* 외출 신청 폼 */}
          <div className="outgoing-form">
            <div className="form-field">
              <label className="form-label">날짜</label>
              <div className="date-picker-wrapper" ref={calendarRef}>
                <div className="date-picker" onClick={() => setShowOutgoingCalendar(!showOutgoingCalendar)}>
                  <p className="date-text">{outgoingDate}</p>
                  <div className="calendar-icon-wrapper">
                    <img src={calendarIcon} alt="달력" className="calendar-icon" />
                  </div>
                </div>
                {showOutgoingCalendar && (
                  <div className="outgoing-calendar-popup">
                    <div className="outgoing-calendar-header">
                      <button className="calendar-nav-btn" onClick={handleOutgoingCalendarPrevMonth}>‹</button>
                      <p className="outgoing-calendar-month">{outgoingCalendarYear}년 {outgoingCalendarMonth}월</p>
                      <button className="calendar-nav-btn" onClick={handleOutgoingCalendarNextMonth}>›</button>
                    </div>
                    <div className="outgoing-calendar-grid">
                      <div className="outgoing-calendar-weekdays">
                        {weekDays.map((day, index) => (
                          <div key={index} className={`outgoing-weekday ${index === 0 || index === 6 ? 'weekend' : ''}`}>
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="outgoing-calendar-days">
                        {outgoingCalendarWeeks.map((week, weekIndex) => (
                          <div key={weekIndex} className="outgoing-calendar-week">
                            {week.map((dateInfo, dayIndex) => {
                              const selectedDateStr = `${outgoingDateObj.getFullYear()}-${outgoingDateObj.getMonth()}-${outgoingDateObj.getDate()}`;
                              const currentDateStr = `${dateInfo.date.getFullYear()}-${dateInfo.date.getMonth()}-${dateInfo.date.getDate()}`;
                              const isSelected = dateInfo.isCurrentMonth && selectedDateStr === currentDateStr;
                              const isOtherMonth = !dateInfo.isCurrentMonth;
                              
                              const today = new Date();
                              const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
                              const isToday = dateInfo.isCurrentMonth && currentDateStr === todayStr;
                              
                              return (
                                <div
                                  key={dayIndex}
                                  className={`outgoing-calendar-day ${isSelected ? 'selected' : ''} ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                                  onClick={() => {
                                    if (dateInfo.isCurrentMonth) {
                                      handleOutgoingDateSelect(dateInfo.date);
                                    }
                                  }}
                                >
                                  {dateInfo.day}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="form-field">
              <label className="form-label">외출 사유</label>
              <div className="reason-input">
                <textarea
                  className="reason-textarea"
                  placeholder="외출 사유"
                  value={outgoingReason}
                  onChange={(e) => setOutgoingReason(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 승인 요청 버튼 */}
          <button className="submit-button" onClick={handleOutgoingSubmit}>
            승인 요청
          </button>
        </>
      )}
    </div>
  );
}

export default Application;
