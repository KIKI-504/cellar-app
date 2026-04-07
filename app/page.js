'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })

    if (!res.ok) {
      setError('Incorrect PIN')
      setPin('')
      setLoading(false)
      return
    }

    const { role } = await res.json()

    sessionStorage.setItem('role', role)

    if (role === 'admin') router.push('/admin')
    else if (role === 'buyer') router.push('/buyer')
    else if (role === 'local') router.push('/local')

    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '320px', padding: '0 24px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', fontWeight: 300, letterSpacing: '0.15em', color: '#d4ad45', marginBottom: '8px' }}>
          Cellar
        </div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.2em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '40px' }}>
          Enter PIN to continue
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="••••"
            autoFocus
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              background: 'var(--white)',
              padding: '14px',
              fontFamily: 'DM Mono, monospace',
              fontSize: '20px',
              textAlign: 'center',
              letterSpacing: '0.3em',
              outline: 'none',
              marginBottom: '12px',
              boxSizing: 'border-box',
            }}
          />
          {error && (
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: '#c0392b', marginBottom: '12px', letterSpacing: '0.05em' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={!pin || loading}
            style={{
              width: '100%',
              background: pin ? 'var(--ink)' : '#ccc',
              color: 'var(--white)',
              border: 'none',
              padding: '13px',
              fontFamily: 'DM Mono, monospace',
              fontSize: '11px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              cursor: pin ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Checking…' : 'Enter →'}
          </button>
        </form>
      </div>
    </div>
  )
}
