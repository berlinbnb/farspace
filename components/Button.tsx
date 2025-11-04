
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'gradient';
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseClasses = 'px-6 py-3 rounded-custom font-semibold text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg';

  const variantClasses = {
    primary: 'bg-primary-accent hover:bg-opacity-80 focus:ring-primary-accent',
    secondary: 'bg-glass-bg border border-glass-border hover:bg-white/20 focus:ring-secondary-accent',
    gradient: 'bg-gradient-to-r from-purple-600 via-primary-accent to-fuchsia-500 hover:shadow-lg hover:shadow-primary-accent/30 focus:ring-primary-accent',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
