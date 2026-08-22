import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';

const today = () => new Date().toISOString().split('T')[0];

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
  return new Date(dateStr).toLocaleDateString('en-GB');
}

function StatCard({ title, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-xs font-medium opacity-70 mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-60 mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const { t, isRTL } = useLanguage();
  const { user, isSuperAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [statsDate, setStatsDate] = useState(today());
  const [stats, setStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsMeta, setBookingsMeta] = useState({ total: 0, page: 1 });
  const [filters, setFilters] = useState({ location_id: '', date: today(), status: '', page: 1 });
  const [locations, setLocations] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Slot management state
  const [slotLocation, setSlotLocation] = useState('');
  const [slotDate, setSlotDate] = useState(today());
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [slotActionLoading, setSlotActionLoading] = useState(null);

  useEffect(() => {
    api.get('/locations').then((r) => setLocations(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'slots' && slotLocation && slotDate) loadAdminSlots();
  }, [slotLocation, slotDate, activeTab]);

  const loadAdminSlots = async () => {
    setSlotsLoading(true);
    try {
      const res = await api.get(`/slots/admin?location_id=${slotLocation}&date=${slotDate}`);
      setSlots(res.data);
    } catch {
      setError(t('error'));
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleBlockSlot = async (slotId, currentlyBlocked) => {
    setSlotActionLoading(slotId);
    try {
      if (currentlyBlocked) {
        await api.patch(`/slots/${slotId}/unblock`);
        setMessage('Slot unblocked');
      } else {
        await api.patch(`/slots/${slotId}/block`, { reason: blockReason || null });
        setMessage('Slot blocked');
      }
      loadAdminSlots();
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
    } finally {
      setSlotActionLoading(null);
    }
  };

  const handleBlockDay = async () => {
    if (!slotLocation || !slotDate) return;
    setSlotActionLoading('day');
    try {
      await api.post('/slots/block-day', { location_id: slotLocation, date: slotDate, reason: blockReason || null });
      setMessage('All slots blocked for this date');
      loadAdminSlots();
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
    } finally {
      setSlotActionLoading(null);
    }
  };

  const handleUnblockDay = async () => {
    if (!slotLocation || !slotDate) return;
    setSlotActionLoading('unblock-day');
    try {
      await api.post('/slots/unblock-day', { location_id: slotLocation, date: slotDate });
      setMessage('All slots unblocked for this date');
      loadAdminSlots();
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
    } finally {
      setSlotActionLoading(null);
    }
  };



  useEffect(() => {
    if (activeTab === 'bookings') loadBookings();
  }, [filters, activeTab]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await api.get(`/bookings/admin/stats?date=${statsDate}`);
      setStats(res.data.locations);
    } catch {
      setError(t('error'));
    } finally {
      setStatsLoading(false);
    }
  };

  const loadBookings = async () => {
    setBookingsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.location_id) params.append('location_id', filters.location_id);
      if (filters.date) params.append('date', filters.date);
      if (filters.status) params.append('status', filters.status);
      params.append('page', filters.page);
      params.append('limit', 20);
      const res = await api.get(`/bookings/admin?${params}`);
      setBookings(res.data.bookings);
      setBookingsMeta({ total: res.data.total, page: res.data.page });
    } catch {
      setError(t('error'));
    } finally {
      setBookingsLoading(false);
    }
  };

  const updateStatus = async (bookingId, status) => {
    setActionLoading(bookingId);
    setError('');
    try {
      await api.patch(`/bookings/admin/${bookingId}/status`, { status });
      setMessage('Status updated successfully');
      loadBookings();
      loadStats();
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
    } finally {
      setActionLoading(null);
    }
  };

  const exportCSV = () => {
    if (!bookings.length) return;
    const headers = ['Reference', 'Name', 'Phone', 'ID Number', 'Workplace', 'Location', 'Date', 'Time', 'Type', 'Status', 'Booked By'];
    const rows = bookings.map((b) => [
      b.reference,
      b.customer_name,
      b.customer_phone,
      b.customer_id_number,
      b.customer_workplace,
      isRTL ? b.location_name_ar : b.location_name_en,
      formatDate(b.slot_date),
      formatTime(b.slot_time),
      b.slot_type,
      b.status,
      b.booked_by_username,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings_${filters.date || today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalStats = stats.reduce((acc, loc) => ({
    active: acc.active + parseInt(loc.active_bookings || 0),
    cancelled: acc.cancelled + parseInt(loc.cancelled_bookings || 0),
    completed: acc.completed + parseInt(loc.completed_bookings || 0),
    regular_capacity: acc.regular_capacity + parseInt(loc.regular_capacity || 0),
    regular_booked: acc.regular_booked + parseInt(loc.regular_booked || 0),
    urgent_capacity: acc.urgent_capacity + parseInt(loc.urgent_capacity || 0),
    urgent_booked: acc.urgent_booked + parseInt(loc.urgent_booked || 0),
  }), { active: 0, cancelled: 0, completed: 0, regular_capacity: 0, regular_booked: 0, urgent_capacity: 0, urgent_booked: 0 });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('adminDashboard')}</h1>
          {!isSuperAdmin && user?.location_name_en && (
            <p className="text-sm text-gray-500 mt-0.5">
              {isRTL ? user.location_name_ar : user.location_name_en}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'bookings' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {t('viewBookings')}
          </button>
          <button
            onClick={() => setActiveTab('slots')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'slots' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {isRTL ? 'إدارة المواعيد' : 'Manage Slots'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')}>✕</button>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div>
          {/* Date picker */}
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-medium text-gray-700">{t('filterByDate')}</label>
            <input
              type="date"
              value={statsDate}
              onChange={(e) => setStatsDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {statsLoading ? (
            <div className="py-20"><LoadingSpinner text={t('loading')} /></div>
          ) : (
            <>
              {/* Summary cards */}
              {isSuperAdmin && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <StatCard title={t('todayBookings')} value={totalStats.active} color="blue" />
                  <StatCard title={t('cancelled')} value={totalStats.cancelled} color="red" />
                  <StatCard
                    title={t('regularCapacity')}
                    value={`${totalStats.regular_booked}/${totalStats.regular_capacity}`}
                    color="green"
                  />
                  <StatCard
                    title={t('urgentCapacity')}
                    value={`${totalStats.urgent_booked}/${totalStats.urgent_capacity}`}
                    color="orange"
                  />
                </div>
              )}

              {/* Per-location cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.map((loc) => {
                  const regularFill = loc.regular_capacity > 0
                    ? Math.round((loc.regular_booked / loc.regular_capacity) * 100) : 0;
                  const urgentFill = loc.urgent_capacity > 0
                    ? Math.round((loc.urgent_booked / loc.urgent_capacity) * 100) : 0;

                  return (
                    <div key={loc.location_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <h3 className="font-bold text-gray-900 text-lg mb-4">
                        {isRTL ? loc.name_ar : loc.name_en}
                      </h3>

                      <div className="space-y-3">
                        {/* Regular */}
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{t('regularSlots')}</span>
                            <span>{loc.regular_booked || 0} / {loc.regular_capacity || 0}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full transition-all"
                              style={{ width: `${regularFill}%` }}
                            />
                          </div>
                        </div>

                        {/* Urgent */}
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{t('urgentSlots')}</span>
                            <span>{loc.urgent_booked || 0} / {loc.urgent_capacity || 0}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-urgent-500 rounded-full transition-all"
                              style={{ width: `${urgentFill}%` }}
                            />
                          </div>
                        </div>

                        {/* Booking counts */}
                        <div className="grid grid-cols-3 gap-2 pt-2">
                          <div className="text-center">
                            <div className="text-lg font-bold text-green-600">{loc.active_bookings || 0}</div>
                            <div className="text-xs text-gray-400">{t('active')}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-red-500">{loc.cancelled_bookings || 0}</div>
                            <div className="text-xs text-gray-400">{t('cancelled')}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-500">{loc.completed_bookings || 0}</div>
                            <div className="text-xs text-gray-400">{t('completed')}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* BOOKINGS TAB */}
      {activeTab === 'bookings' && (
        <div>
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {isSuperAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterByLocation')}</label>
                  <select
                    value={filters.location_id}
                    onChange={(e) => setFilters({ ...filters, location_id: e.target.value, page: 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">{t('allLocations')}</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{isRTL ? loc.name_ar : loc.name_en}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterByDate')}</label>
                <input
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters({ ...filters, date: e.target.value, page: 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterByStatus')}</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">{t('allStatuses')}</option>
                  <option value="active">{t('active')}</option>
                  <option value="cancelled">{t('cancelled')}</option>
                  <option value="completed">{t('completed')}</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={exportCSV}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  ↓ {t('export')} CSV
                </button>
              </div>
            </div>
          </div>

          {/* Count */}
          <div className="text-sm text-gray-500 mb-3">
            {bookingsMeta.total} {t('totalBookings')}
          </div>

          {/* Table */}
          {bookingsLoading ? (
            <div className="py-20"><LoadingSpinner text={t('loading')} /></div>
          ) : bookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
              {t('noData')}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-start font-semibold text-gray-600">{t('reference')}</th>
                      <th className="px-4 py-3 text-start font-semibold text-gray-600">{t('customerName')}</th>
                      <th className="px-4 py-3 text-start font-semibold text-gray-600">{t('customerPhone')}</th>
                      <th className="px-4 py-3 text-start font-semibold text-gray-600">{t('customerIdNumber')}</th>
                      {isSuperAdmin && <th className="px-4 py-3 text-start font-semibold text-gray-600">{t('location')}</th>}
                      <th className="px-4 py-3 text-start font-semibold text-gray-600">{t('date')}</th>
                      <th className="px-4 py-3 text-start font-semibold text-gray-600">{t('time')}</th>
                      <th className="px-4 py-3 text-start font-semibold text-gray-600">{t('type')}</th>
                      <th className="px-4 py-3 text-start font-semibold text-gray-600">{t('status')}</th>
                      <th className="px-4 py-3 text-start font-semibold text-gray-600">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-primary-700 text-xs">{b.reference}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{b.customer_name}</td>
                        <td className="px-4 py-3 text-gray-600">{b.customer_phone}</td>
                        <td className="px-4 py-3 text-gray-600">{b.customer_id_number}</td>
                        {isSuperAdmin && (
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {isRTL ? b.location_name_ar : b.location_name_en}
                          </td>
                        )}
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(b.slot_date)}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatTime(b.slot_time)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            b.slot_type === 'urgent'
                              ? 'bg-urgent-100 text-urgent-700'
                              : 'bg-primary-100 text-primary-700'
                          }`}>
                            {b.slot_type === 'urgent' ? t('urgentSlots') : t('regularSlots')}
                          </span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {b.status === 'active' && (
                              <>
                                <button
                                  onClick={() => updateStatus(b.id, 'completed')}
                                  disabled={actionLoading === b.id}
                                  className="px-2 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => updateStatus(b.id, 'cancelled')}
                                  disabled={actionLoading === b.id}
                                  className="px-2 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded transition-colors"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                            {b.status === 'cancelled' && (
                              <button
                                onClick={() => updateStatus(b.id, 'active')}
                                disabled={actionLoading === b.id}
                                className="px-2 py-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 rounded transition-colors whitespace-nowrap"
                              >
                                {t('markActive')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {bookingsMeta.total > 20 && (
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                  <span>
                    Showing {((filters.page - 1) * 20) + 1}–{Math.min(filters.page * 20, bookingsMeta.total)} of {bookingsMeta.total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                      disabled={filters.page <= 1}
                      className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                      disabled={filters.page * 20 >= bookingsMeta.total}
                      className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                    >
                      →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SLOTS MANAGEMENT TAB */}
      {activeTab === 'slots' && (
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('location')}</label>
                <select
                  value={slotLocation}
                  onChange={(e) => setSlotLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">{t('selectLocation')}</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{isRTL ? loc.name_ar : loc.name_en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('date')}</label>
                <input
                  type="date"
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {isRTL ? 'سبب الإغلاق (اختياري)' : 'Block Reason (optional)'}
                </label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder={isRTL ? 'مثال: إجازة رسمية' : 'e.g. Public holiday'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            {slotLocation && slotDate && (
              <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={handleBlockDay}
                  disabled={slotActionLoading === 'day'}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {slotActionLoading === 'day' ? '...' : (isRTL ? '🔒 إغلاق كل اليوم' : '🔒 Block Entire Day')}
                </button>
                <button
                  onClick={handleUnblockDay}
                  disabled={slotActionLoading === 'unblock-day'}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {slotActionLoading === 'unblock-day' ? '...' : (isRTL ? '🔓 فتح كل اليوم' : '🔓 Unblock Entire Day')}
                </button>
              </div>
            )}
          </div>

          {!slotLocation ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
              {isRTL ? 'اختر موقعاً وتاريخاً لعرض المواعيد' : 'Select a location and date to view slots'}
            </div>
          ) : slotsLoading ? (
            <div className="py-20"><LoadingSpinner text={t('loading')} /></div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {slots.map((slot) => {
                  const isBlocked = slot.is_blocked;
                  const isFull = !isBlocked && slot.booked_count >= slot.capacity;
                  const [h, m] = slot.slot_time.split(':');
                  const hour = parseInt(h);
                  const ampm = hour >= 12 ? 'PM' : 'AM';
                  const dh = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                  const timeLabel = `${dh}:${m} ${ampm}`;
                  return (
                    <div key={slot.id} className={`rounded-xl border-2 p-3 text-center ${
                      isBlocked ? 'bg-red-50 border-red-300' :
                      isFull ? 'bg-gray-50 border-gray-200' :
                      slot.slot_type === 'urgent' ? 'bg-orange-50 border-orange-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="text-xs font-bold text-gray-700 mb-1">{timeLabel}</div>
                      <div className={`text-xs mb-1 font-medium ${
                        isBlocked ? 'text-red-600' : isFull ? 'text-gray-500' :
                        slot.slot_type === 'urgent' ? 'text-orange-600' : 'text-blue-600'
                      }`}>
                        {isBlocked ? (isRTL ? '🔒 مغلق' : '🔒 Blocked') :
                         isFull ? (isRTL ? 'ممتلئ' : 'Full') :
                         `${slot.booked_count}/${slot.capacity}`}
                      </div>
                      {slot.blocked_reason && (
                        <div className="text-xs text-red-400 mb-1 truncate" title={slot.blocked_reason}>
                          {slot.blocked_reason}
                        </div>
                      )}
                      <button
                        onClick={() => handleBlockSlot(slot.id, isBlocked)}
                        disabled={slotActionLoading === slot.id}
                        className={`w-full py-1 text-xs font-medium rounded-lg transition-colors ${
                          isBlocked ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                          'bg-red-100 text-red-700 hover:bg-red-200'
                        } disabled:opacity-40`}
                      >
                        {slotActionLoading === slot.id ? '...' :
                          isBlocked ? (isRTL ? 'فتح' : 'Unblock') : (isRTL ? 'إغلاق' : 'Block')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}