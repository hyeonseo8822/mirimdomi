import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './css/profiledetail.css';

function ProfileDetail({ userInfo, onUserInfoUpdate, onUserProfileUpdate }) {
  // onUserProfileUpdate가 있으면 사용, 없으면 onUserInfoUpdate 사용
  const handleUserUpdate = onUserProfileUpdate || onUserInfoUpdate;
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}.${month}.${day}`;

  const [profileImage, setProfileImage] = useState(
    userInfo?.profile_image || process.env.PUBLIC_URL + '/img/default-profile.png'
  );
  const [points, setPoints] = useState({
    merits: userInfo?.merits || 0,
    demerits: userInfo?.demerits || 0,
  });

  // 편집 모드 상태
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({
    name: userInfo?.name || '',
    student_id: userInfo?.student_id || '',
    room_number: userInfo?.room_number || '',
  });

  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const studentIdInputRef = useRef(null);
  const roomNumberInputRef = useRef(null);

  const editIconPath = process.env.PUBLIC_URL + '/img/edit.svg';
  const plusIconPath = process.env.PUBLIC_URL + '/img/plus.svg';
  const minusIconPath = process.env.PUBLIC_URL + '/img/minus.svg';

  // userInfo가 변경되면 points와 profileImage 업데이트
  useEffect(() => {
    setPoints({
      merits: userInfo?.merits || 0,
      demerits: userInfo?.demerits || 0,
    });
    setProfileImage(
      userInfo?.profile_image || process.env.PUBLIC_URL + '/img/default-profile.png'
    );
    setEditValues({
      name: userInfo?.name || '',
      student_id: userInfo?.student_id || '',
      room_number: userInfo?.room_number || '',
    });
  }, [userInfo]);

  const handleImageChange = async (event) => {
    const file = event.target.files[0];
    if (!file || !userInfo?.id) {
      alert("파일을 선택하거나 사용자 ID를 찾을 수 없습니다.");
      return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${userInfo.id}.${fileExt}`;
    const filePath = `profile_images/${fileName}`;

    try {
      // Supabase Storage에 파일 업로드
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 업로드된 파일의 공개 URL 가져오기
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicUrl.publicUrl;

      // users 테이블의 profile_image 컬럼 업데이트
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_image: publicUrl })
        .eq('id', userInfo.id);

      if (updateError) throw updateError;

      setProfileImage(publicUrl);
      
      // 부모 컴포넌트에 업데이트 알림
      if (handleUserUpdate) {
        handleUserUpdate({ ...userInfo, profile_image: publicUrl });
      }

      alert("프로필 이미지가 성공적으로 업데이트되었습니다.");
    } catch (error) {
      console.error('프로필 이미지 업데이트 실패:', error);
      alert('프로필 이미지 업데이트 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleEditIconClick = () => {
    fileInputRef.current.click();
  };

  const handlePointChange = async (field, amount) => {
    if (!userInfo?.id) {
      alert("사용자 ID를 찾을 수 없어 포인트를 업데이트할 수 없습니다.");
      return;
    }

    const newAmount = Math.max(0, points[field] + amount);
    const updatedPoints = {
      ...points,
      [field]: newAmount
    };

    setPoints(updatedPoints);

    try {
      const { error } = await supabase
        .from('users')
        .update({ [field]: newAmount })
        .eq('id', userInfo.id);

      if (error) throw error;

      // 부모 컴포넌트에 업데이트 알림
      if (handleUserUpdate) {
        handleUserUpdate({ ...userInfo, [field]: newAmount });
      }

      console.log(`${field}가 성공적으로 업데이트되었습니다.`);
    } catch (error) {
      console.error(`포인트 업데이트 실패 (${field}):`, error);
      alert(`포인트 업데이트 중 오류가 발생했습니다: ${error.message}`);
      // 오류 발생 시 로컬 상태 롤백
      setPoints(prev => ({
        ...prev,
        [field]: prev[field] - amount
      }));
    }
  };

  // 더블클릭으로 편집 모드 시작
  const handleDoubleClick = (field) => {
    setEditingField(field);
    // 포커스 설정을 위한 약간의 지연
    setTimeout(() => {
      if (field === 'name' && nameInputRef.current) {
        nameInputRef.current.focus();
        nameInputRef.current.select();
      } else if (field === 'student_id' && studentIdInputRef.current) {
        studentIdInputRef.current.focus();
        studentIdInputRef.current.select();
      } else if (field === 'room_number' && roomNumberInputRef.current) {
        roomNumberInputRef.current.focus();
        roomNumberInputRef.current.select();
      }
    }, 10);
  };

  // 편집 취소
  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValues({
      name: userInfo?.name || '',
      student_id: userInfo?.student_id || '',
      room_number: userInfo?.room_number || '',
    });
  };

  // 편집 저장
  const handleSaveEdit = async (field) => {
    if (!userInfo?.id) {
      alert("사용자 ID를 찾을 수 없어 정보를 업데이트할 수 없습니다.");
      handleCancelEdit();
      return;
    }

    const newValue = editValues[field]?.trim() || '';
    
    // 유효성 검사
    if (field === 'student_id' && newValue && !/^\d+$/.test(newValue)) {
      alert('학번은 숫자만 입력 가능합니다.');
      return;
    }
    if (field === 'room_number' && newValue && !/^\d+$/.test(newValue)) {
      alert('호실은 숫자만 입력 가능합니다.');
      return;
    }

    try {
      const updateData = { [field]: newValue };
      
      // student_id를 업데이트하는 경우, 관련 테이블도 함께 업데이트
      // 주의: foreign key constraint 때문에 순서가 중요함
      if (field === 'student_id' && newValue !== userInfo.student_id) {
        const oldStudentId = userInfo.student_id;
        const newStudentId = newValue;

        // foreign key constraint 문제 해결:
        // 1. 먼저 users 테이블에 새로운 student_id를 추가 (임시로)
        // 2. 관련 테이블 업데이트
        // 3. users 테이블의 기존 레코드 업데이트
        
        // 하지만 foreign key는 users.student_id를 참조하므로, 
        // users 테이블에 새로운 student_id가 존재해야 합니다.
        // 따라서 먼저 users 테이블을 업데이트해야 하는데,
        // 이때 temporary_exit가 여전히 이전 student_id를 참조하므로 constraint 위반이 발생합니다.
        
        // 해결책: 관련 레코드를 먼저 삭제하거나, 
        // 또는 foreign key constraint가 ON UPDATE CASCADE로 설정되어 있어야 합니다.
        // 일단 관련 레코드가 있으면 학번 변경을 막는 것이 안전합니다.
        
        // 관련 레코드 확인
        const { data: exitRecords, error: exitCheckError } = await supabase
          .from('temporary_exit')
          .select('id')
          .eq('student_id', oldStudentId);

        const { data: leaveRecords, error: leaveCheckError } = await supabase
          .from('temporary_leave')
          .select('id')
          .eq('student_id', oldStudentId);

        if (exitCheckError || leaveCheckError) {
          console.error('관련 레코드 확인 실패:', exitCheckError || leaveCheckError);
          throw new Error('관련 데이터 확인 중 오류가 발생했습니다.');
        }

        const hasExitRecords = exitRecords && exitRecords.length > 0;
        const hasLeaveRecords = leaveRecords && leaveRecords.length > 0;

        if (hasExitRecords || hasLeaveRecords) {
          const exitCount = exitRecords?.length || 0;
          const leaveCount = leaveRecords?.length || 0;
          const totalCount = exitCount + leaveCount;
          
          const confirmMessage = `학번을 변경하려면 모든 외출 및 외박/잔류 신청이 취소됩니다.\n\n` +
            `- 외출 신청: ${exitCount}개\n` +
            `- 외박/잔류 신청: ${leaveCount}개\n\n` +
            `총 ${totalCount}개의 신청을 취소하고 학번을 변경하시겠습니까?`;
          
          const shouldProceed = window.confirm(confirmMessage);
          
          if (!shouldProceed) {
            handleCancelEdit();
            return;
          }

          // 사용자가 확인했으면 관련 레코드 삭제
          if (hasExitRecords) {
            const { error: deleteExitError } = await supabase
              .from('temporary_exit')
              .delete()
              .eq('student_id', oldStudentId);

            if (deleteExitError) {
              console.error('외출 신청 삭제 실패:', deleteExitError);
              throw new Error('외출 신청 삭제 중 오류가 발생했습니다: ' + deleteExitError.message);
            }
          }

          if (hasLeaveRecords) {
            const { error: deleteLeaveError } = await supabase
              .from('temporary_leave')
              .delete()
              .eq('student_id', oldStudentId);

            if (deleteLeaveError) {
              console.error('외박/잔류 신청 삭제 실패:', deleteLeaveError);
              throw new Error('외박/잔류 신청 삭제 중 오류가 발생했습니다: ' + deleteLeaveError.message);
            }
          }
        }

        // 관련 레코드가 없거나 삭제되었으므로 안전하게 업데이트 가능
        const { error: userError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', userInfo.id);

        if (userError) {
          console.error('users 테이블 업데이트 실패:', userError);
          throw userError;
        }
      } else {
        // student_id가 아닌 다른 필드는 그냥 업데이트
        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', userInfo.id);

        if (error) throw error;
      }

      // 부모 컴포넌트에 업데이트 알림
      if (handleUserUpdate) {
        handleUserUpdate({ ...userInfo, [field]: newValue });
      }

      setEditingField(null);
      console.log(`${field}가 성공적으로 업데이트되었습니다.`);
    } catch (error) {
      console.error(`정보 업데이트 실패 (${field}):`, error);
      alert(`정보 업데이트 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  // Enter 키로 저장, Escape 키로 취소
  const handleKeyDown = (e, field) => {
    if (e.key === 'Enter') {
      handleSaveEdit(field);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="container">
      <div className="profile-header">
        <h1 className="profile-title">마이페이지</h1>
        <p className="profile-date">{formattedDate}</p>
      </div>

      <div className='whiteBox'>
        <div className='profileBox'>
          <img src={profileImage} alt="프로필" className="profileImage" />
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleImageChange}
          />
        </div>
        <div className="editIconContainer" onClick={handleEditIconClick}>
          <img src={editIconPath} alt="Edit" className="editIcon" />
        </div>
        <div className='nameBox'>
          <div className='nameText'>이름</div>
          {editingField === 'name' ? (
            <input
              ref={nameInputRef}
              type="text"
              className='name'
              value={editValues.name}
              onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
              onBlur={() => handleSaveEdit('name')}
              onKeyDown={(e) => handleKeyDown(e, 'name')}
              style={{ 
                border: '1px solid #E0E0E0', 
                borderRadius: '5px', 
                padding: '5px',
                width: '100%',
                fontSize: 'inherit',
                fontFamily: 'inherit'
              }}
            />
          ) : (
            <div 
              className='name' 
              onDoubleClick={() => handleDoubleClick('name')}
              style={{ cursor: 'pointer' }}
              title="더블클릭하여 수정"
            >
              {userInfo?.name || '사용자'}
            </div>
          )}
        </div>
        <div className='studentInfoBox'>
          <div className='numberBox'>
            <div className='numberText'>학번</div>
            {editingField === 'student_id' ? (
              <input
                ref={studentIdInputRef}
                type="text"
                className='number'
                value={editValues.student_id}
                onChange={(e) => setEditValues({ ...editValues, student_id: e.target.value })}
                onBlur={() => handleSaveEdit('student_id')}
                onKeyDown={(e) => handleKeyDown(e, 'student_id')}
                style={{ 
                  border: '1px solid #E0E0E0', 
                  borderRadius: '5px', 
                  padding: '5px',
                  width: '100%',
                  fontSize: 'inherit',
                  fontFamily: 'inherit'
                }}
              />
            ) : (
              <div 
                className='number' 
                onDoubleClick={() => handleDoubleClick('student_id')}
                style={{ cursor: 'pointer' }}
                title="더블클릭하여 수정"
              >
                {userInfo?.student_id || '학번 없음'}
              </div>
            )}
          </div>
          <div className='roomBox'>
            <div className='roomText'>호실</div>
            {editingField === 'room_number' ? (
              <input
                ref={roomNumberInputRef}
                type="text"
                className='roomNum'
                value={editValues.room_number}
                onChange={(e) => setEditValues({ ...editValues, room_number: e.target.value })}
                onBlur={() => handleSaveEdit('room_number')}
                onKeyDown={(e) => handleKeyDown(e, 'room_number')}
                style={{ 
                  border: '1px solid #E0E0E0', 
                  borderRadius: '5px', 
                  padding: '5px',
                  width: '100%',
                  fontSize: 'inherit',
                  fontFamily: 'inherit'
                }}
              />
            ) : (
              <div 
                className='roomNum' 
                onDoubleClick={() => handleDoubleClick('room_number')}
                style={{ cursor: 'pointer' }}
                title="더블클릭하여 수정"
              >
                {userInfo?.room_number || '호실 없음'}
              </div>
            )}
          </div>
        </div>
        <div className='pointBox'>
          <div className='bonus'>
            <div className='pointText'>상점</div>
            <div className='bonusPlMa'>
              <img 
                src={minusIconPath} 
                alt="minus" 
                className="minusImage" 
                onClick={() => handlePointChange('merits', -0.5)} 
              />
              <div className='bonusPoints'>{points.merits}</div>
              <img 
                src={plusIconPath} 
                alt="plus" 
                className="plusImage" 
                onClick={() => handlePointChange('merits', 0.5)} 
              />
            </div>
          </div>
          <div className='penalty'>
            <div className='pointText'>벌점</div>
            <div className='penaltyPlMa'>
              <img 
                src={minusIconPath} 
                alt="minus" 
                className="minusImage" 
                onClick={() => handlePointChange('demerits', -0.5)} 
              />
              <div className='penaltyPoints'>{points.demerits}</div>
              <img 
                src={plusIconPath} 
                alt="plus" 
                className="plusImage" 
                onClick={() => handlePointChange('demerits', 0.5)} 
              />
            </div>
          </div>
          <div className='total'>
            <div className='pointText'>총합</div>
            <div className='totalPoints'>{points.merits - points.demerits}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileDetail;