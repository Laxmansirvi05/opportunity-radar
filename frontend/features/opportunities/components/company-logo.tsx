'use client'

import React, { useState } from 'react'

interface CompanyLogoProps {
  src: string | null | undefined
  alt: string
  containerClassName?: string
  imageClassName?: string
  fallbackIconClassName?: string
}

export function CompanyLogo({
  src,
  alt,
  containerClassName = "w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center border border-outline-variant/60 shadow-sm overflow-hidden shrink-0",
  imageClassName = "w-8 h-8 object-contain",
  fallbackIconClassName = "material-symbols-outlined text-on-surface-variant text-[24px]"
}: CompanyLogoProps) {
  const [error, setError] = useState(false)

  const hasValidSrc = src && src.trim() !== '' && !error

  return (
    <div className={containerClassName}>
      {hasValidSrc ? (
        <img
          src={src}
          alt={alt}
          className={imageClassName}
          onError={() => setError(true)}
          loading="lazy"
        />
      ) : (
        <span className={fallbackIconClassName}>
          business
        </span>
      )}
    </div>
  )
}
