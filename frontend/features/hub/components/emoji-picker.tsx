'use client'

import { useEffect, useRef, useState } from 'react'

interface EmojiCategory {
  label: string
  icon: string
  emoji: string[]
}

const CATEGORIES: EmojiCategory[] = [
  {
    label: 'Smileys',
    icon: 'sentiment_satisfied',
    emoji: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '🥺', '😢', '😭', '😤', '😡', '🤬', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤫', '🤭'],
  },
  {
    label: 'Gestures',
    icon: 'front_hand',
    emoji: ['👍', '👎', '👌', '🤞', '✌️', '🤟', '🤘', '👏', '🙌', '👐', '🙏', '💪', '🫡', '✍️', '👋', '🤝', '👊', '✊', '🤙', '👉', '👈', '👆', '👇', '☝️'],
  },
  {
    label: 'Hearts',
    icon: 'favorite',
    emoji: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💯'],
  },
  {
    label: 'Celebration',
    icon: 'celebration',
    emoji: ['🎉', '🎊', '🎂', '🎁', '🏆', '🥇', '🥈', '🥉', '🏅', '🎯', '🔥', '✨', '⭐', '🌟', '💫', '🎓', '📣', '📢'],
  },
  {
    label: 'Objects',
    icon: 'work',
    emoji: ['💻', '📱', '⌨️', '🖥️', '📚', '📝', '📌', '📎', '✅', '❌', '❗', '❓', '💡', '🔗', '📅', '⏰', '🚀', '🎯'],
  },
  {
    label: 'Nature & Food',
    icon: 'eco',
    emoji: ['☀️', '🌙', '⭐', '☕', '🍕', '🍔', '🍎', '🎮', '⚽', '🏀', '🐱', '🐶', '🐼', '🦄', '🌈', '🍀'],
  },
]

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
        aria-label="Add emoji"
        title="Add emoji"
        type="button"
      >
        <span className="material-symbols-outlined text-[22px]">mood</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 left-0 w-72 bg-surface border border-outline-variant rounded-2xl shadow-lg overflow-hidden z-20 flex flex-col"
          role="dialog"
          aria-label="Emoji picker"
        >
          <div className="grid grid-cols-6 gap-1 p-2 max-h-52 overflow-y-auto">
            {CATEGORIES[activeCategory].emoji.map((e) => (
              <button
                key={e}
                onClick={() => {
                  onSelect(e)
                  setOpen(false)
                }}
                className="w-10 h-10 flex items-center justify-center text-xl rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer"
                type="button"
                aria-label={`Insert ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-outline-variant px-1 py-1 bg-surface-container-lowest">
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                onClick={() => setActiveCategory(i)}
                className={`flex-1 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  i === activeCategory ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
                title={cat.label}
                type="button"
                aria-label={cat.label}
                aria-pressed={i === activeCategory}
              >
                <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
