import React from 'react';

const variants = {
  default: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  orange: 'bg-orange-100 text-orange-800',
  purple: 'bg-purple-100 text-purple-800',
  indigo: 'bg-indigo-100 text-indigo-800',
};

const statusMap = {
  PENDING: 'yellow',
  CONFIRMED: 'blue',
  IN_PROGRESS: 'indigo',
  COMPLETED: 'green',
  CANCELLED: 'red',
  ON_HOLD: 'orange',
  OPEN: 'blue',
  AVAILABLE: 'green',
  APO: 'yellow',
  SHORT: 'red',
  NEW: 'blue',
  REPEAT: 'purple',
  LOW: 'default',
  NORMAL: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
  PRINTING: 'indigo',
  ECL: 'purple',
  LAM1: 'blue',
  LAM2: 'blue',
  SLITTING: 'orange',
  POUCHING: 'green',
  admin: 'red',
  ppc_planner: 'blue',
  store_inventory: 'green',
  machine_operator: 'orange',
  sales: 'purple',
  management: 'indigo',
};

const Badge = ({ children, variant, status, size = 'sm' }) => {
  const resolvedVariant = variant || (status ? statusMap[status] || 'default' : 'default');
  const sizeClass = size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${variants[resolvedVariant]}`}>
      {children || status}
    </span>
  );
};

export default Badge;
