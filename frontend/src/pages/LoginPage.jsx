import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Shield, Lock, User, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../store/useAppStore'
import { Button, Input } from '../components/ui/index'

const FORCE_RADIUS = 320
const NODE_COUNT = Math.round(85 * 2.5)
const LINK_DISTANCE = 128
const STATUS_PILLS = [
  { label: 'Threat Mesh', value: 'ARMED' },
  { label: 'Pulse Sync', value: 'LIVE' },
  { label: 'Node Density', value: '2.5X' },
]

// ─── Neural Network Canvas (mouse-reactive) ───────────────────────────────────
const NeuralCanvas = ({ mouse }) => {
  const ref = useRef(null)
  const mRef = useRef(mouse)
  useEffect(() => { mRef.current = mouse }, [mouse])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let raf, nodes = []

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }

    class Node {
      constructor() { this.reset() }
      reset() {
        this.x = Math.random() * canvas.width;  this.y = Math.random() * canvas.height
        this.vx = (Math.random() - 0.5) * 0.35; this.vy = (Math.random() - 0.5) * 0.35
        this.r = Math.random() * 2.8 + 0.8;     this.phase = Math.random() * Math.PI * 2
      }
      tick(t) {
        const { x: mx, y: my } = mRef.current
        const dx = mx - this.x, dy = my - this.y
        const d = Math.hypot(dx, dy)
        if (d < FORCE_RADIUS && d > 0) {
          const pull = (1 - d / FORCE_RADIUS) * 0.028
          this.vx += (dx / d) * pull
          this.vy += (dy / d) * pull
        }
        const spd = Math.hypot(this.vx, this.vy)
        if (spd > 1.1) { this.vx *= 0.94; this.vy *= 0.94 }
        this.x += this.vx; this.y += this.vy
        if (this.x < 0 || this.x > canvas.width)  this.vx *= -1
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1
        const a = 0.3 + 0.25 * Math.sin(t * 0.0018 + this.phase)
        ctx.fillStyle = `rgba(255,30,30,${a})`
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill()
      }
    }

    const init = () => { nodes = Array.from({ length: NODE_COUNT }, () => new Node()) }

    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const { x: mx, y: my } = mRef.current

      if (mx > -900 && my > -900) {
        const field = ctx.createRadialGradient(mx, my, 0, mx, my, FORCE_RADIUS)
        field.addColorStop(0, 'rgba(34,211,238,0.14)')
        field.addColorStop(0.48, 'rgba(34,211,238,0.05)')
        field.addColorStop(1, 'rgba(34,211,238,0)')
        ctx.fillStyle = field
        ctx.beginPath()
        ctx.arc(mx, my, FORCE_RADIUS, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = 'rgba(34,211,238,0.18)'
        ctx.lineWidth = 0.7
        ctx.beginPath()
        ctx.arc(mx, my, FORCE_RADIUS * 0.72, 0, Math.PI * 2)
        ctx.stroke()
      }

      for (let i = 0; i < nodes.length; i++) {
        nodes[i].tick(t)
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
          if (d < LINK_DISTANCE) {
            ctx.strokeStyle = `rgba(255,30,30,${0.085 * (1 - d / LINK_DISTANCE)})`
            ctx.lineWidth = 0.4
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }

    window.addEventListener('resize', resize)
    resize(); init(); raf = requestAnimationFrame(draw)
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf) }
  }, [])

  return <canvas ref={ref} className="fixed inset-0 pointer-events-none z-[1]" style={{ opacity: 0.55 }} />
}

// ─── T-800 Shield ─────────────────────────────────────────────────────────────
const T800Shield = ({ active }) => (
  <div className="relative flex items-center justify-center w-20 h-20">
    <div className="absolute inset-0 rounded-full border border-cyan-500/15 animate-spin" style={{ animationDuration: '14s' }} />
    <div className="absolute inset-1.5 rounded-full border border-cyan-400/08 animate-spin" style={{ animationDuration: '9s', animationDirection: 'reverse' }} />
    <div className="absolute inset-3 rounded-full border border-cyan-300/05 animate-spin" style={{ animationDuration: '6s' }} />
    <div className="relative z-10 p-3.5 rounded-full"
      style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, rgba(0,0,0,0.8) 100%)', border: '1px solid rgba(34,211,238,0.2)', boxShadow: '0 0 24px rgba(34,211,238,0.1), inset 0 0 16px rgba(0,0,0,0.9)' }}>
      <Shield size={28} className="text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.7))' }} />
    </div>
    {active && <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping" style={{ animationDuration: '1.2s' }} />}
  </div>
)

// ─── Glitch Title ─────────────────────────────────────────────────────────────
const GlitchTitle = () => {
  const [g, setG] = useState(false)
  useEffect(() => {
    const fire = () => { setG(true); setTimeout(() => setG(false), 180) }
    const id = setInterval(fire, 3500 + Math.random() * 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative select-none leading-none">
      <h1 className="text-5xl font-black font-mono tracking-[0.28em] uppercase text-white"
        style={{ textShadow: g ? '4px 0 rgba(255,0,60,0.9),-4px 0 rgba(0,255,255,0.9)' : '0 0 28px rgba(34,211,238,0.25)', transform: g ? `translateX(${(Math.random()-0.5)*5}px)` : 'none', filter: g ? 'brightness(1.6)' : 'none' }}>
        SKY<span className="text-cyan-400" style={{ filter: 'drop-shadow(0 0 10px rgba(34,211,238,0.6))' }}>NET</span>
      </h1>
      {g && (
        <h1 className="absolute inset-0 text-5xl font-black font-mono tracking-[0.28em] uppercase pointer-events-none"
          style={{ color: 'rgba(255,0,60,0.45)', transform: 'translateX(-4px) translateY(2px)', mixBlendMode: 'screen' }}>
          SKYNET
        </h1>
      )}
    </div>
  )
}

// ─── Terminal Boot Sequence ────────────────────────────────────────────────────
const MSGS = ['> NEURAL_CORE.......... [OK]', '> THREAT_MATRIX........ [OK]', '> AUTH_PROTOCOL........ [READY]']
const BootSequence = () => {
  const [lines, setLines] = useState([])
  useEffect(() => {
    MSGS.forEach((m, i) => setTimeout(() => setLines(p => [...p, m]), i * 420 + 400))
  }, [])
  return (
    <div className="h-11 space-y-0.5 overflow-hidden">
      {lines.map((l, i) => <p key={i} className="text-[9px] font-mono tracking-widest" style={{ color: 'rgba(34,211,238,0.35)' }}>{l}</p>)}
    </div>
  )
}

// ─── Login Page ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [form, setForm]     = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [mouse, setMouse]   = useState({ x: -999, y: -999 })
  const [show, setShow]     = useState(false)

  const login    = useAuthStore(s => s.login)
  const navigate = useNavigate()
  const location = useLocation()
  const from     = location.state?.from?.pathname || '/'

  useEffect(() => { const t = setTimeout(() => setShow(true), 80); return () => clearTimeout(t) }, [])

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(form); navigate(from, { replace: true }) }
    catch (err) { setError(err.response?.data?.detail || 'Authentication failure. Access denied.') }
    finally { setLoading(false) }
  }

  return (
    <div onMouseMove={e => setMouse({ x: e.clientX, y: e.clientY })}
      className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden select-none"
      style={{ background: '#030508' }}>

      {/* Base atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle at 15% 20%, rgba(255,40,70,0.16), transparent 34%), radial-gradient(circle at 85% 18%, rgba(34,211,238,0.14), transparent 28%), linear-gradient(180deg, rgba(2,8,15,0.9) 0%, rgba(3,5,8,1) 100%)' }} />

      {/* Grid */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-50"
        style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.05) 1px, transparent 1px)', backgroundSize: '72px 72px', maskImage: 'radial-gradient(circle at center, black 28%, transparent 85%)' }} />

      {/* Neural canvas — above backgrounds, below UI overlays */}
      <NeuralCanvas mouse={mouse} />

      {/* Scanlines */}
      <div className="fixed inset-0 pointer-events-none z-[3]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.09) 2px,rgba(0,0,0,0.09) 4px)' }} />

      {/* Spotlight scanner */}
      <div className="fixed inset-0 pointer-events-none z-[4]"
        style={{ background: `radial-gradient(520px circle at ${mouse.x}px ${mouse.y}px, rgba(34,211,238,0.08) 0%, rgba(34,211,238,0.04) 24%, transparent 72%)`, transition: 'background 0.08s ease' }} />

      {/* Vignette */}
      <div className="fixed inset-0 pointer-events-none z-[4]"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 100%)' }} />

      <div className="absolute left-1/2 top-1/2 z-[5] h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, rgba(255,45,85,0.05) 42%, transparent 72%)' }} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md"
        style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(22px)', transition: 'opacity 0.65s ease, transform 0.65s ease' }}>

        {/* Header */}
        <div className="flex flex-col items-center mb-7">
          <T800Shield active={loading} />
          <div className="mt-4 flex flex-col items-center gap-1.5">
            <GlitchTitle />
            <div className="flex items-center gap-3 mt-1">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-cyan-500/30" />
              <p className="text-[8px] font-mono tracking-[0.45em] uppercase" style={{ color: 'rgba(34,211,238,0.25)' }}>Neural Security Grid</p>
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-cyan-500/30" />
            </div>
          </div>
          <p className="mt-3 max-w-xs text-center text-[10px] font-mono tracking-[0.22em] uppercase leading-5"
            style={{ color: 'rgba(148,163,184,0.62)' }}>
            Adaptive perimeter control with live operator verification.
          </p>
          <div className="mt-3 w-full text-left px-1"><BootSequence /></div>
        </div>

        {/* Card */}
        <div className="relative rounded-[22px] overflow-hidden p-7 sm:p-8"
          style={{ background: 'linear-gradient(180deg, rgba(6,12,23,0.92) 0%, rgba(2,6,14,0.9) 100%)', border: '1px solid rgba(34,211,238,0.14)', backdropFilter: 'blur(24px)', boxShadow: '0 0 60px rgba(34,211,238,0.05), 0 36px 90px rgba(0,0,0,0.72)' }}>

          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.08) 0%, transparent 32%, transparent 66%, rgba(255,45,85,0.08) 100%)' }} />

          <div className="relative z-10 mb-6 grid grid-cols-3 gap-2">
            {STATUS_PILLS.map((item) => (
              <div key={item.label} className="rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(8,15,28,0.82)', border: '1px solid rgba(34,211,238,0.12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
                <p className="text-[7px] font-mono tracking-[0.28em] uppercase" style={{ color: 'rgba(148,163,184,0.6)' }}>{item.label}</p>
                <p className="mt-1 text-[10px] font-mono tracking-[0.3em] uppercase" style={{ color: 'rgba(224,242,254,0.86)' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Corner brackets */}
          {[{t:0,l:0},{t:0,r:0},{b:0,l:0},{b:0,r:0}].map((s,i) => (
            <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="none" className="absolute pointer-events-none"
              style={{ top: s.t, bottom: s.b, left: s.l, right: s.r, transform: `scale(${s.r!=null?-1:1},${s.b!=null?-1:1})` }}>
              <path d="M0,14 L0,0 L14,0" stroke="rgba(34,211,238,0.4)" strokeWidth="1.2" />
            </svg>
          ))}

          {/* Sweep line */}
          <div className="absolute inset-x-0 h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(34,211,238,0.18),transparent)', animation: 'sweep 3.5s linear infinite' }} />

          <form onSubmit={submit} className="relative z-10 space-y-5 select-text">
            {error && (
              <div className="flex items-start gap-2 px-3 py-2 rounded text-[11px] font-mono"
                style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(252,165,165,0.9)' }}>
                <AlertCircle size={12} className="mt-0.5 shrink-0" />{error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[8px] font-mono tracking-[0.35em] uppercase" style={{ color: 'rgba(34,211,238,0.35)' }}>Operator ID</label>
              <div className="relative group">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-300" style={{ color: 'rgba(107,114,128,1)' }} />
                <Input placeholder="ENTER_IDENTITY" value={form.username}
                  className="pl-9 h-12 rounded-xl font-mono tracking-widest text-sm placeholder:opacity-30"
                  style={{ background: 'rgba(0,0,0,0.54)', borderColor: 'rgba(34,211,238,0.12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
                  onChange={e => setForm({ ...form, username: e.target.value })} required />
              </div>
              <p className="text-[8px] font-mono tracking-[0.2em] uppercase" style={{ color: 'rgba(100,116,139,0.66)' }}>
                Email or username accepted.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[8px] font-mono tracking-[0.35em] uppercase" style={{ color: 'rgba(34,211,238,0.35)' }}>Security Key</label>
              <div className="relative group">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-300" style={{ color: 'rgba(107,114,128,1)' }} />
                <Input type="password" placeholder="••••••••••••" value={form.password}
                  className="pl-9 h-12 rounded-xl font-mono tracking-widest text-sm placeholder:opacity-40"
                  style={{ background: 'rgba(0,0,0,0.54)', borderColor: 'rgba(34,211,238,0.12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
                  onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div className="flex items-center justify-between gap-3 text-[8px] font-mono tracking-[0.18em] uppercase" style={{ color: 'rgba(100,116,139,0.66)' }}>
                <span>Encrypted transport active</span>
                <span>Field radius {FORCE_RADIUS}px</span>
              </div>
            </div>

            <Button type="submit" variant="primary" loading={loading}
              className="w-full h-12 rounded-xl text-[10px] font-mono font-bold tracking-[0.4em] uppercase mt-1"
              style={{ background: 'linear-gradient(90deg, rgba(22,78,99,0.9) 0%, rgba(17,94,89,0.92) 52%, rgba(8,145,178,0.92) 100%)', border: '1px solid rgba(34,211,238,0.26)', color: 'rgba(236,254,255,0.96)', boxShadow: loading ? 'none' : '0 0 24px rgba(34,211,238,0.18), inset 0 1px 0 rgba(255,255,255,0.12)', transition: 'all 0.3s' }}>
              {loading ? '[ AUTHENTICATING... ]' : '[ INITIALIZE SESSION ]'}
            </Button>
          </form>

          <div className="relative z-10 mt-5 flex justify-between items-center gap-3">
            <button type="button" onClick={() => navigate('/forgot-password')}
              className="text-[8px] font-mono tracking-widest uppercase transition-colors duration-300 hover:text-cyan-500"
              style={{ color: 'rgba(75,85,99,1)' }}>
              &gt; Lost Access?
            </button>
            <div className="flex items-center gap-1.5" style={{ color: 'rgba(55,65,81,1)' }}>
              <div className="w-1 h-1 rounded-full bg-cyan-500/40 animate-pulse" />
              <span className="text-[8px] font-mono tracking-widest uppercase">Encrypted Session</span>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[7px] font-mono tracking-[0.5em] uppercase" style={{ color: 'rgba(31,41,55,1)' }}>
          SkyNet Neural Grid · Auth Protocol Active
        </p>
      </div>

      <style>{`
        @keyframes sweep {
          0%   { top: -1px; opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  )
}
