import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

// 로컬 이미지 경로
const homeIconActive = "/img/home-icon-active.svg";
const homeIcon = "/img/home-icon.svg";

const applicationIconActive = "/img/application-icon-active.svg";
const applicationIcon = "/img/application-icon.svg";

const communityIconActive = "/img/community-icon-active.svg";
const communityIcon = "/img/community-icon.svg";

const laundryIconActive = "/img/laundry-icon-active.svg";
const laundryIcon = "/img/laundry-icon.svg";

const profileIconActive = "/img/profile-icon-active.svg";
const profileIcon = "/img/profile-icon.svg";

function Sidebar({ userInfo, onLogout }) {
  const location = useLocation();

  const isActive = (path, exact) => {
    if (path === '/') {
      // 홈 페이지 또는 홈의 하위 페이지 (공지사항, 알람)일 때 활성화
      return location.pathname === '/' || location.pathname === '/notice' || location.pathname === '/alarm';
    }
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const menuItems = [
    { path: '/', label: '홈', iconActive: homeIconActive, icon: homeIcon, exact: false },
    { path: '/application', label: '신청 관리', iconActive: applicationIconActive, icon: applicationIcon, exact: false },
    { path: '/community', label: '커뮤니티', iconActive: communityIconActive, icon: communityIcon, exact: false },
    { path: '/laundry', label: '세탁 예약', iconActive: laundryIconActive, icon: laundryIcon, exact: false },
    { path: '/profile', label: '마이페이지', iconActive: profileIconActive, icon: profileIcon, exact: false },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link to="/" className="sidebar-brand">
          미림도미
        </Link>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const active = isActive(item.path, item.exact);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={`sidebar-item ${active ? 'active' : ''}`}
            >
              <div className="sidebar-icon-wrapper">
                <img 
                  src={active ? item.iconActive : item.icon} 
                  alt={item.label} 
                  className="sidebar-icon" 
                />
              </div>
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="sidebar-user-name">{userInfo?.name || '사용자'}</span>
        </div>
        <button onClick={onLogout} className="sidebar-logout">
          로그아웃
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;

