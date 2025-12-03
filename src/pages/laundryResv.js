import React, { useState, useEffect } from 'react';
import './css/laundryResv.css';
import { supabase } from '../supabaseClient';

function LaundryResv({ userInfo }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}.${month}.${day}`;

  // 시간대 정의 (4개)
  const timeSlots = [
    { start: '18:20', end: '19:10', label: '18:20~19:10' },
    { start: '19:20', end: '20:10', label: '19:20~20:10' },
    { start: '20:20', end: '21:10', label: '20:20~21:10' },
    { start: '21:20', end: '22:10', label: '21:20~22:10' },
  ];

  // 세탁기 개수 (3개)
  const machineCount = 3;

  // 예약 슬롯 초기화 (3열 x 4행)
  const initializeSlots = () => {
    const slots = [];
    for (let machine = 1; machine <= machineCount; machine++) {
      for (let timeIndex = 0; timeIndex < timeSlots.length; timeIndex++) {
        const slotId = `${machine}-${timeIndex}`;
        slots.push({
          id: slotId,
          machine: machine,
          timeIndex: timeIndex,
          timeSlot: timeSlots[timeIndex],
          status: 'available', // available, reserved, in-use
          room: null,
          name: null,
          userId: null,
        });
      }
    }
    return slots;
  };

  const [reservationSlots, setReservationSlots] = useState(initializeSlots);
  const [washMacs, setWashMacs] = useState([
    { id: 1, status: '비어있음' },
    { id: 2, status: '비어있음' },
    { id: 3, status: '비어있음' },
  ]);

  const washMacImagePath = process.env.PUBLIC_URL + '/img/washMacImg.svg';
  const emptyWashMacImagePath = process.env.PUBLIC_URL + '/img/emptyWashMacImg.svg';

  // 현재 시간과 비교하여 슬롯 상태 확인
  const getSlotStatus = (timeSlot) => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const [startHour, startMin] = timeSlot.start.split(':').map(Number);
    const [endHour, endMin] = timeSlot.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    const [currentHour, currentMin] = currentTime.split(':').map(Number);
    const currentTimeMinutes = currentHour * 60 + currentMin;
    
    // 시간대가 지났으면 'past', 현재 진행 중이면 'in-use', 아직 안 지났으면 'future'
    if (currentTimeMinutes > endTime) {
      return 'past'; // 지난 시간
    } else if (currentTimeMinutes >= startTime && currentTimeMinutes <= endTime) {
      return 'in-use'; // 현재 사용 중
    } else {
      return 'future'; // 아직 안 지남
    }
  };

  // Supabase에서 예약 데이터 가져오기
  const fetchReservations = async () => {
    try {
      // 세션 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('세션 확인 실패:', sessionError);
        return;
      }

      const { data, error } = await supabase
        .from('laundry_reservations')
        .select('*')
        .eq('date', formattedDate);

      if (error) {
        // 인증 오류인 경우 조용히 처리 (리다이렉트 방지)
        if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('auth')) {
          console.error('인증 오류로 예약 데이터를 불러올 수 없습니다:', error);
          return;
        }
        console.error('예약 데이터 불러오기 실패:', error);
        return;
      }

      // 예약 데이터를 슬롯에 반영 (기본 할당 정보 포함)
      setReservationSlots(currentSlots => {
        const updatedSlots = currentSlots.map(slot => {
          const reservation = data?.find(
            r => r.machine === slot.machine && r.time_index === slot.timeIndex
          );
          
          if (reservation) {
            const slotStatus = getSlotStatus(slot.timeSlot);
            // 기본 할당 정보도 표시 (user_id가 null이거나 없는 경우도 포함)
            return {
              ...slot,
              status: slotStatus === 'in-use' ? 'in-use' : 'reserved',
              room: reservation.room_number || null,
              name: reservation.user_name || null,
              userId: reservation.user_id || null,
            };
          } else {
            const slotStatus = getSlotStatus(slot.timeSlot);
            return {
              ...slot,
              status: slotStatus === 'past' ? 'past' : slotStatus === 'in-use' ? 'in-use' : 'available',
              room: null,
              name: null,
              userId: null,
            };
          }
        });
        return updatedSlots;
      });

      // 세탁기 상태 업데이트
      updateMachineStatus(data || []);
    } catch (error) {
      console.error('예약 데이터 가져오기 중 오류:', error);
    }
  };

  // 세탁기 상태 업데이트
  const updateMachineStatus = (reservations) => {
    const machineStatuses = [1, 2, 3].map(machineId => {
      const machineReservations = reservations.filter(r => r.machine === machineId);
      const hasActiveReservation = machineReservations.some(reservation => {
        const slotStatus = getSlotStatus(timeSlots[reservation.time_index]);
        return slotStatus === 'in-use';
      });
      return {
        id: machineId,
        status: hasActiveReservation ? '사용중' : '비어있음',
      };
    });
    setWashMacs(machineStatuses);
  };

  // 예약/취소 처리
  const handleReservationClick = async (slotId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!userInfo) {
      alert('로그인이 필요합니다.');
      return;
    }

    const slot = reservationSlots.find(s => s.id === slotId);
    if (!slot) return;

    // 지난 시간대는 예약 불가
    const slotStatus = getSlotStatus(slot.timeSlot);
    if (slotStatus === 'past') {
      alert('이미 지난 시간대입니다.');
      return;
    }

    // 현재 사용 중인 시간대는 예약 불가
    if (slotStatus === 'in-use') {
      alert('현재 사용 중인 시간대입니다.');
      return;
    }

    // 이미 예약된 슬롯 처리
    if (slot.status === 'reserved') {
      // userId 비교 시 타입 변환 (문자열로 통일)
      const slotUserId = String(slot.userId || '');
      const currentUserId = String(userInfo?.id || '');
      const isMyReservation = slotUserId === currentUserId && slotUserId !== '';
      
      console.log('예약 취소 시도:', { 
        slotUserId: slot.userId, 
        userInfoId: userInfo?.id, 
        slotUserIdStr: slotUserId,
        currentUserIdStr: currentUserId,
        match: isMyReservation 
      });
      
      if (isMyReservation) {
        // 확인 메시지 표시
        const confirmCancel = window.confirm('예약을 취소하시겠습니까?');
        if (!confirmCancel) {
          return;
        }

        try {
          console.log('예약 취소 시작:', { 
            date: formattedDate, 
            machine: slot.machine, 
            timeIndex: slot.timeIndex, 
            userId: userInfo.id,
            slotId: slotId 
          });

          // 삭제 전에 현재 예약 정보 확인
          const { data: checkData, error: checkError } = await supabase
            .from('laundry_reservations')
            .select('*')
            .eq('date', formattedDate)
            .eq('machine', slot.machine)
            .eq('time_index', slot.timeIndex)
            .single();

          console.log('삭제 전 예약 확인:', { checkData, checkError });

          if (checkError && checkError.code !== 'PGRST116') {
            console.error('예약 확인 오류:', checkError);
            alert('예약 정보를 확인하는 중 오류가 발생했습니다.');
            return;
          }

          if (!checkData) {
            alert('예약 정보를 찾을 수 없습니다.');
            // 이미 삭제된 상태일 수 있으므로 상태만 업데이트
            setReservationSlots(currentSlots => {
              return currentSlots.map(s => {
                if (s.id === slotId) {
                  const slotStatus = getSlotStatus(s.timeSlot);
                  return {
                    ...s,
                    status: slotStatus === 'past' ? 'past' : slotStatus === 'in-use' ? 'in-use' : 'available',
                    room: null,
                    name: null,
                    userId: null,
                  };
                }
                return s;
              });
            });
            await fetchReservations();
            return;
          }

          // userId 확인
          const checkUserId = String(checkData.user_id || '');
          const currentUserId = String(userInfo.id || '');
          if (checkUserId !== currentUserId) {
            alert('본인의 예약만 취소할 수 있습니다.');
            return;
          }

          // 삭제 실행
          const { data, error } = await supabase
            .from('laundry_reservations')
            .delete()
            .eq('date', formattedDate)
            .eq('machine', slot.machine)
            .eq('time_index', slot.timeIndex)
            .eq('user_id', userInfo.id)
            .select();

          console.log('예약 취소 결과:', { data, error, deletedCount: data?.length || 0 });

          if (error) {
            console.error('예약 취소 오류:', error);
            // 인증 오류인 경우
            if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('auth')) {
              alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
              return;
            }
            alert('예약 취소 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
            return;
          }

          // 삭제 성공 확인
          if (!data || data.length === 0) {
            console.warn('삭제된 행이 없습니다. 이미 삭제되었을 수 있습니다.');
            // 상태만 업데이트
          }

          // 성공 메시지
          console.log('예약 취소 성공');
          
          // 즉시 로컬 상태 업데이트 (빈 네모박스로 변경)
          setReservationSlots(currentSlots => {
            return currentSlots.map(s => {
              if (s.id === slotId) {
                const slotStatus = getSlotStatus(s.timeSlot);
                return {
                  ...s,
                  status: slotStatus === 'past' ? 'past' : slotStatus === 'in-use' ? 'in-use' : 'available',
                  room: null,
                  name: null,
                  userId: null,
                };
              }
              return s;
            });
          });
          
          // 최신 상태로 업데이트 (서버와 동기화)
          await fetchReservations();
        } catch (error) {
          console.error('예약 취소 실패:', error);
          alert('예약 취소 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
        }
      } else {
        alert('다른 사용자가 예약한 시간대입니다.');
      }
      return;
    }

    // 예약하기
    if (slot.status === 'available') {
      try {
        // 먼저 해당 슬롯이 이미 예약되었는지 확인 (동시성 처리)
        const { data: existingReservation, error: checkError } = await supabase
          .from('laundry_reservations')
          .select('*')
          .eq('date', formattedDate)
          .eq('machine', slot.machine)
          .eq('time_index', slot.timeIndex)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingReservation) {
          alert('다른 사용자가 이미 예약했습니다.');
          await fetchReservations(); // 최신 상태로 업데이트
          return;
        }

        // 예약 생성
        const { error: insertError } = await supabase
          .from('laundry_reservations')
          .insert([
            {
              date: formattedDate,
              machine: slot.machine,
              time_index: slot.timeIndex,
              user_id: userInfo.id,
              user_name: userInfo.name || '이름 없음',
              room_number: userInfo.room_number ? `${userInfo.room_number}호` : '호실 정보 없음',
            },
          ]);

        if (insertError) throw insertError;

        // 로컬 상태 업데이트
        setReservationSlots(currentSlots =>
          currentSlots.map(s =>
            s.id === slotId
              ? {
                  ...s,
                  status: 'reserved',
                  room: userInfo.room_number ? `${userInfo.room_number}호` : '호실 정보 없음',
                  name: userInfo.name || '이름 없음',
                  userId: userInfo.id,
                }
              : s
          )
        );
      } catch (error) {
        console.error('예약 실패:', error);
        alert('예약 중 오류가 발생했습니다.');
      }
    }
  };

  // 초기 로드 및 실시간 구독
  useEffect(() => {
    fetchReservations();

    // Supabase Realtime 구독
    const subscription = supabase
      .channel('laundry_reservations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'laundry_reservations',
          filter: `date=eq.${formattedDate}`,
        },
        (payload) => {
          console.log('예약 변경 감지:', payload);
          fetchReservations(); // 변경 시 다시 가져오기
        }
      )
      .subscribe();

    // 주기적으로 상태 업데이트 (시간대 변경 감지)
    const intervalId = setInterval(() => {
      fetchReservations();
    }, 60000); // 1분마다

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formattedDate]);

  return (
    <div className='container2'>
      <div className="contentText">
        <h5 className="laundryResv-title">세탁 예약</h5>                    
        <p className="current-date">{formattedDate}</p>

        <div className="wash-mac-list">
          {washMacs.map((machine) => (
            <div key={machine.id} className="wash-mac-item">
              <div className="wash-mac-image-wrapper">
                <span className="wash-mac-number">{machine.id}번</span>
                <img
                  src={machine.status === '비어있음' ? emptyWashMacImagePath : washMacImagePath}
                  alt="Washing Machine"
                  className="wash-mac-image"
                />
              </div>
              <div className={`wash-mac-status ${machine.status === '사용중' ? 'in-use' : 'empty'}`}>
                {machine.status}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className='reservationBox'>
        <img className="resvTime" src={process.env.PUBLIC_URL + '/img/resvTime.svg'} alt="Reservation Box" />
        <div className='resvBox'>
          <div className='reservation-grid'>
            {reservationSlots.map((slot) => {
              // 지난 시간대
              if (slot.status === 'past') {
                return (
                  <div key={slot.id} className="reservation-slot past" title={slot.timeSlot.label}>
                    {/* 지난 시간대는 비활성화 */}
                  </div>
                );
              }
              
              // 현재 사용 중
              if (slot.status === 'in-use') {
                return (
                  <div key={slot.id} className="reservation-slot in-use" title={slot.timeSlot.label}>
                    <span className="slot-room">{slot.room || '사용중'}</span>
                    <span className="slot-name">{slot.name || ''}</span>
                  </div>
                );
              }
              
              // 예약됨 (기본 할당 정보 포함)
              if (slot.status === 'reserved') {
                // userId 비교 시 타입 변환 (문자열로 통일)
                const slotUserId = String(slot.userId || '');
                const currentUserId = String(userInfo?.id || '');
                const isMyReservation = slotUserId === currentUserId && slotUserId !== '';
                
                // room이나 name이 있으면 예약된 것으로 표시 (기본 할당 정보 포함)
                const hasReservation = slot.room || slot.name;
                
                return (
                  <div
                    key={slot.id}
                    className={`reservation-slot reserved ${isMyReservation ? 'my-reservation' : ''}`}
                    onClick={isMyReservation ? (e) => handleReservationClick(slot.id, e) : undefined}
                    title={slot.timeSlot.label}
                    style={{ cursor: isMyReservation ? 'pointer' : 'default' }}
                  >
                    {hasReservation && (
                      <>
                        <span className="slot-room">{slot.room || ''}</span>
                        <span className="slot-name">{slot.name || ''}</span>
                      </>
                    )}
                  </div>
                );
              }
              
              // 예약 가능
              return (
                <div
                  key={slot.id}
                  className="reservation-slot available"
                  onClick={(e) => handleReservationClick(slot.id, e)}
                  title={slot.timeSlot.label}
                >
                  {/* 예약 가능한 슬롯 */}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LaundryResv;
