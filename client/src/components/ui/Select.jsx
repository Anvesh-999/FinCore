import React from 'react';
import './ui.css';

export const Select = React.forwardRef(({
  label,
  id,
  options = [], // [{ value, label }]
  error,
  disabled = false,
  className = '',
  required = false,
  placeholder,
  ...props
}, ref) => {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        disabled={disabled}
        required={required}
        className={`form-select ${error ? 'form-input-error' : ''}`}
        style={error ? { borderColor: 'var(--color-danger)' } : {}}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
