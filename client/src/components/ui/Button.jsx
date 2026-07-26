import React from 'react';
import './ui.css';

export const Button = ({
  children,
  type = 'button',
  variant = 'primary', // 'primary', 'secondary', 'outline', 'danger'
  size = 'md', // 'sm', 'md', 'lg'
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  className = '',
  ...props
}) => {
  const classes = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth ? 'btn-block' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <span className={`spinner ${variant === 'primary' || variant === 'secondary' || variant === 'danger' ? 'spinner-white' : ''}`} style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
      ) : null}
      {children}
    </button>
  );
};

export default Button;
