import { useState } from 'react';
import Image from 'next/image';

interface TeamLogoProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showBackground?: boolean;
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16'
};

export function TeamLogo({ 
  src, 
  alt, 
  size = 'md', 
  className = '',
  showBackground = true 
}: TeamLogoProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const sizeClass = sizeMap[size];
  const bgClass = showBackground ? 'bg-white dark:bg-gray-800' : '';

  if (error) {
    return (
      <div className={`${sizeClass} ${bgClass} rounded-lg flex items-center justify-center ${className}`}>
        <span className="text-gray-400 dark:text-gray-500 text-xs">🏢</span>
      </div>
    );
  }

  return (
    <div className={`${sizeClass} relative rounded-lg overflow-hidden ${bgClass} ${className}`}>
      {loading && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
      )}
      <Image
        src={src}
        alt={alt}
        width={64}
        height={64}
        className="w-full h-full object-contain p-1"
        onError={() => setError(true)}
        onLoad={() => setLoading(false)}
      />
    </div>
  );
} 