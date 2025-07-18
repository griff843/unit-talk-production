import { useState } from 'react';
import Image from 'next/image';

interface PlayerHeadshotProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16'
};

export function PlayerHeadshot({ src, alt, size = 'md', className = '' }: PlayerHeadshotProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const sizeClass = sizeMap[size];

  if (error) {
    return (
      <div className={`${sizeClass} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}>
        <span className="text-gray-400 dark:text-gray-500 text-xs">👤</span>
      </div>
    );
  }

  return (
    <div className={`${sizeClass} relative rounded-full overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
      )}
      <Image
        src={src}
        alt={alt}
        width={64}
        height={64}
        className="w-full h-full object-cover"
        onError={() => setError(true)}
        onLoad={() => setLoading(false)}
      />
    </div>
  );
} 