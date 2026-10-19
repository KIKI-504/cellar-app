// Returns the signed-in role. sessionStorage is per-tab and gets wiped when
// Safari closes the tab, but the httpOnly cookie lasts 7 days, so fall back to
// asking the server when sessionStorage is empty. Prevents the '/' <-> '/studio'
// redirect loop.
export async function getRole() {
  try {
    const cached = sessionStorage.getItem('role')
    if (cached) return cached
    const res = await fetch('/api/auth', { cache: 'no-store' })
    const { role } = await res.json()
    if (role) sessionStorage.setItem('role', role)
    return role || null
  } catch { return null }
}
