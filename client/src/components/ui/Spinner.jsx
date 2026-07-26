import React from 'react';
import './ui.css';

export const Spinner = ({ variant = 'accent', className = '' }) => {
  return (
    <div
      className={`spinner ${variant === 'white' ? 'spinner-white' : ''} ${className}`}
    />
  );
};

export default Spinner;
