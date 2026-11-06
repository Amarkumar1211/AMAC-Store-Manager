import React from 'react';

interface FifoChuteIconProps {
  size?: number;
  className?: string;
  color?: string;
  style?: React.CSSProperties;
}

export const FifoChuteIcon: React.FC<FifoChuteIconProps> = ({
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
      {/* Vertical FIFO Chute Rails */}
      <path d="M6 3v18" />
      <path d="M18 3v18" />
      {/* FIFO Gravity Material Spheres in Queue */}
      <circle cx="12" cy="7" r="2.75" />
      <circle cx="12" cy="13" r="2.75" />
      <circle cx="12" cy="19" r="2.75" />
      {/* Top Flow Indicator */}
      <path d="M12 1.5v2.5" />
    </svg>
  );
};

export default FifoChuteIcon;
