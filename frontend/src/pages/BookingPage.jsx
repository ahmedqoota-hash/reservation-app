import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';

const today = () => new Date().toISOString().split('T')[0];

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export default function BookingPage() {
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();

  // Step: 1=select location+date, 2=select slot, 3=fill form, 4=success
  const [step, setStep] = useState(1);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today());
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_id_number: '',
    customer_workplace: '',
  });
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/locations').then((res) => setLocations(res.data)).catch(() => {});
  }, []);

  const loadSlots = async (locationId, date) => {
    setSlotsLoading(true);
    setError('');
    try {
      const res = await api.get(`/slots?location_id=${locationId}&date=${date}`);
      setSlots(res.data);
    } catch (err) {
      setError(t('error'));
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleLocationDateNext = () => {
    if (!selectedLocation || !selectedDate) return;
    loadSlots(selectedLocation.id, selectedDate);
    setStep(2);
  };

  const handleSlotSelect = (slot) => {
    if (slot.available <= 0) return;
    setSelectedSlot(slot);
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/bookings', {
        slot_id: selectedSlot.id,
        ...form,
      });
      setBooking(res.data);
      setStep(4);
    } catch (err) {
      const msg = err.response?.data?.error;
      if (msg === 'This slot is fully booked') {
        setError(t('slotFullError'));
        setStep(2);
        loadSlots(selectedLocation.id, selectedDate);
      } else {
        setError(msg || t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedLocation(null);
    setSelectedDate(today());
    setSlots([]);
    setSelectedSlot(null);
    setForm({ customer_name: '', customer_phone: '', customer_id_number: '', customer_workplace: '' });
    setBooking(null);
    setError('');
  };

  const regularSlots = slots.filter((s) => s.slot_type === 'regular');
  const urgentSlots = slots.filter((s) => s.slot_type === 'urgent');

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
              step > s ? 'bg-primary-600 border-primary-600 text-white' :
              step === s ? 'bg-white border-primary-600 text-primary-600' :
              'bg-white border-gray-300 text-gray-400'
            }`}>
              {step > s ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : s}
            </div>
            {s < 3 && <div className={`flex-1 h-1 mx-1 rounded ${step > s ? 'bg-primary-600' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
          {error}
        </div>
      )}

      {/* STEP 1: Location + Date */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{t('bookAppointment')}</h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('selectLocation')}</label>
              <div className="grid grid-cols-2 gap-3">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => setSelectedLocation(loc)}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-all text-center ${
                      selectedLocation?.id === loc.id
                        ? 'bg-primary-600 border-primary-600 text-white shadow-md'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                    }`}
                  >
                    {isRTL ? loc.name_ar : loc.name_en}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('selectDate')}</label>
              <input
                type="date"
                value={selectedDate}
                min={today()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <button
              onClick={handleLocationDateNext}
              disabled={!selectedLocation || !selectedDate}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Select Slot */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t('selectSlot')}</h2>
            <div className="text-sm text-gray-500">
              {isRTL ? selectedLocation?.name_ar : selectedLocation?.name_en} — {selectedDate}
            </div>
          </div>

          {slotsLoading ? (
            <div className="py-12"><LoadingSpinner text={t('loading')} /></div>
          ) : (
            <div className="space-y-6">
              {/* Regular slots */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-primary-500" />
                  <h3 className="font-semibold text-gray-800">{t('regularSlots')}</h3>
                  <span className="text-xs text-gray-400 ms-auto">
                    {regularSlots.reduce((sum, s) => sum + s.available, 0)} {t('remainingSlots')}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {regularSlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => handleSlotSelect(slot)}
                      disabled={slot.available <= 0}
                      className={`p-2 rounded-lg text-center text-xs font-medium transition-all ${
                        slot.available <= 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                          : 'bg-white border-2 border-primary-200 hover:border-primary-500 hover:bg-primary-50 text-gray-700 cursor-pointer'
                      }`}
                    >
                      <div className="font-bold">{formatTime(slot.slot_time)}</div>
                      <div className={`text-xs mt-0.5 ${slot.available <= 0 ? 'text-gray-400' : 'text-primary-600'}`}>
                        {slot.available <= 0 ? t('slotFull') : `${slot.available}/${slot.capacity}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Urgent slots */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-urgent-500" />
                  <h3 className="font-semibold text-gray-800">{t('urgentSlots')}</h3>
                  <span className="text-xs text-gray-400 ms-auto">
                    {urgentSlots.reduce((sum, s) => sum + s.available, 0)} {t('remainingSlots')}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {urgentSlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => handleSlotSelect(slot)}
                      disabled={slot.available <= 0}
                      className={`p-2 rounded-lg text-center text-xs font-medium transition-all ${
                        slot.available <= 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                          : 'bg-white border-2 border-urgent-200 hover:border-urgent-500 hover:bg-urgent-50 text-gray-700 cursor-pointer'
                      }`}
                    >
                      <div className="font-bold">{formatTime(slot.slot_time)}</div>
                      <div className={`text-xs mt-0.5 ${slot.available <= 0 ? 'text-gray-400' : 'text-urgent-600'}`}>
                        {slot.available <= 0 ? t('slotFull') : `${slot.available}/${slot.capacity}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setStep(1)}
            className="mt-6 w-full py-2.5 border border-gray-300 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            {t('back')}
          </button>
        </div>
      )}

      {/* STEP 3: Fill Form */}
      {step === 3 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t('newBooking')}</h2>
          </div>

          {/* Selected slot summary */}
          <div className="mb-5 p-4 bg-primary-50 border border-primary-200 rounded-xl flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{isRTL ? selectedLocation?.name_ar : selectedLocation?.name_en}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <span>{selectedDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{formatTime(selectedSlot?.slot_time)}</span>
            </div>
            {selectedSlot?.slot_type === 'urgent' && (
              <span className="px-2 py-0.5 bg-urgent-100 text-urgent-700 rounded-full text-xs font-bold">
                {t('urgentSlots')}
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'customer_name', label: t('customerName'), type: 'text', placeholder: '' },
              { key: 'customer_phone', label: t('customerPhone'), type: 'tel', placeholder: '' },
              { key: 'customer_id_number', label: t('customerIdNumber'), type: 'text', placeholder: '' },
              { key: 'customer_workplace', label: t('customerWorkplace'), type: 'text', placeholder: '' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                {t('back')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-5 h-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : t('confirm')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 4: Success */}
      {step === 4 && booking && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-9 h-9 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('bookingSuccess')}</h2>
          <p className="text-gray-500 mb-6">{t('bookingReference')}</p>

          <div className="bg-primary-50 border-2 border-primary-200 rounded-xl p-4 mb-6">
            <div className="text-3xl font-bold text-primary-700 tracking-widest">{booking.reference}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mb-6">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-gray-500 text-xs mb-1">{t('location')}</div>
              <div className="font-semibold">{isRTL ? booking.location_name_ar : booking.location_name_en}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-gray-500 text-xs mb-1">{t('date')}</div>
              <div className="font-semibold">{booking.slot_date?.split('T')[0]}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-gray-500 text-xs mb-1">{t('time')}</div>
              <div className="font-semibold">{formatTime(booking.slot_time)}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-gray-500 text-xs mb-1">{t('type')}</div>
              <div className={`font-semibold ${booking.slot_type === 'urgent' ? 'text-urgent-600' : 'text-primary-600'}`}>
                {booking.slot_type === 'urgent' ? t('urgentSlots') : t('regularSlots')}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetForm}
              className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors"
            >
              {t('newBooking')}
            </button>
            <a
              href="/my-bookings"
              className="flex-1 py-2.5 border border-gray-300 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center"
            >
              {t('myBookings')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
