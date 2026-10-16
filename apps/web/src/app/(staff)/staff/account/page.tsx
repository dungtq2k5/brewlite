'use client';

import './StaffProfile.css';
import { useState } from 'react';

export default function StaffProfile() {
  const [name, setName] = useState('Nguyễn Minh Anh');
  const [language, setLanguage] = useState('vi');

  return (
    <div className="staff-profile">
      <h1 className="page-title">Tài khoản</h1>
      <p className="page-description">Quản lý thông tin cá nhân và ngôn ngữ hiển thị.</p>

      <div className="wrapper">
        <div className="wrapper-infor">
          <div className="avatar">MA</div>
          <div className="name">Nguyễn Minh Anh</div>
          <small className="role">Nhân viên</small>

          <div className="infor-details">
            <div className="infor-row">
              <span>Email</span>
              <strong>minhanh@brewlite.vn</strong>
            </div>

            <div className="infor-row">
              <span>Ngày tạo tài khoản</span>
              <strong>15/08/2024</strong>
            </div>

            <div className="infor-row">
              <span>Bảo mật</span>
              <strong>Đã thiết lập mật khẩu</strong>
            </div>
          </div>
        </div>

        <div className="wrapper-edit">
          <h2>Chỉnh hồ sơ</h2>
          <small>Cập nhật tên hiển thị và ngôn ngữ.</small>

          <div className="form-group">
            <label htmlFor="fullName">Họ và tên *</label>
            <input
              id="fullName"
              type="text"
              value={name}
              placeholder="Nhập họ và tên"
              onChange={(e) => setName(e.target.value)}
            />

            <label htmlFor="language">Ngôn ngữ hiển thị</label>

            <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-reset">
              Tải lại
            </button>

            <button type="button" className="btn-save">
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
