import React from 'react';
import './ui.css';

export const Input = React.forwardRef(({
  label,
  id,
  type = 'text',
  error,
  placeholder,
  disabled = false,
  className = '',
  required = false,
  ...props
}, ref) => {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        id={id}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`form-input ${error ? 'form-input-error' : ''}`}
        style={error ? { borderColor: 'var(--color-danger)' } : {}}
        {...props}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
