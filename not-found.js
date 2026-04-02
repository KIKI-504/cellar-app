'use client'
export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--cream)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'48px', fontWeight:300, color:'var(--wine)', marginBottom:'8px' }}>404</div>
        <div style={{ fontFamily:'DM Mono,monospace', fontSize:'12px', color:'var(--muted)', letterSpacing:'0.1em' }}>PAGE NOT FOUND</div>
      </div>
    </div>
  )
}
