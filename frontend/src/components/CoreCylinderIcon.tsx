import React from 'react';

interface CoreCylinderIconProps {
  size?: number;
  className?: string;
  color?: string;
  style?: React.CSSProperties;
}

export const CoreCylinderIcon: React.FC<CoreCylinderIconProps> = ({
  size = 18,
  className = '',
  color = 'currentColor',
  style
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {/* Industrial Gas Cylinder (Left) */}
      <path d="M4 8a3 3 0 0 1 6 0v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
      <path d="M6 4h2" />
      <path d="M7 4v2" />
      <line x1="4" y1="12" x2="10" y2="12" />

      {/* Foundry Casting Sand Core Cylinder (Right) */}
      <ellipse cx="17" cy="6.5" rx="3.5" ry="1.8" />
      <path d="M13.5 6.5v11c0 1 1.6 1.8 3.5 1.8s3.5-.8 3.5-1.8v-11" />
      <path d="M13.5 12c0 1 1.6 1.8 3.5 1.8s3.5-.8 3.5-1.8" />
    </svg>
  );
};

export default CoreCylinderIcon;
