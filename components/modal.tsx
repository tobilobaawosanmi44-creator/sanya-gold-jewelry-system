'use client';
import { useEffect } from 'react';

export function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl p-5 md:p-6 w-full max-w-xl shadow-2xl max-h-[92vh] overflow-y-auto text-left">
        <div className="flex justify-between items-start mb-5 gap-4">
          <div>
            <h2 className="font-bold text-lg">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Close" className="text-gray-400 hover:text-black text-xl leading-none" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
