import React, { useState, useEffect } from 'react'; // useEffect 추가
import './css/community.css';
import { supabase } from '../supabaseClient'; // Supabase 클라이언트 임포트

// 로컬 이미지 경로
const eyeIcon = "/img/eye-icon.svg";
const commentIcon = "/img/comment-icon.svg";
const arrowRightIcon = "/img/arrow-right-community.svg";
const sendIcon = "/img/send-icon.svg";

// 댓글 전송 아이콘 SVG 컴포넌트
const CommentSendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M10 16.6667V3.33337M10 3.33337L15 8.33337M10 3.33337L5 8.33337" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function Community({ userInfo }) { // userInfo prop 받기
  const [selectedTab, setSelectedTab] = useState('게시판');
  const [selectedPost, setSelectedPost] = useState(null);
  const [comment, setComment] = useState('');
  const [selectedBoard, setSelectedBoard] = useState(null); // 선택된 게시판 (null이면 메인 화면)
  const [writeTitle, setWriteTitle] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('자유 게시판'); // 새 글 작성 시 카테고리
  const [posts, setPosts] = useState([]); // Supabase에서 가져올 게시글 목록
  const [loading, setLoading] = useState(true); // 로딩 상태
  const [comments, setComments] = useState([]); // 댓글 목록
  const [postDetail, setPostDetail] = useState(null); // 게시글 상세 정보

  // 현재 날짜 포맷팅
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 게시글 가져오기 (초기 로딩 및 새로고침)
  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, category, views, comments_count, created_at, user_name')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('게시글 불러오기 실패:', error);
      alert('게시글을 불러오는 중 오류가 발생했습니다.');
    } else {
      setPosts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // 게시글 상세 정보 및 댓글 가져오기
  const fetchPostDetail = async (postId) => {
    try {
      // 먼저 현재 게시글 정보 가져오기
      const { data: currentPost, error: currentError } = await supabase
        .from('posts')
        .select('views')
        .eq('id', postId)
        .single();

      if (currentError) {
        console.error('게시글 정보 가져오기 실패:', currentError);
      } else {
        // 조회수 증가
        await supabase
          .from('posts')
          .update({ views: (currentPost.views || 0) + 1 })
          .eq('id', postId);
      }

      // 게시글 상세 정보 가져오기
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (postError) {
        console.error('게시글 상세 정보 불러오기 실패:', postError);
        return;
      }

      setPostDetail(postData);

      // 댓글 가져오기
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (commentsError) {
        console.error('댓글 불러오기 실패:', commentsError);
        setComments([]);
      } else {
        setComments(commentsData || []);
        
        // 실제 댓글 수와 comments_count 동기화
        const actualCommentCount = (commentsData || []).length;
        const updatedViews = (currentPost?.views || 0) + 1;
        
        if (postData.comments_count !== actualCommentCount) {
          // 댓글 수가 다르면 업데이트
          await supabase
            .from('posts')
            .update({ comments_count: actualCommentCount })
            .eq('id', postId);
          
          // 로컬 상태 업데이트
          const updatedPost = { ...postData, comments_count: actualCommentCount, views: updatedViews };
          setPostDetail(updatedPost);
          setPosts(posts.map(p => 
            p.id === postId 
              ? { ...p, comments_count: actualCommentCount, views: updatedViews }
              : p
          ));
          setSelectedPost(updatedPost);
        } else {
          // 조회수만 업데이트
          const updatedPost = { ...postData, views: updatedViews };
          setPosts(posts.map(p => 
            p.id === postId 
              ? { ...p, views: updatedViews }
              : p
          ));
          setSelectedPost(updatedPost);
        }
      }
    } catch (error) {
      console.error('게시글 상세 정보 가져오기 중 오류:', error);
    }
  };

  const handlePostClick = async (post) => {
    setSelectedPost(post);
    // 게시글 상세 정보 및 댓글 가져오기
    await fetchPostDetail(post.id);
  };

  const handleBoardArrowClick = (boardName, e) => {
    e.stopPropagation();
    setSelectedBoard(boardName);
  };

  const handleBoardClick = (boardName) => {
    setSelectedBoard(boardName);
  };

  const handleBackToMain = () => {
    setSelectedBoard(null);
    setSelectedPost(null); // 게시글 상세 화면에서도 뒤로가기 시 초기화
    setComments([]); // 댓글 목록 초기화
    setPostDetail(null); // 게시글 상세 정보 초기화
  };

  const handleCommentSubmit = async () => {
    if (!comment.trim()) {
      return;
    }

    if (!userInfo?.id || !userInfo?.name) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!selectedPost?.id) {
      alert('게시글을 선택해주세요.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([
          {
            post_id: selectedPost.id,
            user_id: userInfo.id,
            user_name: userInfo.name,
            content: comment.trim(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('댓글 작성 실패:', error);
        alert('댓글 작성 중 오류가 발생했습니다: ' + error.message);
        return;
      }

      // 댓글 목록에 추가
      const newComments = [...comments, data];
      setComments(newComments);
      
      // 게시글의 댓글 수 업데이트
      const newCommentCount = newComments.length;
      const { error: updateError } = await supabase
        .from('posts')
        .update({ comments_count: newCommentCount })
        .eq('id', selectedPost.id);

      if (updateError) {
        console.error('댓글 수 업데이트 실패:', updateError);
      } else {
        // 게시글 목록의 댓글 수도 업데이트
        setPosts(posts.map(p => 
          p.id === selectedPost.id 
            ? { ...p, comments_count: newCommentCount }
            : p
        ));
        // 선택된 게시글의 댓글 수도 업데이트
        if (postDetail) {
          setPostDetail({ ...postDetail, comments_count: newCommentCount });
        }
        setSelectedPost({ ...selectedPost, comments_count: newCommentCount });
      }

      setComment('');
    } catch (error) {
      console.error('댓글 작성 중 오류:', error);
      alert('댓글 작성 중 오류가 발생했습니다.');
    }
  };

  const handlePostSubmit = async () => {
    if (!writeTitle.trim() || !writeContent.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }
    if (!userInfo?.id || !userInfo?.name) {
      alert('사용자 정보를 찾을 수 없습니다. 로그인 상태를 확인해주세요.');
      return;
    }

    const newPost = {
      title: writeTitle,
      content: writeContent,
      category: selectedCategory,
      user_id: userInfo.id,
      user_name: userInfo.name,
    };

    const { error } = await supabase.from('posts').insert([newPost]);

    if (error) {
      console.error('게시글 작성 실패:', error);
      alert('게시글 작성 중 오류가 발생했습니다: ' + error.message);
    } else {
      alert('게시글이 성공적으로 작성되었습니다.');
      setWriteTitle('');
      setWriteContent('');
      setSelectedCategory('자유 게시판'); // 기본값으로 초기화
      setSelectedTab('게시판'); // 게시판 목록으로 이동
      fetchPosts(); // 게시글 목록 새로고침
    }
  };


  // 게시판 목록 데이터 필터링 (selectedBoard에 따라)
  const filteredPosts = selectedBoard 
    ? posts.filter(post => post.category === selectedBoard)
    : posts;


  // 기존 boardLists 및 defaultPostDetail 제거 (하드코딩된 데이터 제거)
  // (JSX 부분에서 posts 상태를 사용하도록 변경 예정)

  return (
    <div className="community">
      <div className="community-header">
        <h1 className="community-title">커뮤니티</h1>
        <p className="community-date">{getCurrentDate()}</p>
      </div>

      {/* 상단 탭 */}
      <div className="community-tabs">
        <button
          className={`community-tab ${selectedTab === '게시판' ? 'active' : ''}`}
          onClick={() => setSelectedTab('게시판')}
        >
          게시판
        </button>
        <button
          className={`community-tab ${selectedTab === '글쓰기' ? 'active' : ''}`}
          onClick={() => setSelectedTab('글쓰기')}
        >
          글쓰기
        </button>
      </div>

      {selectedTab === '게시판' ? (
        <>
          {loading ? (
            <div className="loading-message">게시글을 불러오는 중...</div>
          ) : (
            <>
              {selectedBoard ? (
                /* 선택된 게시판만 보기 */
                <>
                  <div className="board-full-list-container">
                    <div className="board-full-list-header">
                      <button className="back-button" onClick={handleBackToMain}>
                        <img src={arrowRightIcon} alt="뒤로가기" className="back-icon" />
                      </button>
                      <h2 className="board-full-list-title">{selectedBoard}</h2>
                    </div>
                    <div className="board-full-list">
                      {filteredPosts.map((post) => (
                        <div 
                          key={post.id} 
                          className="board-item"
                          onClick={() => handlePostClick(post)}
                        >
                          <p className="board-item-title">{post.title}</p>
                          <p className="board-item-time">{new Date(post.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      ))}
                      {filteredPosts.length === 0 && <div className="no-posts-message">게시글이 없습니다.</div>}
                    </div>
                  </div>

                  {/* 오른쪽: 게시글 상세 (게시글 선택 시에만 표시) */}
                  {selectedPost && ( // displayPost 대신 selectedPost 사용
                    <div className="post-detail-container">
                      <div className="post-header">
                        <div className="post-title-section">
                          <div className="post-title-row">
                            <h2 className="post-title">[{selectedPost.category}] {selectedPost.title}</h2>
                            <p className="post-date">{new Date(selectedPost.created_at).toLocaleDateString('ko-KR')}</p>
                          </div>
                          <div className="post-stats">
                            <div className="post-stat-item">
                              <img src={eyeIcon} alt="조회" className="stat-icon" />
                              <span className="stat-value">{postDetail?.views ?? selectedPost.views ?? 0}</span>
                            </div>
                            <div className="post-stat-item">
                              <img src={commentIcon} alt="댓글" className="stat-icon" />
                              <span className="stat-value">{postDetail?.comments_count ?? selectedPost.comments_count ?? comments.length}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="post-content">
                      <p>{postDetail?.content || selectedPost.content}</p>
                      </div>

                    {/* 댓글 섹션 */}
                      <div className="comments-section">
                        <div className="comments-header">
                        <h3 className="comments-title">댓글 ({comments.length})</h3>
                          <div className="comments-list">
                          {comments.length === 0 ? (
                            <div className="no-comments-message">댓글이 없습니다.</div>
                          ) : (
                            comments.map((comment) => (
                              <div key={comment.id} className="comment-item">
                                <p className="comment-content">{comment.content}</p>
                                <div className="comment-meta">
                                  <p className="comment-author">{comment.user_name || '익명'}</p>
                                  <p className="comment-time">
                                    {new Date(comment.created_at).toLocaleString('ko-KR', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                          </div>
                        </div>

                        {/* 댓글 입력 */}
                        <div className="comment-input-container">
                          <input
                            type="text"
                            className="comment-input"
                            placeholder="댓글을 입력하세요"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleCommentSubmit()}
                          />
                          <button 
                            className={`comment-send-btn ${comment ? 'active' : ''}`} 
                            onClick={handleCommentSubmit}
                          >
                            <CommentSendIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* 왼쪽: 게시판 목록 */}
                  <div className="board-list-container">
                    {/* 분실물 게시판 */}
                    <div className="board-section">
                      <div 
                        className="board-section-header"
                        onClick={() => handleBoardClick('분실물 게시판')}
                        style={{ cursor: 'pointer' }}
                      >
                        <h3 className="board-section-title">분실물 게시판</h3>
                        <button 
                          className="board-arrow-btn"
                          onClick={(e) => handleBoardArrowClick('분실물 게시판', e)}
                        >
                          <img src={arrowRightIcon} alt="더보기" className="arrow-icon" />
                        </button>
                      </div>
                      <div className="board-items">
                        {posts.filter(post => post.category === '분실물 게시판').slice(0, 5).map((post) => (
                          <div 
                            key={post.id} 
                            className="board-item"
                            onClick={() => handlePostClick(post)}
                          >
                            <p className="board-item-title">{post.title}</p>
                            <p className="board-item-time">{new Date(post.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        ))}
                        {posts.filter(post => post.category === '분실물 게시판').length === 0 && <div className="no-posts-message">게시글이 없습니다.</div>}
                      </div>
                    </div>

                    {/* 자유 게시판 */}
                    <div className="board-section">
                      <div 
                        className="board-section-header"
                        onClick={() => handleBoardClick('자유 게시판')}
                        style={{ cursor: 'pointer' }}
                      >
                        <h3 className="board-section-title">자유 게시판</h3>
                        <button 
                          className="board-arrow-btn"
                          onClick={(e) => handleBoardArrowClick('자유 게시판', e)}
                        >
                          <img src={arrowRightIcon} alt="더보기" className="arrow-icon" />
                        </button>
                      </div>
                      <div className="board-items">
                        {posts.filter(post => post.category === '자유 게시판').slice(0, 5).map((post) => (
                          <div 
                            key={post.id} 
                            className="board-item"
                            onClick={() => handlePostClick(post)}
                          >
                            <p className="board-item-title">{post.title}</p>
                            <p className="board-item-time">{new Date(post.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        ))}
                        {posts.filter(post => post.category === '자유 게시판').length === 0 && <div className="no-posts-message">게시글이 없습니다.</div>}
                      </div>
                    </div>
                  </div>

                  {/* 오른쪽: 게시글 상세 (게시글 선택 시에만 표시) */}
                  {selectedPost && ( // displayPost 대신 selectedPost 사용
                  <div className="post-detail-container">
                    <div className="post-header">
                      <div className="post-title-section">
                        <div className="post-title-row">
                          <h2 className="post-title">[{selectedPost.category}] {selectedPost.title}</h2>
                          <p className="post-date">{new Date(selectedPost.created_at).toLocaleDateString('ko-KR')}</p>
                        </div>
                        <div className="post-stats">
                          <div className="post-stat-item">
                            <img src={eyeIcon} alt="조회" className="stat-icon" />
                            <span className="stat-value">{postDetail?.views ?? selectedPost.views ?? 0}</span>
                          </div>
                          <div className="post-stat-item">
                            <img src={commentIcon} alt="댓글" className="stat-icon" />
                            <span className="stat-value">{postDetail?.comments_count ?? selectedPost.comments_count ?? comments.length}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="post-content">
                      <p>{postDetail?.content || selectedPost.content}</p>
                    </div>

                    {/* 댓글 섹션 */}
                    <div className="comments-section">
                      <div className="comments-header">
                        <h3 className="comments-title">댓글 ({comments.length})</h3>
                        <div className="comments-list">
                          {comments.length === 0 ? (
                          <div className="no-comments-message">댓글이 없습니다.</div>
                          ) : (
                            comments.map((comment) => (
                            <div key={comment.id} className="comment-item">
                              <p className="comment-content">{comment.content}</p>
                              <div className="comment-meta">
                                  <p className="comment-author">{comment.user_name || '익명'}</p>
                                  <p className="comment-time">
                                    {new Date(comment.created_at).toLocaleString('ko-KR', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* 댓글 입력 */}
                      <div className="comment-input-container">
                        <input
                          type="text"
                          className="comment-input"
                          placeholder="댓글을 입력하세요"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleCommentSubmit()}
                        />
                        <button 
                          className={`comment-send-btn ${comment ? 'active' : ''}`} 
                          onClick={handleCommentSubmit}
                        >
                          <CommentSendIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      ) : (
        <div className="write-section">
          <div className="write-header">
            <div className="write-title-row">
              <h2 className="write-title">글쓰기</h2>
              <p className="write-date">{getCurrentDate()}</p>
            </div>
          </div>
          
          <div className="write-form">
            <div className="write-input-wrapper">
              {/* 카테고리 선택 */}
              <div className="write-input-container">
                <select 
                  className="write-input write-category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="자유 게시판">자유 게시판</option>
                  <option value="분실물 게시판">분실물 게시판</option>
                </select>
              </div>

              <div className="write-input-container">
                <input
                  type="text"
                  className="write-input write-title-input"
                  placeholder="제목 (1~45자)"
                  value={writeTitle}
                  onChange={(e) => setWriteTitle(e.target.value)}
                  maxLength={45}
                />
                {writeTitle && (
                  <button 
                    className="write-clear-btn"
                    onClick={() => setWriteTitle('')}
                  >
                    <img src="/img/delete-icon.svg" alt="지우기" />
                  </button>
                )}
              </div>
              
              <div className="write-input-container write-content-container">
                <textarea
                  className="write-input write-content-input"
                  placeholder="내용 (1~500자)"
                  value={writeContent}
                  onChange={(e) => setWriteContent(e.target.value)}
                  maxLength={500}
                />
                {writeContent && (
                  <button 
                    className="write-clear-btn"
                    onClick={() => setWriteContent('')}
                  >
                    <img src="/img/delete-icon.svg" alt="지우기" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="write-buttons">
              <button className="write-cancel-btn" onClick={() => setSelectedTab('게시판')}>
                취소
              </button>
              <button className="write-submit-btn" onClick={handlePostSubmit}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Community;
