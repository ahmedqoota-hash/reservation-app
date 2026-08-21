import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB');
}

export default function MyBookingsPage() {
  const { t, isRTL } = useLanguage();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editBooking, setEditBooking] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Edit form state
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings/my');
      setBookings(res.data);
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setActionLoading(true);
    try {
      await api.delete(`/bookings/${cancelTarget.id}`);
      setMessage(t('bookingCancelled'));
      setCancelTarget(null);
      loadBookings();
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (booking) => {
    setEditBooking(booking);
    setEditForm({
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
      customer_id_number: booking.customer_id_number,
      customer_workplace: booking.customer_workplace,
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editBooking) return;
    setActionLoading(true);
    setError('');
    try {
      await api.put(`/bookings/${editBooking.id}`, editForm);
      setMessage(t('bookingUpdated'));
      setEditBooking(null);
      loadBookings();
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('myBookings')}</h1>
        <a
          href="/book"
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + {t('newBooking')}
        </a>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">
          {message}
          <button className="ms-2 text-green-500" onClick={() => setMessage('')}>✕</button>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
          {error}
          <button className="ms-2 text-red-500" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="py-20"><LoadingSpinner text={t('loading')} /></div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-gray-500">{t('noBookings')}</p>
          <a href="/book" className="mt-4 inline-block px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
            {t('bookAppointment')}
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded font-mono">
                      {b.reference}
                    </span>
                    <StatusBadge status={b.status} />
                    {b.slot_type === 'urgent' && (
                      <span className="text-xs font-bold text-urgent-600 bg-urgent-50 px-2 py-0.5 rounded-full">
                        {t('urgentSlots')}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900">{b.customer_name}</h3>
                  <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                    <div>{isRTL ? b.location_name_ar : b.location_name_en}</div>
                    <div>{formatDate(b.slot_date)} — {formatTime(b.slot_time)}</div>
                    <div>{b.customer_phone} · {b.customer_id_number}</div>
                    <div>{b.customer_workplace}</div>
                  </div>
                </div>
                {b.status === 'active' && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(b)}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={() => setCancelTarget(b)}
                      className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('cancelBooking')}</h3>
            <p className="text-gray-600 text-sm mb-5">{t('cancelConfirm')}</p>
            <div className="font-mono text-center text-primary-700 font-bold mb-5">{cancelTarget.reference}</div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-600 font-medium rounded-xl hover:bg-gray-50"
              >
                {t('no')}
              </button>
              <button
                onClick={handleCancelConfirm}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
              >
                {actionLoading ? <div className="w-5 h-5 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" /> : t('yes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('editBooking')}</h3>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              {[
                { key: 'customer_name', label: t('customerName') },
                { key: 'customer_phone', label: t('customerPhone') },
                { key: 'customer_id_number', label: t('customerIdNumber') },
                { key: 'customer_workplace', label: t('customerWorkplace') },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    type="text"
                    value={editForm[key] || ''}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditBooking(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-600 font-medium rounded-xl hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors"
                >
                  {actionLoading ? <div className="w-5 h-5 animate-spin rounded-full border-2 border-white border-t-transparent mx-auto" /> : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
