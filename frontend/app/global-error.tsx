'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Fatal global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', height: '100vh', width: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: '1rem', textAlign: 'center' }}>
          <h2 style={{ marginTop: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
            A critical error occurred.
          </h2>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
            The application crashed and could not recover. Our team has been notified.
          </p>
          <button
            onClick={() => reset()}
            style={{ marginTop: '2rem', borderRadius: '0.375rem', backgroundColor: '#2563eb', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: '500', color: '#ffffff', border: 'none', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
