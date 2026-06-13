'use client'

import React, { useState, useEffect, useRef } from 'react'

interface CompanyLogoProps {
  src?: string | null
  alt?: string
  containerClassName?: string
  imageClassName?: string
  fallbackIconClassName?: string
}

export const CompanyLogo = React.memo(function CompanyLogo({ 
  src, 
  alt = 'Company Logo',
  containerClassName = "w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center border border-outline-variant/60 shadow-sm overflow-hidden shrink-0",
  imageClassName = "w-8 h-8 object-contain",
  fallbackIconClassName = "material-symbols-outlined text-on-surface-variant text-[24px]"
}: CompanyLogoProps) {
  const [error, setError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const hasValidSrc = src && src.trim() !== '' && !error

  useEffect(() => {
    // Reset error state if src changes
    setError(false)
  }, [src])

  useEffect(() => {
    // If the image is complete upon mount but naturalWidth is 0, it means it's broken
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth === 0) {
      setError(true)
    }
  }, [src])

  return (
    <div className={containerClassName}>
      {hasValidSrc ? (
        <img
          ref={imgRef}
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
})
