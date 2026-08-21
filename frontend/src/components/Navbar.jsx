import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { t, toggleLang, lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="bg-primary-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-800" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-wide">{t('appName')}</span>
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            {!isAdmin && (
              <>
                <Link
                  to="/book"
                  className={`text-sm font-medium hover:text-primary-200 transition-colors ${location.pathname === '/book' ? 'text-primary-200 border-b-2 border-primary-200 pb-1' : ''}`}
                >
                  {t('newBooking')}
                </Link>
                <Link
                  to="/my-bookings"
                  className={`text-sm font-medium hover:text-primary-200 transition-colors ${location.pathname === '/my-bookings' ? 'text-primary-200 border-b-2 border-primary-200 pb-1' : ''}`}
                >
                  {t('myBookings')}
                </Link>
              </>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className={`text-sm font-medium hover:text-primary-200 transition-colors ${location.pathname.startsWith('/admin') ? 'text-primary-200 border-b-2 border-primary-200 pb-1' : ''}`}
              >
                {t('adminDashboard')}
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="px-3 py-1 text-xs font-bold bg-primary-700 hover:bg-primary-600 rounded-full transition-colors border border-primary-500"
            >
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>

            {/* User info */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 text-sm hover:text-primary-200 transition-colors"
              >
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold uppercase">
                  {user.full_name?.charAt(0) || user.username?.charAt(0)}
                </div>
                <span className="hidden sm:block max-w-[120px] truncate">{user.full_name}</span>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {menuOpen && (
                <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-xl z-50 border border-gray-100`}>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs text-gray-500">{user.username}</p>
                    <p className="text-sm font-medium truncate">{user.full_name}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                      user.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </div>
                  {/* Mobile links */}
                  <div className="md:hidden">
                    {!isAdmin && (
                      <>
                        <Link to="/book" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-50">{t('newBooking')}</Link>
                        <Link to="/my-bookings" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-50">{t('myBookings')}</Link>
                      </>
                    )}
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm hover:bg-gray-50">{t('adminDashboard')}</Link>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-lg"
                  >
                    {t('logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
