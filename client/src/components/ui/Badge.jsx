import React from 'react';
import './ui.css';

export const Badge = ({
  children,
  variant = 'info', // 'success', 'warning', 'danger', 'info'
  className = '',
  ...props
}) => {
  return (
    <span className={`badge badge-${variant} ${className}`} {...props}>
      {children}
    </span>
  );
};

export default Badge;
