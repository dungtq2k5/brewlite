'use client';

import React from 'react';

interface Props {
  filled?: boolean;
  steaming?: boolean;
  hasSaucer?: boolean;
}

export default function CupIllustration({
  filled = true,
  steaming = true,
  hasSaucer = false,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-2">
      {/* Khói nghi ngút */}
      {steaming ? (
        <div className="flex gap-2.5 mb-1.5 animate-pulse">
          <svg
            className="w-4 h-6 text-[#4E3427] stroke-current"
            fill="none"
            viewBox="0 0 24 36"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" d="M16 4c-4 6-4 10 0 16s4 10 0 16" />
          </svg>
          <svg
            className="w-4 h-6 text-[#4E3427] stroke-current"
            fill="none"
            viewBox="0 0 24 36"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" d="M16 4c-4 6-4 10 0 16s4 10 0 16" />
          </svg>
        </div>
      ) : (
        <div className="h-7.5" />
      )}

      {/* Ly Cà Phê */}
      <div className="relative">
        <svg className="w-28 h-20" viewBox="0 0 110 75" fill="none">
          {/* Quai ly */}
          <path
            d="M75 16h10a12 12 0 0 1 12 12v4a12 12 0 0 1-12 12H75"
            stroke="#4E3427"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Thân ly */}
          <path
            d="M15 10h65l-6 45a16 16 0 0 1-16 14H37a16 16 0 0 1-16-14L15 10z"
            fill={filled ? '#6E4935' : '#F5EFE6'}
            stroke="#4E3427"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Đĩa lót đáy */}
          {(hasSaucer || !filled) && (
            <line
              x1="8"
              y1="71"
              x2="88"
              y2="71"
              stroke="#4E3427"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
