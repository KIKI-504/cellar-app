'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ADMIN_PIN = '1234'
const BUYER_PIN = '5678'

export default function HomePage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit() {
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem('role', 'admin')
      router.push('/admin')
    } else if (pin === BUYER_PIN) {
      sessionStorage.setItem('role', 'buyer')
      router.push('/buyer')
    } else {
      setError(true)
      setPin('')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '48px', fontWeight: 300, color: '#d4ad45', letterSpacing: '0.15em', marginBottom: '8px' }}>Cellar</div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(253,250,245,0.3)', marginBottom: '48px' }}>Wine Inventory</div>
        <input
          type="password"
          value={pin}
          onChange={e => { setPin(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Enter PIN"
          style={{
            width: '100%',
            background: 'rgba(253,250,245,0.07)',
            border: error ? '1px solid #c0392b' : '1px solid rgba(253,250,245,0.15)',
            color: 'var(--white)',
            padding: '16px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '20px',
            outline: 'none',
            textAlign: 'center',
            letterSpacing: '0.4em',
            boxSizing: 'border-box',
            marginBottom: '12px'
          }}
        />
        {error && (
          <div style={{ fontSize: '11px', color: '#c0392b', fontFamily: 'DM Mono, monospace', marginBottom: '12px', letterSpacing: '0.1em' }}>
            Incorrect PIN
          </div>
        )}
        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            background: '#d4ad45',
            color: 'var(--ink)',
            border: 'none',
            padding: '16px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}
        >
          Enter
        </button>
      </div>
    </div>
  )
}
