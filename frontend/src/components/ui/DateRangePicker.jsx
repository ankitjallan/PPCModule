import React from 'react';
import Input from './Input';

const DateRangePicker = ({ from, to, onFromChange, onToChange, label = 'Date Range' }) => {
  return (
    <div className="flex items-end gap-2">
      <Input
        label={label ? `${label} From` : 'From'}
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
      />
      <Input
        label={label ? `${label} To` : 'To'}
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
      />
    </div>
  );
};

export default DateRangePicker;
