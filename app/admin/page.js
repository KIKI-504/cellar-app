'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [pin, setPin] = useState('')
  const [name, setName] = useState('')
  const [showName, setShowName] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const ADMIN_PIN = '2025'
  const BUYER_PIN = '1234'

  function handleSubmit() {
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem('role', 'admin')
      sessionStorage.setItem('user', 'Admin')
      router.push('/admin')
    } else if (pin === BUYER_PIN) {
      if (!showName) {
        setShowName(true)
        setError('')
        return
      }
      if (!name.trim()) {
        setError('Please enter your name.')
        return
      }
      sessionStorage.setItem('role', 'buyer')
      sessionStorage.setItem('user', name.trim())
      router.push('/buyer')
    } else {
      setError('Incorrect PIN. Please try again.')
      setPin('')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--ink)',
      backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(107,30,46,0.3) 0%, transparent 60%)',
    }}>
      <div style={{
        background: 'var(--white)',
        border: '1px solid var(--border)',
        padding: '48px',
        width: '380px',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(26,20,16,0.14)',
      }}>
        <div style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: '42px',
          fontWeight: 300,
          letterSpacing: '0.08em',
          color: 'var(--wine)',
          marginBottom: '6px',
        }}>Cellar</div>

        <div style={{
          fontSize: '10px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: '36px',
        }}>Wine Portfolio Management</div>

        <label style={{
          display: 'block',
          fontSize: '10px',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: '8px',
          textAlign: 'left',
        }}>Access PIN</label>

        <input
          type="password"
          value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="••••••"
          maxLength={10}
          style={{
            width: '100%',
            border: '1px solid var(--border)',
            background: 'var(--cream)',
            padding: '12px 14px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '13px',
            color: 'var(--ink)',
            marginBottom: '16px',
            outline: 'none',
          }}
        />

        {showName && (
          <>
            <label style={{
              display: 'block',
              fontSize: '10px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginBottom: '8px',
              textAlign: 'left',
            }}>Your Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. Jeri"
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                background: 'var(--cream)',
                padding: '12px 14px',
                fontFamily: 'DM Mono, monospace',
                fontSize: '13px',
                color: 'var(--ink)',
                marginBottom: '16px',
                outline: 'none',
              }}
            />
          </>
        )}

        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            background: 'var(--wine)',
            color: 'var(--white)',
            border: 'none',
            padding: '13px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            marginTop: '4px',
          }}
        >Enter</button>

        {error && (
          <div style={{ color: 'var(--wine)', fontSize: '11px', marginTop: '12px' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
