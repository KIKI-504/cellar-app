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
