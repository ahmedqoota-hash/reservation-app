import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function StatusBadge({ status }) {
  const { t } = useLanguage();
  const styles = {
    active: 'bg-green-100 text-green-700 border border-green-200',
    cancelled: 'bg-red-100 text-red-700 border border-red-200',
    completed: 'bg-blue-100 text-blue-700 border border-blue-200',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {t(status) || status}
    </span>
  );
}
