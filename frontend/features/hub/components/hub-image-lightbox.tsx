'use client'

import React, { useEffect } from 'react'
import Image from 'next/image'

interface HubImageLightboxProps {
  url: string
  onClose: () => void
}

export function HubImageLightbox({ url, onClose }: HubImageLightboxProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-10">
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <button
        onClick={onClose}
        className="absolute right-4 top-4 md:right-6 md:top-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10 cursor-pointer"
        aria-label="Close image"
      >
        <span className="material-symbols-outlined text-[22px]">close</span>
      </button>
      <div className="relative w-full h-full max-w-4xl max-h-[85vh] flex items-center justify-center">
        <Image
          src={url}
          alt="Shared image, full size"
          fill
          className="object-contain animate-in zoom-in-95 fade-in duration-200"
          sizes="100vw"
          unoptimized
        />
      </div>
      <a
        href={url}
        download
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-full px-4 py-2 transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-[18px]">download</span>
        Save image
      </a>
    </div>
  )
}
