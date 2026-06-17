'use client'

import React, { useState, useEffect, useRef } from 'react'

interface CompanyLogoProps {
  src?: string | null
  alt?: string
  name?: string
  containerClassName?: string
  imageClassName?: string
  fallbackIconClassName?: string
}

function getMappedLogo(name?: string): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('amazon')) return 'https://www.google.com/s2/favicons?domain=amazon.com&sz=128';
  if (n.includes('google')) return 'https://www.google.com/s2/favicons?domain=google.com&sz=128';
  if (n.includes('microsoft')) return 'https://www.google.com/s2/favicons?domain=microsoft.com&sz=128';
  if (n.includes('apple')) return 'https://www.google.com/s2/favicons?domain=apple.com&sz=128';
  if (n.includes('meta')) return 'https://www.google.com/s2/favicons?domain=meta.com&sz=128';
  if (n.includes('github')) return 'https://www.google.com/s2/favicons?domain=github.com&sz=128';
  if (n.includes('atlassian')) return 'https://www.google.com/s2/favicons?domain=atlassian.com&sz=128';
  if (n.includes('adobe')) return 'https://www.google.com/s2/favicons?domain=adobe.com&sz=128';
  if (n.includes('oracle')) return 'https://www.google.com/s2/favicons?domain=oracle.com&sz=128';
  if (n.includes('salesforce')) return 'https://www.google.com/s2/favicons?domain=salesforce.com&sz=128';
  if (n.includes('ibm')) return 'https://www.google.com/s2/favicons?domain=ibm.com&sz=128';
  return null;
}

function getInitials(name: string) {
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'C';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const CompanyLogo = React.memo(function CompanyLogo({ 
  src, 
  alt = 'Company Logo',
  name,
  containerClassName = "w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center border border-outline-variant/60 shadow-sm overflow-hidden shrink-0",
  imageClassName = "w-8 h-8 object-contain",
  fallbackIconClassName = "material-symbols-outlined text-on-surface-variant text-[24px]"
}: CompanyLogoProps) {
  const companyName = name || alt.replace(/ logo$/i, '').trim();
  const mappedLogo = getMappedLogo(companyName);
  
  const [imgState, setImgState] = useState<'mapped' | 'src' | 'initials'>(
    mappedLogo ? 'mapped' : (src ? 'src' : 'initials')
  )

  const imgRef = useRef<HTMLImageElement>(null)

  const currentSrc = imgState === 'mapped' ? mappedLogo : (imgState === 'src' ? src : null);

  useEffect(() => {
    setImgState(mappedLogo ? 'mapped' : (src ? 'src' : 'initials'))
  }, [src, mappedLogo])

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth === 0) {
      handleError()
    }
  }, [currentSrc])

  const handleError = () => {
    if (imgState === 'mapped') {
      setImgState(src ? 'src' : 'initials')
    } else if (imgState === 'src') {
      setImgState('initials')
    }
  }

  // Derive a fallback container style from imageClassName to roughly match dimensions
  const isLarge = imageClassName.includes('w-12') || imageClassName.includes('w-10');
  const fallbackClass = `${imageClassName.replace('object-contain', '')} flex items-center justify-center bg-primary/10 text-primary font-bold rounded-full ${isLarge ? 'text-lg' : 'text-sm'}`;

  return (
    <div className={containerClassName}>
      {imgState !== 'initials' && currentSrc ? (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          className={imageClassName}
          onError={handleError}
          loading="lazy"
        />
      ) : (
        <div className={fallbackClass}>
          {getInitials(companyName || 'Company')}
        </div>
      )}
    </div>
  )
})
