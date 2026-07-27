import { useState, useEffect, useRef, type CSSProperties } from 'react'

/* ═══════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════ */
type Screen = 'onboarding' | 'home' | 'calendar' | 'journal' | 'sos' | 'wellness' | 'settings' | 'chat'
type Mood   = 'radiant' | 'calm' | 'anxious' | 'tired' | 'sad' | 'energized'
type Phase  = 'menstrual' | 'follicular' | 'ovulation' | 'luteal'

/* ═══════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════ */
const C = {
  blush:      '#FF6B8A',
  blushL:     '#FFB3C6',
  rose:       '#F7C5CC',
  mauve:      '#D4A5B5',
  lavender:   '#E8D5F5',
  mint:       '#D4F0E0',
  cream:      '#FFF8F0',
  creamy:     '#FFF0E8',
  dark:       '#2D1B26',
  mid:        '#6B4D5A',
  soft:       '#A07888',
  lighter:    '#C9A8B8',
  red:        '#EF4444',
  redD:       '#DC2626',
} as const

const PHASE: Record<Phase, { bg: string; fg: string; accent: string; label: string; emoji: string; desc: string }> = {
  menstrual:  { bg: '#FFE4EC', fg: '#B83058', accent: '#FF6B8A', label: 'Menstrual',  emoji: '🩸', desc: 'Rest & restore. Honour your body.' },
  follicular: { bg: '#FFF4E3', fg: '#A0621A', accent: '#F5A623', label: 'Follicular', emoji: '🌱', desc: 'Rising energy. Fresh beginnings.' },
  ovulation:  { bg: '#E5F9F0', fg: '#1A6B45', accent: '#3CC87A', label: 'Ovulation',  emoji: '🌟', desc: 'Peak vitality. Magnetic energy.' },
  luteal:     { bg: '#EFE8FA', fg: '#5A35A0', accent: '#9B6BD4', label: 'Luteal',     emoji: '🌙', desc: 'Wind down. Nurture yourself.' },
}

const MOODS: { id: Mood; emoji: string; label: string; color: string; bg: string }[] = [
  { id: 'radiant',   emoji: '✨', label: 'Radiant',   color: '#FF6B8A', bg: '#FFE8EF' },
  { id: 'calm',      emoji: '🌸', label: 'Calm',      color: '#D4A5B5', bg: '#FAF0F4' },
  { id: 'energized', emoji: '⚡', label: 'Energized', color: '#F5A623', bg: '#FFF4E3' },
  { id: 'anxious',   emoji: '🌊', label: 'Anxious',   color: '#6BA8E8', bg: '#E8F2FF' },
  { id: 'tired',     emoji: '🌙', label: 'Tired',     color: '#9B6BD4', bg: '#F0E8FA' },
  { id: 'sad',       emoji: '🌧️', label: 'Sad',       color: '#7B9EC8', bg: '#EDF3FA' },
]

const SYMPTOMS = ['Cramps', 'Bloating', 'Headache', 'Fatigue', 'Acne', 'Tender breasts', 'Mood swings', 'Back pain', 'Nausea', 'Insomnia', 'Hot flashes', 'Brain fog']

/* ═══════════════════════════════════════════════════════
   ATOMS
═══════════════════════════════════════════════════════ */
function sf(n: number) { return `${n}px` }

const row  = (gap = 0, align: CSSProperties['alignItems'] = 'center'): CSSProperties =>
  ({ display: 'flex', alignItems: align, gap: sf(gap) })
const col  = (gap = 0, align: CSSProperties['alignItems'] = 'stretch'): CSSProperties =>
  ({ display: 'flex', flexDirection: 'column', alignItems: align, gap: sf(gap) })
const abs  = (inset = 0): CSSProperties =>
  ({ position: 'absolute', inset: sf(inset) })
const circle = (size: number): CSSProperties =>
  ({ width: sf(size), height: sf(size), borderRadius: '50%', flexShrink: 0 })

/* ─── Label ─── */
function Label({ children, color = C.soft }: { children: React.ReactNode; color?: string }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', color, margin: 0, fontFamily: 'Inter, sans-serif' }}>
      {children}
    </p>
  )
}

/* ─── Avatar ─── */
function Avatar({ size = 44 }: { size?: number }) {
  return (
    <div style={{
      ...circle(size),
      background: `linear-gradient(135deg, ${C.blush} 0%, ${C.lavender} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, color: '#fff', fontWeight: 800,
      boxShadow: '0 4px 12px rgba(255,107,138,0.35)',
      border: '2px solid rgba(255,255,255,0.8)',
    }}>
      S
    </div>
  )
}

/* ─── Toggle ─── */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="btn-press"
      style={{
        width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
        background: on ? `linear-gradient(135deg, ${C.blush}, #D4507A)` : 'rgba(160,120,136,0.20)',
        position: 'relative', transition: 'background 0.28s ease', flexShrink: 0,
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: on ? 25 : 3,
        transition: 'left 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
      }} />
    </button>
  )
}

/* ─── Chip / Pill ─── */
function Chip({
  label, active, color = C.blush, bg, onClick,
}: { label: string; active?: boolean; color?: string; bg?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="chip"
      style={{
        background: active ? color : (bg || 'rgba(255,255,255,0.75)'),
        borderColor: active ? color : `${color}44`,
        color: active ? '#fff' : color,
        transform: active ? 'scale(1.05)' : 'scale(1)',
        boxShadow: active ? `0 4px 12px ${color}44` : 'none',
      }}
    >
      {label}
    </button>
  )
}

/* ─── Glass Card ─── */
function Card({
  children, style, className = '', onClick, animClass = '',
}: {
  children: React.ReactNode
  style?: CSSProperties
  className?: string
  onClick?: () => void
  animClass?: string
}) {
  return (
    <div
      className={`glass shadow-card ${className} ${animClass} ${onClick ? 'bento-card' : ''}`}
      onClick={onClick}
      style={{ borderRadius: 22, padding: 18, ...style }}
    >
      {children}
    </div>
  )
}

/* ─── Primary Button ─── */
function PrimaryBtn({
  label, onClick, disabled, icon, style,
}: { label: string; onClick?: () => void; disabled?: boolean; icon?: string; style?: CSSProperties }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-press"
      style={{
        minHeight: 52, width: '100%', borderRadius: 16, border: 'none',
        background: disabled
          ? 'rgba(160,120,136,0.25)'
          : `linear-gradient(135deg, ${C.blush} 0%, #D4507A 100%)`,
        color: disabled ? C.soft : '#fff',
        fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: disabled ? 'none' : '0 8px 24px rgba(255,107,138,0.38)',
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '0.01em',
        ...style,
      }}
    >
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      {label}
    </button>
  )
}

/* ─── Ghost Button ─── */
function GhostBtn({
  label, onClick, icon,
}: { label: string; onClick?: () => void; icon?: string }) {
  return (
    <button
      onClick={onClick}
      className="btn-press"
      style={{
        minHeight: 52, width: '100%', borderRadius: 16,
        border: `1.5px solid ${C.rose}`,
        background: 'rgba(255,255,255,0.6)',
        color: C.blush, fontSize: 15, fontWeight: 700,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      {label}
    </button>
  )
}

/* ─── Dot Progress ─── */
function DotProgress({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ ...row(6), justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 8, borderRadius: 4,
          width: i === current ? 24 : 8,
          background: i === current ? C.blush : `${C.rose}88`,
          transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      ))}
    </div>
  )
}

/* ─── Input Field ─── */
function Input({
  label, placeholder, value, onChange, type = 'text',
}: {
  label?: string; placeholder?: string; value?: string
  onChange?: (v: string) => void; type?: string
}) {
  return (
    <div style={col(6)}>
      {label && <Label>{label}</Label>}
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="sc-input"
        style={{
          width: '100%', height: 50, borderRadius: 14,
          border: `1.5px solid ${C.rose}`,
          background: 'rgba(255,255,255,0.75)',
          padding: '0 16px', fontSize: 15, color: C.dark,
          fontFamily: 'Inter, sans-serif',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

/* ─── Section Header ─── */
function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ ...row(0), justifyContent: 'space-between', marginBottom: 12 }}>
      <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: 18, fontWeight: 700, color: C.dark, margin: 0 }}>
        {title}
      </h3>
      {action && (
        <button onClick={onAction} style={{
          minHeight: 44, padding: '0 12px', background: 'none', border: 'none',
          color: C.blush, fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          {action} →
        </button>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   SCREEN: ONBOARDING
═══════════════════════════════════════════════════════ */
const OB_STEPS = [
  {
    bg: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,107,138,0.30) 0%, transparent 65%), radial-gradient(ellipse 60% 50% at 90% 80%, rgba(232,213,245,0.35) 0%, transparent 60%), #FFF8F0`,
    icon: '🌸', iconBg: `linear-gradient(135deg, ${C.blush}, ${C.lavender})`,
    title: 'Welcome to SheCare',
    subtitle: 'Your intimate wellness companion — thoughtfully designed for every phase of you.',
    type: 'welcome',
  },
  {
    bg: `radial-gradient(ellipse 70% 50% at 30% 10%, rgba(247,197,204,0.40) 0%, transparent 60%), #FFF8F0`,
    icon: '👤', iconBg: `linear-gradient(135deg, #FFB3C6, #D4A5B5)`,
    title: 'Tell us about you',
    subtitle: 'A few details help us personalise everything perfectly.',
    type: 'personal',
  },
  {
    bg: `radial-gradient(ellipse 70% 50% at 70% 15%, rgba(212,240,224,0.45) 0%, transparent 60%), #FFF8F0`,
    icon: '🌿', iconBg: `linear-gradient(135deg, #D4F0E0, #3CC87A)`,
    title: 'Your lifestyle',
    subtitle: 'Stress, sleep and exercise patterns power your AI insights.',
    type: 'lifestyle',
  },
  {
    bg: `radial-gradient(ellipse 70% 55% at 20% 20%, rgba(232,213,245,0.40) 0%, transparent 65%), #FFF8F0`,
    icon: '🗓️', iconBg: `linear-gradient(135deg, ${C.lavender}, #9B6BD4)`,
    title: 'Your cycle',
    subtitle: 'When did your last period start? We\'ll build from here.',
    type: 'cycle',
  },
  {
    bg: `radial-gradient(ellipse 80% 50% at 80% 10%, rgba(255,179,198,0.35) 0%, transparent 60%), #FFF8F0`,
    icon: '📊', iconBg: `linear-gradient(135deg, #FFB3C6, ${C.blush})`,
    title: 'A little history',
    subtitle: 'Past cycles sharpen our predictions. Add what you remember.',
    type: 'history',
  },
  {
    bg: `radial-gradient(ellipse 60% 50% at 50% 20%, rgba(255,107,138,0.25) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 80% 80%, rgba(212,240,224,0.30) 0%, transparent 55%), #FFF8F0`,
    icon: '🎀', iconBg: `linear-gradient(135deg, ${C.blush}, ${C.lavender}, ${C.mint})`,
    title: "You're ready!",
    subtitle: 'SheCare is personalised and waiting. Let\'s take care of you.',
    type: 'complete',
  },
]

function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [age, setAge] = useState('')
  const [cycleLen, setCycleLen] = useState('28')
  const [periodLen, setPeriodLen] = useState('5')
  const [stress, setStress] = useState(2)
  const [exercise, setExercise] = useState(3)
  const [symptoms, setSymptoms] = useState<string[]>([])
  const s = OB_STEPS[step]

  const toggleSym = (x: string) =>
    setSymptoms(p => p.includes(x) ? p.filter(i => i !== x) : [...p, x])

  return (
    <div style={{ minHeight: '100%', background: s.bg, display: 'flex', flexDirection: 'column', transition: 'background 0.7s ease' }}>
      {/* Status bar */}
      <div style={{ height: 48, ...row(0), justifyContent: 'space-between', padding: '0 20px', paddingTop: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>9:41</span>
        <div style={{ ...row(6) }}>
          <span style={{ fontSize: 11 }}>●●●●</span>
          <span style={{ fontSize: 11 }}>WiFi</span>
          <span style={{ fontSize: 11 }}>🔋</span>
        </div>
      </div>

      {/* Top bar */}
      <div style={{ ...row(0), justifyContent: 'space-between', padding: '8px 20px 0' }}>
        {step > 0
          ? <button onClick={() => setStep(s => s - 1)} className="btn-press" style={{
              minWidth: 44, minHeight: 44, borderRadius: 14,
              border: `1.5px solid ${C.rose}`, background: 'rgba(255,255,255,0.75)',
              color: C.blush, fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>‹</button>
          : <div style={{ width: 44 }} />
        }
        {step < 5 && <Label color={C.soft}>STEP {step + 1} OF 6</Label>}
        <div style={{ width: 44 }} />
      </div>

      {/* Dot progress */}
      <div style={{ padding: '16px 20px 0' }}>
        <DotProgress total={6} current={step} />
      </div>

      {/* Icon */}
      <div className="anim-spring" key={step} style={{ textAlign: 'center', padding: '32px 24px 0' }}>
        <div className="anim-float" style={{
          width: 100, height: 100, borderRadius: 30, margin: '0 auto 24px',
          background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 48, boxShadow: '0 16px 48px rgba(255,107,138,0.25), 0 4px 16px rgba(255,107,138,0.18)',
        }}>
          {s.icon}
        </div>
        <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 28, fontWeight: 800, color: C.dark, margin: '0 0 10px', lineHeight: 1.2 }}>
          {s.title}
        </h1>
        <p style={{ color: C.mid, fontSize: 15, lineHeight: 1.65, margin: 0 }}>
          {s.subtitle}
        </p>
      </div>

      {/* Content */}
      <div className="anim-fade" key={`c${step}`} style={{ flex: 1, padding: '28px 20px 0', ...col(14) }}>

        {step === 0 && (
          <>
            {[
              { icon: '🔒', t: 'Encrypted & private', d: 'Your data never leaves your control' },
              { icon: '🤖', t: 'AI-powered predictions', d: 'Learns your unique patterns over time' },
              { icon: '🆘', t: 'Emergency SOS', d: 'One tap alerts your trusted contacts' },
              { icon: '🌿', t: 'Holistic wellness', d: 'Cycle, mood, sleep & nutrition in one place' },
            ].map((f, i) => (
              <div key={i} className={`anim-up anim-d${i + 1}`} style={{
                ...row(14), padding: '14px 16px', borderRadius: 18,
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 4px 16px rgba(212,165,181,0.12)',
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                  background: `rgba(255,107,138,0.10)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>{f.icon}</div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.dark, margin: '0 0 2px' }}>{f.t}</p>
                  <p style={{ fontSize: 12, color: C.soft, margin: 0 }}>{f.d}</p>
                </div>
              </div>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <Input label="YOUR AGE" placeholder="e.g. 26" value={age} onChange={setAge} type="number" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="HEIGHT (cm)" placeholder="165" />
              <Input label="WEIGHT (kg)" placeholder="60" />
            </div>
            <div>
              <Label>CONTRACEPTION</Label>
              <div style={{ ...row(8), flexWrap: 'wrap', marginTop: 10 }}>
                {['None', 'Pill', 'IUD', 'Implant', 'Other'].map(o => (
                  <Chip key={o} label={o} active={o === 'None'} color={C.blush} />
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <Label color={C.soft}>STRESS LEVEL</Label>
              <div style={{ ...row(8), marginTop: 10 }}>
                {[['🧘', 'Low'], ['😌', 'Moderate'], ['😤', 'High'], ['🌋', 'Very High']].map(([e, l], i) => (
                  <button key={i} onClick={() => setStress(i + 1)} className="btn-press" style={{
                    flex: 1, height: 60, borderRadius: 16, border: 'none',
                    background: stress === i + 1 ? `linear-gradient(135deg, ${C.blush}, #D4507A)` : 'rgba(255,255,255,0.72)',
                    color: stress === i + 1 ? '#fff' : C.mid,
                    ...col(4, 'center'), cursor: 'pointer',
                    boxShadow: stress === i + 1 ? '0 4px 14px rgba(255,107,138,0.35)' : '0 2px 8px rgba(212,165,181,0.12)',
                    border: stress === i + 1 ? 'none' : `1.5px solid ${C.rose}`,
                    transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                  }}>
                    <span style={{ fontSize: 22 }}>{e}</span>
                    <span style={{ fontSize: 10, fontWeight: 700 }}>{l}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label color={C.soft}>EXERCISE DAYS / WEEK — {exercise}</Label>
              <input type="range" min={0} max={7} value={exercise} onChange={e => setExercise(+e.target.value)}
                style={{ width: '100%', marginTop: 12, accentColor: C.blush, height: 4 }} />
              <div style={{ ...row(0), justifyContent: 'space-between', marginTop: 6 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} style={{ fontSize: 10, color: i === exercise ? C.blush : C.lighter, fontWeight: i === exercise ? 700 : 400 }}>{i}</span>
                ))}
              </div>
            </div>
            <div>
              <Label color={C.soft}>AVERAGE SLEEP</Label>
              <div style={{ ...row(8), marginTop: 10, flexWrap: 'wrap' }}>
                {['< 5h', '5–6h', '6–7h', '7–8h', '> 8h'].map(o => (
                  <Chip key={o} label={o} active={o === '7–8h'} color={C.blush} />
                ))}
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="CYCLE LENGTH (days)" placeholder="28" value={cycleLen} onChange={setCycleLen} type="number" />
              <Input label="PERIOD LENGTH (days)" placeholder="5" value={periodLen} onChange={setPeriodLen} type="number" />
            </div>
            <Input label="LAST PERIOD START DATE" placeholder="e.g. 14 Jul 2025" />
            <div>
              <Label color={C.soft}>COMMON SYMPTOMS</Label>
              <div style={{ ...row(8), flexWrap: 'wrap', marginTop: 10 }}>
                {SYMPTOMS.map(sym => (
                  <Chip key={sym} label={sym}
                    active={symptoms.includes(sym)} color={C.blush}
                    onClick={() => toggleSym(sym)} />
                ))}
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <div style={col(10)}>
            {[
              { month: 'May 2025', len: 29, flow: 'Medium', pain: 'Mild' },
              { month: 'June 2025', len: 27, flow: 'Light', pain: 'None' },
              { month: 'July 2025', len: 28, flow: 'Heavy', pain: 'Moderate' },
            ].map((c, i) => (
              <div key={i} className={`anim-up anim-d${i + 1}`} style={{
                ...row(0), justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px', borderRadius: 18,
                background: 'rgba(255,255,255,0.72)', border: `1px solid ${C.rose}`,
                boxShadow: '0 4px 16px rgba(212,165,181,0.12)',
              }}>
                <div>
                  <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 16, fontWeight: 700, color: C.dark, margin: '0 0 3px' }}>{c.month}</p>
                  <p style={{ fontSize: 12, color: C.soft, margin: 0 }}>{c.len} days · {c.pain} pain</p>
                </div>
                <div style={{ ...row(6) }}>
                  <Chip label={c.flow} color={C.blush} />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 5 && (
          <div style={col(14, 'center')}>
            <div style={{
              width: 110, height: 110, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.blush} 0%, ${C.lavender} 50%, ${C.mint} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 52, boxShadow: '0 16px 48px rgba(255,107,138,0.35)',
              animation: 'breathe 3s ease-in-out infinite',
            }}>✨</div>
            {[
              ['✓', 'Cycle tracking ready', '#1A6B45', '#E5F9F0'],
              ['✓', 'AI insights activated', C.blush, '#FFE8EF'],
              ['✓', 'Safety features enabled', '#5A35A0', '#EFE8FA'],
              ['✓', 'Wellness journal open', '#A0621A', '#FFF4E3'],
            ].map(([icon, text, fg, bg], i) => (
              <div key={i} className={`anim-up anim-d${i + 1}`} style={{
                ...row(12), width: '100%', padding: '12px 16px', borderRadius: 16,
                background: bg, border: `1px solid ${fg}22`,
              }}>
                <span style={{ fontSize: 16, color: fg, fontWeight: 900 }}>{icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: fg }}>{text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: '24px 20px 32px', ...col(10) }}>
        <PrimaryBtn
          label={step === 5 ? 'Enter SheCare ✨' : step === 0 ? 'Get Started' : 'Continue'}
          onClick={step === 5 ? onDone : () => setStep(s => s + 1)}
          icon={step === 0 ? '🌸' : undefined}
        />
        {step === 0 && (
          <p style={{ textAlign: 'center', color: C.soft, fontSize: 13, margin: 0 }}>
            Already have an account?{' '}
            <span style={{ color: C.blush, fontWeight: 700, cursor: 'pointer' }}>Sign in</span>
          </p>
        )}
        {step > 0 && step < 5 && (
          <button onClick={() => setStep(s => s + 1)} style={{
            background: 'none', border: 'none', color: C.soft, fontSize: 13,
            fontWeight: 600, cursor: 'pointer', minHeight: 44, width: '100%',
          }}>
            Skip for now
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   SCREEN: HOME DASHBOARD
═══════════════════════════════════════════════════════ */
function HomeScreen({ go }: { go: (s: Screen) => void }) {
  const [mood, setMood] = useState<Mood | null>(null)
  const currentPhase: Phase = 'ovulation'
  const ph = PHASE[currentPhase]

  return (
    <div style={{ background: C.cream, minHeight: '100%', paddingBottom: 96 }}>

      {/* Top gradient area */}
      <div style={{
        background: `radial-gradient(ellipse 90% 60% at 50% 0%, rgba(255,107,138,0.22) 0%, transparent 65%), ${C.cream}`,
        padding: '52px 18px 0',
      }}>
        {/* Status bar */}
        <div style={{ ...row(0), justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <p style={{ fontSize: 12, color: C.soft, margin: '0 0 1px', fontWeight: 500 }}>Sunday, 27 July</p>
            <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 27, fontWeight: 800, color: C.dark, margin: 0 }}>
              Good morning, Sofia ✨
            </h1>
          </div>
          <div style={{ ...row(10) }}>
            <button onClick={() => go('sos')} className="btn-press" style={{
              width: 44, height: 44, borderRadius: 13,
              background: 'rgba(239,68,68,0.10)', border: '1.5px solid rgba(239,68,68,0.22)',
              color: C.red, fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>🆘</button>
            <Avatar size={44} />
          </div>
        </div>

        {/* ── HERO CARD ── */}
        <div className="anim-up shadow-hero" style={{
          borderRadius: 26, marginBottom: 14,
          background: `linear-gradient(135deg, ${C.blush} 0%, #D4507A 55%, #A83060 100%)`,
          padding: 20, position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', width: 180, height: 180, borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)', right: -50, top: -50,
          }} />
          <div style={{
            position: 'absolute', width: 100, height: 100, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)', right: 30, bottom: -30,
          }} />

          <div style={{ ...row(0), justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ flex: 1 }}>
              <div style={{
                ...row(6), marginBottom: 10,
                background: 'rgba(255,255,255,0.18)', borderRadius: 20,
                padding: '4px 10px', width: 'fit-content',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.07em' }}>
                  CYCLE DAY 14 · OVULATION
                </span>
              </div>
              <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
                {ph.emoji} {ph.label} Phase
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', margin: 0, lineHeight: 1.55 }}>
                {ph.desc}
              </p>
            </div>

            {/* Cycle ring */}
            <div style={{ flexShrink: 0, width: 78, height: 78, position: 'relative' }}>
              <svg width="78" height="78" viewBox="0 0 78 78" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="39" cy="39" r="32" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="5" />
                <circle cx="39" cy="39" r="32" fill="none" stroke="#fff" strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray="201"
                  strokeDashoffset="101"
                  style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1) 0.3s' }}
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1 }}>14</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>/ 28</span>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            marginTop: 16, paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.22)',
            gap: 0,
          }}>
            {[
              { label: 'Next period', val: '14 days', icon: '📅' },
              { label: 'Cycle avg', val: '28 days', icon: '📊' },
              { label: 'Streak', val: '3 months', icon: '🔥' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '0 8px' }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', margin: '0 0 3px' }}>{s.label}</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0 }}>{s.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── QUICK STATS ROW ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>

          {/* Next Period mini card */}
          <Card
            animClass="anim-up anim-d1"
            style={{ background: 'rgba(232,213,245,0.52)', border: '1px solid rgba(232,213,245,0.80)' }}
          >
            <Label color="#5A35A0">NEXT PERIOD</Label>
            <div style={{ ...row(0), alignItems: 'flex-end', margin: '8px 0 6px', gap: 4 }}>
              <span style={{ fontFamily: '"Playfair Display", serif', fontSize: 36, fontWeight: 800, color: C.dark, lineHeight: 1 }}>14</span>
              <span style={{ fontSize: 13, color: C.mid, marginBottom: 4 }}>days</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(155,107,212,0.15)' }}>
              <div className="progress-fill" style={{ width: '50%', height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #9B6BD4, #E8D5F5)' }} />
            </div>
            <p style={{ fontSize: 11, color: '#5A35A0', margin: '5px 0 0', fontWeight: 600 }}>Aug 10 · Predicted</p>
          </Card>

          {/* Mood card */}
          <Card
            animClass="anim-up anim-d2"
            onClick={() => go('journal')}
            style={{ background: 'rgba(212,240,224,0.52)', border: '1px solid rgba(212,240,224,0.80)' }}
          >
            <Label color="#1A6B45">TODAY'S MOOD</Label>
            {mood ? (
              <>
                <p style={{ fontSize: 36, margin: '6px 0 2px', lineHeight: 1 }}>{MOODS.find(m => m.id === mood)?.emoji}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1A6B45', margin: 0, textTransform: 'capitalize' }}>{mood}</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 32, margin: '6px 0 4px', lineHeight: 1 }}>🌸</p>
                <p style={{ fontSize: 12, color: '#1A6B45', margin: 0, fontWeight: 600 }}>Tap to log</p>
              </>
            )}
            <div style={{
              marginTop: 8, display: 'inline-flex', padding: '3px 8px', borderRadius: 8,
              background: 'rgba(26,107,69,0.12)', alignItems: 'center', gap: 4,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3CC87A' }} />
              <span style={{ fontSize: 10, color: '#1A6B45', fontWeight: 700 }}>Log feeling</span>
            </div>
          </Card>
        </div>

        {/* ── TODAY'S CYCLE PHASE STRIP ── */}
        <Card animClass="anim-up anim-d3" style={{ marginBottom: 14 }}>
          <div style={{ ...row(0), justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <Label>TODAY'S CYCLE</Label>
              <h4 style={{ fontFamily: '"Playfair Display", serif', fontSize: 17, color: C.dark, margin: '4px 0 0' }}>Phase Timeline</h4>
            </div>
            <button onClick={() => go('calendar')} className="btn-press" style={{
              minWidth: 44, minHeight: 44, background: `rgba(255,107,138,0.10)`,
              border: 'none', borderRadius: 13, color: C.blush, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              Calendar
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {(['menstrual', 'follicular', 'ovulation', 'luteal'] as Phase[]).map((p) => {
              const isActive = p === currentPhase
              const ph = PHASE[p]
              return (
                <div key={p} style={{
                  ...col(5, 'center'), padding: '10px 4px', borderRadius: 16,
                  background: isActive ? ph.accent : ph.bg,
                  border: `2px solid ${isActive ? ph.accent : 'transparent'}`,
                  boxShadow: isActive ? `0 4px 16px ${ph.accent}44` : 'none',
                  transition: 'all 0.3s ease',
                }}>
                  <span style={{ fontSize: isActive ? 22 : 18 }}>{ph.emoji}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: isActive ? '#fff' : ph.fg, textAlign: 'center', lineHeight: 1.2 }}>
                    {ph.label.slice(0, 3).toUpperCase()}
                  </span>
                  {isActive && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />}
                </div>
              )
            })}
          </div>
        </Card>

        {/* ── AI PREDICTION SNAPSHOT ── */}
        <div className="anim-up anim-d4" onClick={() => go('wellness')} style={{
          borderRadius: 22, padding: 18, marginBottom: 14, cursor: 'pointer',
          background: `linear-gradient(135deg, rgba(232,213,245,0.65) 0%, rgba(255,179,198,0.45) 100%)`,
          border: '1px solid rgba(232,213,245,0.75)',
          backdropFilter: 'blur(18px)', boxShadow: '0 4px 20px rgba(155,107,212,0.12)',
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <div style={{ ...row(12) }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16, flexShrink: 0,
              background: `linear-gradient(135deg, ${C.lavender}, #9B6BD4)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              boxShadow: '0 4px 14px rgba(155,107,212,0.30)',
            }}>🤖</div>
            <div style={{ flex: 1 }}>
              <Label color="#5A35A0">AI PREDICTION SNAPSHOT</Label>
              <p style={{ fontSize: 14, color: C.dark, margin: '5px 0 8px', lineHeight: 1.55, fontWeight: 500 }}>
                Next period predicted <strong style={{ color: C.blush }}>Aug 10</strong>.
                High confidence — your cycle has been consistent.
              </p>
              <div style={{ ...row(8) }}>
                <div style={{ ...row(5), padding: '4px 10px', background: 'rgba(60,200,122,0.15)', borderRadius: 20 }}>
                  <span style={{ fontSize: 9, fontWeight: 900, color: '#1A6B45' }}>● 94% CONFIDENCE</span>
                </div>
                <div style={{ ...row(5), padding: '4px 10px', background: 'rgba(155,107,212,0.12)', borderRadius: 20 }}>
                  <span style={{ fontSize: 9, fontWeight: 900, color: '#5A35A0' }}>ON TRACK</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── BENTO ROW: AI Chat + Quick Log ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <Card onClick={() => go('chat')} animClass="anim-up anim-d5">
            <div style={{
              width: 44, height: 44, borderRadius: 14, marginBottom: 10,
              background: `linear-gradient(135deg, ${C.blush}, ${C.lavender})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              boxShadow: '0 4px 14px rgba(255,107,138,0.28)',
            }}>💬</div>
            <p style={{ fontSize: 14, fontWeight: 800, color: C.dark, margin: '0 0 3px' }}>Luna AI</p>
            <p style={{ fontSize: 12, color: C.soft, margin: 0, lineHeight: 1.4 }}>Ask me anything about your health</p>
          </Card>

          <Card onClick={() => go('journal')} animClass="anim-up anim-d6">
            <div style={{
              width: 44, height: 44, borderRadius: 14, marginBottom: 10,
              background: `linear-gradient(135deg, ${C.mint}, #3CC87A)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              boxShadow: '0 4px 14px rgba(60,200,122,0.25)',
            }}>📝</div>
            <p style={{ fontSize: 14, fontWeight: 800, color: C.dark, margin: '0 0 3px' }}>Journal</p>
            <p style={{ fontSize: 12, color: C.soft, margin: 0, lineHeight: 1.4 }}>Log symptoms & feelings</p>
          </Card>
        </div>

        {/* ── ANALYTICS ── */}
        <Card animClass="anim-fade" style={{ marginBottom: 14 }}>
          <SectionHead title="3-Month Analytics" action="Full view" onAction={() => go('wellness')} />
          <div style={{ ...row(0), alignItems: 'flex-end', gap: 10 }}>
            {[
              { m: 'May', d: 29, mood: '😊', h: 72, color: C.roseQuartz },
              { m: 'Jun', d: 27, mood: '😌', h: 60, color: C.blushL },
              { m: 'Jul', d: 28, mood: '✨', h: 68, color: C.blush },
            ].map((c, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: i === 2 ? C.blush : C.mid, margin: '0 0 5px' }}>{c.d}d</p>
                <div style={{
                  height: c.h, borderRadius: '8px 8px 4px 4px', width: '100%',
                  background: i === 2
                    ? `linear-gradient(180deg, ${C.blush} 0%, ${C.roseQuartz} 100%)`
                    : `linear-gradient(180deg, ${c.color}88 0%, ${c.color}44 100%)`,
                  transition: 'height 1s cubic-bezier(0.34,1.56,0.64,1)',
                }} />
                <p style={{ fontSize: 11, color: C.soft, margin: '6px 0 0' }}>{c.m}</p>
                <p style={{ fontSize: 14, margin: '2px 0 0' }}>{c.mood}</p>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 14,
            background: `rgba(60,200,122,0.10)`, border: '1px solid rgba(60,200,122,0.20)',
          }}>
            <p style={{ fontSize: 12, color: '#1A6B45', margin: 0, fontWeight: 500 }}>
              📈 Average cycle: <strong>28 days</strong> · Regularity score: <strong>92%</strong>
            </p>
          </div>
        </Card>

        {/* ── WELLNESS VIDEOS ── */}
        <div style={{ marginBottom: 14 }}>
          <SectionHead title="Wellness Videos" action="See all" />
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
            {[
              { t: 'Cycle Nutrition', d: '8 min', emoji: '🥗', bg: '#FFE8EF', badge: 'Ovulation' },
              { t: 'Yoga for Cramps', d: '15 min', emoji: '🧘', bg: C.lavender, badge: 'Menstrual' },
              { t: 'Better Sleep', d: '6 min', emoji: '🌙', bg: '#EFE8FA', badge: 'Luteal' },
              { t: 'Mindful Eating', d: '10 min', emoji: '🍓', bg: '#FFF4E3', badge: 'All phases' },
            ].map((v, i) => (
              <div key={i} style={{
                minWidth: 148, borderRadius: 20,
                background: v.bg, padding: '16px 14px',
                boxShadow: '0 4px 18px rgba(212,165,181,0.14)',
                border: '1px solid rgba(255,255,255,0.85)',
                cursor: 'pointer',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 16, marginBottom: 10,
                  background: 'rgba(255,255,255,0.70)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                }}>{v.emoji}</div>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.dark, margin: '0 0 4px' }}>{v.t}</p>
                <p style={{ fontSize: 11, color: C.soft, margin: '0 0 8px' }}>⏱ {v.d}</p>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: C.blush,
                  background: 'rgba(255,107,138,0.12)', padding: '3px 8px', borderRadius: 20,
                }}>{v.badge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   SCREEN: CALENDAR
═══════════════════════════════════════════════════════ */
function CalendarScreen() {
  const [sel, setSel] = useState<number | null>(27)
  const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  const START_OFFSET = 2 // July 2025

  const phaseForDay = (d: number): Phase | null => {
    if (d >= 1 && d <= 5) return 'menstrual'
    if (d >= 6 && d <= 11) return 'follicular'
    if (d >= 12 && d <= 16) return 'ovulation'
    if (d >= 17 && d <= 28) return 'luteal'
    return null
  }

  const selPhase = sel ? phaseForDay(sel) : null

  return (
    <div style={{ background: C.cream, minHeight: '100%', paddingBottom: 96 }}>
      <div style={{
        background: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(232,213,245,0.35) 0%, transparent 60%), ${C.cream}`,
        padding: '52px 18px 0',
      }}>
        {/* Header */}
        <div style={{ ...row(0), justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button style={{ minWidth: 44, minHeight: 44, background: 'none', border: 'none', fontSize: 22, color: C.mid, cursor: 'pointer' }}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: 22, fontWeight: 800, color: C.dark, margin: 0 }}>July 2025</h2>
            <p style={{ fontSize: 12, color: C.soft, margin: '2px 0 0' }}>Cycle Day 14 · Ovulation</p>
          </div>
          <button style={{ minWidth: 44, minHeight: 44, background: 'none', border: 'none', fontSize: 22, color: C.mid, cursor: 'pointer' }}>›</button>
        </div>

        {/* Phase Legend */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 18, flexWrap: 'wrap' }}>
          {(['menstrual', 'follicular', 'ovulation', 'luteal'] as Phase[]).map(p => (
            <div key={p} style={{
              ...row(5), background: PHASE[p].bg, borderRadius: 20,
              padding: '5px 10px', border: `1px solid ${PHASE[p].accent}22`,
            }}>
              <span style={{ fontSize: 12 }}>{PHASE[p].emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: PHASE[p].fg }}>{PHASE[p].label}</span>
            </div>
          ))}
        </div>

        {/* DOW headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {DOW.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.lighter, padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {Array.from({ length: START_OFFSET }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: 31 }).map((_, i) => {
            const day = i + 1
            const phase = phaseForDay(day)
            const isToday = day === 27
            const isSel = day === sel
            return (
              <button
                key={day}
                onClick={() => setSel(day)}
                className="btn-press"
                style={{
                  height: 46, borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: isSel
                    ? (phase ? PHASE[phase].accent : C.blush)
                    : (phase ? PHASE[phase].bg : 'transparent'),
                  color: isSel ? '#fff' : (isToday ? C.blush : C.dark),
                  fontSize: 14, fontWeight: isSel || isToday ? 800 : 400,
                  position: 'relative',
                  boxShadow: isSel ? `0 4px 14px ${phase ? PHASE[phase].accent : C.blush}55` : 'none',
                  outline: isToday && !isSel ? `2px solid ${C.blush}` : 'none',
                  outlineOffset: -2,
                  transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                }}
              >
                {day}
                {isToday && !isSel && (
                  <div style={{
                    position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: '50%', background: C.blush,
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Day detail */}
        {sel && (
          <div className="anim-up" key={sel} style={{ marginTop: 20 }}>
            <Card style={{ background: selPhase ? PHASE[selPhase].bg : 'rgba(255,255,255,0.75)' }}>
              <div style={{ ...row(0), justifyContent: 'space-between', marginBottom: 14 }}>
                <h4 style={{ fontFamily: '"Playfair Display", serif', fontSize: 18, fontWeight: 700, color: C.dark, margin: 0 }}>
                  July {sel}
                </h4>
                {selPhase && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: PHASE[selPhase].fg,
                    background: `${PHASE[selPhase].accent}18`, padding: '4px 12px', borderRadius: 20,
                  }}>
                    {PHASE[selPhase].emoji} {PHASE[selPhase].label}
                  </span>
                )}
              </div>
              {selPhase ? (
                <div style={col(12)}>
                  <p style={{ fontSize: 14, color: C.mid, margin: 0, lineHeight: 1.6 }}>
                    {PHASE[selPhase].desc}
                  </p>
                  <div style={{ ...row(8), flexWrap: 'wrap' }}>
                    <Chip label="Log symptoms" color={PHASE[selPhase].accent} />
                    <Chip label="Add note" color={C.mauve} />
                    <Chip label="Log mood" color={C.blush} />
                  </div>
                </div>
              ) : (
                <p style={{ color: C.soft, fontSize: 14, margin: 0 }}>No cycle data for this day.</p>
              )}
            </Card>
          </div>
        )}

        {/* Phase breakdown cards */}
        <div style={{ marginTop: 20, ...col(10) }}>
          <SectionHead title="Phase Overview" />
          {(['menstrual', 'follicular', 'ovulation', 'luteal'] as Phase[]).map((p, i) => (
            <div key={p} className={`anim-up anim-d${i + 1}`} style={{
              ...row(14), padding: '14px 16px', borderRadius: 18,
              background: PHASE[p].bg, border: `1px solid ${PHASE[p].accent}22`,
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: 15, flexShrink: 0,
                background: `${PHASE[p].accent}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>{PHASE[p].emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ ...row(8), marginBottom: 2 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: PHASE[p].fg, margin: 0 }}>{PHASE[p].label}</p>
                  <span style={{ fontSize: 11, color: PHASE[p].fg, background: `${PHASE[p].accent}15`, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                    {['Days 1–5', 'Days 6–11', 'Days 12–16', 'Days 17–28'][i]}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: C.mid, margin: 0 }}>{PHASE[p].desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   SCREEN: JOURNAL
═══════════════════════════════════════════════════════ */
function JournalScreen() {
  const [mood, setMood] = useState<Mood | null>(null)
  const [syms, setSyms] = useState<string[]>([])
  const [text, setText] = useState('')
  const [energy, setEnergy] = useState(3)
  const [saved, setSaved] = useState(false)

  const toggleSym = (s: string) => setSyms(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2800) }

  const sentiment = text.length > 20
    ? text.toLowerCase().includes('pain') || text.toLowerCase().includes('tired') ? 'neutral'
    : text.toLowerCase().includes('great') || text.toLowerCase().includes('feel') ? 'positive' : 'neutral'
    : null

  return (
    <div style={{ background: C.cream, minHeight: '100%', paddingBottom: 96 }}>
      <div style={{
        background: `radial-gradient(ellipse 70% 45% at 30% 0%, rgba(212,240,224,0.35) 0%, transparent 60%), ${C.cream}`,
        padding: '52px 18px 0',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: C.soft, margin: '0 0 4px' }}>
            SUNDAY · JULY 27, 2025
          </p>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 28, fontWeight: 800, color: C.dark, margin: 0 }}>
            Today's Entry
          </h1>
        </div>

        {/* ── MOOD SELECTOR ── */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 14 }}>
            <Label>HOW ARE YOU FEELING?</Label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
            {MOODS.map(m => (
              <button
                key={m.id}
                onClick={() => setMood(m.id)}
                className="btn-press"
                style={{
                  minHeight: 68, borderRadius: 18, border: 'none', cursor: 'pointer',
                  background: mood === m.id ? m.color : m.bg,
                  ...col(4, 'center'), justifyContent: 'center',
                  boxShadow: mood === m.id ? `0 6px 18px ${m.color}55` : 'none',
                  transform: mood === m.id ? 'scale(1.06)' : 'scale(1)',
                  transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
                  border: mood === m.id ? 'none' : `1.5px solid ${m.color}33`,
                }}
              >
                <span style={{ fontSize: 28 }}>{m.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: mood === m.id ? '#fff' : m.color }}>{m.label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* ── ENERGY LEVEL ── */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ ...row(0), justifyContent: 'space-between', marginBottom: 12 }}>
            <Label>ENERGY LEVEL</Label>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.blush }}>
              {['Very Low', 'Low', 'Moderate', 'High', 'Peak'][energy - 1]}
            </span>
          </div>
          <div style={{ ...row(8) }}>
            {['🪫', '😴', '😊', '⚡', '🚀'].map((e, i) => (
              <button key={i} onClick={() => setEnergy(i + 1)} className="btn-press" style={{
                flex: 1, height: 48, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: energy === i + 1 ? `linear-gradient(135deg, ${C.blush}, #D4507A)` : 'rgba(247,197,204,0.35)',
                fontSize: 20, transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                boxShadow: energy === i + 1 ? `0 4px 14px rgba(255,107,138,0.35)` : 'none',
                transform: energy === i + 1 ? 'scale(1.08)' : 'scale(1)',
              }}>{e}</button>
            ))}
          </div>
        </Card>

        {/* ── SYMPTOM PILLS ── */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 12 }}>
            <Label>SYMPTOMS TODAY</Label>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {SYMPTOMS.map(s => (
              <Chip key={s} label={s} active={syms.includes(s)} color={C.blush} onClick={() => toggleSym(s)} />
            ))}
          </div>
          {syms.length > 0 && (
            <p style={{ fontSize: 11, color: C.soft, margin: '10px 0 0' }}>
              {syms.length} symptom{syms.length > 1 ? 's' : ''} logged
            </p>
          )}
        </Card>

        {/* ── JOURNAL TEXT ── */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ ...row(0), justifyContent: 'space-between', marginBottom: 12 }}>
            <Label>YOUR THOUGHTS</Label>
            {sentiment && (
              <span style={{
                fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '3px 9px',
                color: sentiment === 'positive' ? '#1A6B45' : C.mid,
                background: sentiment === 'positive' ? 'rgba(60,200,122,0.13)' : 'rgba(160,120,136,0.12)',
              }}>
                🤖 {sentiment === 'positive' ? 'Positive vibes ✨' : 'Neutral tone'}
              </span>
            )}
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`This space is entirely yours. Write freely, with no judgement — just honesty and care. 🌸\n\nWhat's on your mind today?`}
            style={{
              width: '100%', minHeight: 130, border: 'none', background: 'none',
              fontSize: 15, color: C.dark, lineHeight: 1.75,
              outline: 'none', resize: 'none', fontFamily: 'Inter, sans-serif',
              boxSizing: 'border-box',
            }}
          />
          <div style={{
            ...row(0), justifyContent: 'space-between',
            borderTop: `1px solid ${C.rose}55`, paddingTop: 10, marginTop: 6,
          }}>
            <span style={{ fontSize: 11, color: C.lighter }}>{text.length} chars</span>
            <div style={{ ...row(8) }}>
              <button style={{ minHeight: 36, padding: '0 12px', background: 'none', border: `1px solid ${C.rose}`, borderRadius: 10, color: C.mauve, fontSize: 12, cursor: 'pointer' }}>📷 Photo</button>
              <button style={{ minHeight: 36, padding: '0 12px', background: 'none', border: `1px solid ${C.rose}`, borderRadius: 10, color: C.mauve, fontSize: 12, cursor: 'pointer' }}>🎤 Voice</button>
            </div>
          </div>
        </Card>

        {saved && (
          <div className="anim-up" style={{
            ...row(10), marginBottom: 12, padding: '12px 16px', borderRadius: 16,
            background: 'rgba(60,200,122,0.13)', border: '1px solid rgba(60,200,122,0.25)',
          }}>
            <span style={{ fontSize: 18, color: '#1A6B45' }}>✓</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A6B45' }}>Entry saved — wonderful!</span>
          </div>
        )}

        <PrimaryBtn label="Save Entry" onClick={save} icon="💾" />
        <div style={{ marginTop: 8 }}>
          <GhostBtn label="View Past Entries" icon="📖" />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   SCREEN: SOS
═══════════════════════════════════════════════════════ */
function SOSScreen({ onBack }: { onBack: () => void }) {
  const [countdown, setCountdown] = useState<number | null>(null)
  const [active, setActive] = useState(false)
  const timer = useRef<number | null>(null)

  const startSOS = () => {
    setCountdown(5)
    timer.current = window.setInterval(() => {
      setCountdown(p => {
        if (p === null || p <= 1) {
          clearInterval(timer.current!); setActive(true); return null
        }
        return p - 1
      })
    }, 1000)
  }
  const cancel = () => { clearInterval(timer.current!); setCountdown(null); setActive(false) }
  useEffect(() => () => { clearInterval(timer.current!) }, [])

  const contacts = [
    { name: 'Mama', rel: 'Mother', emoji: '👩', status: active ? 'Notified ✓' : 'Primary' },
    { name: 'Aisha', rel: 'Sister', emoji: '👧', status: active ? 'Notified ✓' : 'Secondary' },
    { name: 'Dr. Sade', rel: 'Doctor', emoji: '🏥', status: active ? 'Notified ✓' : 'Medical' },
  ]

  if (active) {
    return (
      <div style={{
        minHeight: '100%', display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(160deg, #7F0000 0%, #C0392B 60%, #8B1A1A 100%)',
        padding: '56px 20px 40px',
      }}>
        <div className="anim-spring" style={{ ...col(28, 'center'), flex: 1, justifyContent: 'center' }}>
          <span style={{ fontSize: 72 }}>🚨</span>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: 30, fontWeight: 800, color: '#fff', margin: '0 0 10px' }}>
              SOS Alert Sent
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.6 }}>
              Your location has been shared.<br />Help is on the way.
            </p>
          </div>

          <div style={{ width: '100%', borderRadius: 22, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
            {contacts.map((c, i) => (
              <div key={i} style={{
                ...row(14), padding: '14px 16px',
                background: 'rgba(255,255,255,0.10)',
                borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.12)' : 'none',
              }}>
                <div style={{ ...circle(40), background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{c.emoji}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>{c.name}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)', margin: '1px 0 0' }}>{c.rel}</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{c.status}</span>
              </div>
            ))}
          </div>

          <div style={{ width: '100%', ...col(10) }}>
            <button onClick={cancel} style={{
              minHeight: 52, width: '100%', borderRadius: 16,
              border: '2px solid rgba(255,255,255,0.50)',
              background: 'rgba(255,255,255,0.14)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              I'm Safe — Cancel Alert
            </button>
            <button style={{
              minHeight: 52, width: '100%', borderRadius: 16,
              border: 'none', background: '#fff',
              color: C.redD, fontSize: 15, fontWeight: 800, cursor: 'pointer',
            }}>
              📞 Call Emergency Services
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column',
      background: `radial-gradient(ellipse 70% 50% at 50% 0%, rgba(239,68,68,0.08) 0%, transparent 60%), ${C.cream}`,
      padding: '56px 20px 40px',
    }}>
      {/* Back */}
      <button onClick={onBack} className="btn-press" style={{
        minWidth: 44, minHeight: 44, borderRadius: 14, alignSelf: 'flex-start', marginBottom: 24,
        border: `1.5px solid ${C.rose}`, background: 'rgba(255,255,255,0.75)',
        color: C.blush, fontSize: 20, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>‹</button>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 28, fontWeight: 800, color: C.dark, margin: '0 0 8px' }}>
          Safety Centre
        </h1>
        <p style={{ color: C.mid, fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          You are safe. Your emergency contacts are always one tap away.
        </p>
      </div>

      {/* Contacts */}
      <Card style={{ marginBottom: 24 }}>
        <Label style={{ marginBottom: 14 }}>EMERGENCY CONTACTS</Label>
        <div style={{ marginTop: 12, ...col(0) }}>
          {contacts.map((c, i) => (
            <div key={i} style={{
              ...row(12), padding: '12px 0',
              borderBottom: i < 2 ? `1px solid ${C.rose}55` : 'none',
            }}>
              <div style={{
                ...circle(44), flexShrink: 0,
                background: `linear-gradient(135deg, ${C.rose}, ${C.lavender})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>{c.emoji}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.dark, margin: 0 }}>{c.name}</p>
                <p style={{ fontSize: 12, color: C.soft, margin: '1px 0 0' }}>{c.rel}</p>
              </div>
              <button className="btn-press" style={{
                width: 44, height: 44, borderRadius: 13, border: 'none',
                background: `rgba(255,107,138,0.10)`, fontSize: 20, cursor: 'pointer',
              }}>📞</button>
            </div>
          ))}
        </div>
        <button style={{
          marginTop: 14, width: '100%', minHeight: 44, borderRadius: 14,
          border: `1.5px dashed ${C.rose}`, background: 'transparent',
          color: C.blush, fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          + Add Contact
        </button>
      </Card>

      {/* SOS button */}
      <div style={{ flex: 1, ...col(20, 'center'), justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 180, height: 180 }}>
          {countdown === null && (
            <>
              <div className="sos-ring" />
              <div className="sos-ring-2" />
            </>
          )}
          <button
            onClick={countdown === null ? startSOS : undefined}
            className={countdown === null ? 'sos-btn' : ''}
            style={{
              width: '100%', height: '100%', borderRadius: '50%', border: 'none',
              background: countdown !== null
                ? `conic-gradient(${C.red} ${((5 - (countdown || 0)) / 5) * 360}deg, rgba(239,68,68,0.25) 0deg)`
                : `linear-gradient(135deg, #FF4444, ${C.redD})`,
              color: '#fff', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              boxShadow: '0 12px 40px rgba(239,68,68,0.40)',
              transition: 'transform 0.3s ease',
              transform: countdown !== null ? 'scale(1.06)' : 'scale(1)',
            }}
          >
            {countdown !== null ? (
              <>
                <span style={{ fontSize: 54, fontWeight: 900, lineHeight: 1 }}>{countdown}</span>
                <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Sending…</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 42 }}>🆘</span>
                <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.05em' }}>SOS</span>
              </>
            )}
          </button>
        </div>

        {countdown !== null ? (
          <button onClick={cancel} className="btn-press" style={{
            minHeight: 48, padding: '0 32px', borderRadius: 16,
            border: `1.5px solid ${C.rose}`, background: 'rgba(255,255,255,0.8)',
            color: C.blush, fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>Cancel</button>
        ) : (
          <p style={{ fontSize: 13, color: C.soft, textAlign: 'center', margin: 0, lineHeight: 1.65 }}>
            Tap to begin a 5-second countdown.<br />
            <span style={{ color: C.mid, fontWeight: 600 }}>Alerts your contacts + shares location.</span>
          </p>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   SCREEN: WELLNESS
═══════════════════════════════════════════════════════ */
function WellnessScreen() {
  const [tab, setTab] = useState<'insights' | 'mood' | 'breathing'>('insights')

  return (
    <div style={{ background: C.cream, minHeight: '100%', paddingBottom: 96 }}>
      <div style={{
        background: `radial-gradient(ellipse 70% 45% at 80% 5%, rgba(212,240,224,0.38) 0%, transparent 60%), ${C.cream}`,
        padding: '52px 18px 0',
      }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: C.soft, margin: '0 0 4px' }}>PERSONALISED FOR YOU</p>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 27, fontWeight: 800, color: C.dark, margin: 0 }}>
            Wellness Insights
          </h1>
        </div>

        {/* Tabs */}
        <div style={{
          ...row(3), background: 'rgba(255,255,255,0.72)', borderRadius: 18,
          padding: 4, marginBottom: 20, border: `1px solid ${C.rose}55`,
        }}>
          {([['insights', '✨ Insights'], ['mood', '🌸 Mood'], ['breathing', '🧘 Breathe']] as [typeof tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="btn-press" style={{
              flex: 1, minHeight: 40, borderRadius: 14, border: 'none',
              background: tab === id ? `linear-gradient(135deg, ${C.blush}, #D4507A)` : 'none',
              color: tab === id ? '#fff' : C.soft,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: tab === id ? '0 4px 14px rgba(255,107,138,0.28)' : 'none',
              transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
            }}>{label}</button>
          ))}
        </div>

        {tab === 'insights' && (
          <div className="anim-fade" style={col(14)}>
            {/* Luna quote card */}
            <div style={{
              borderRadius: 24, padding: 20,
              background: `linear-gradient(135deg, ${C.lavender} 0%, ${C.roseQuartz} 100%)`,
              border: '1px solid rgba(255,255,255,0.80)',
              boxShadow: '0 8px 32px rgba(155,107,212,0.16)',
            }}>
              <div style={{ ...row(10), marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                  background: 'rgba(255,255,255,0.60)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>🤖</div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#5A35A0', margin: 0 }}>LUNA'S DAILY INSIGHT</p>
                  <p style={{ fontSize: 11, color: C.mid, margin: 0 }}>Cycle Day 14 · Ovulation</p>
                </div>
              </div>
              <p style={{
                fontFamily: '"Playfair Display", serif', fontSize: 17, fontStyle: 'italic',
                color: C.dark, margin: '0 0 12px', lineHeight: 1.7,
              }}>
                "You're in your most energetic phase. Lean into social connection, creative projects, and movement today — your body is your greatest ally right now."
              </p>
              <div style={{ ...row(8) }}>
                <Chip label="💪 High energy" color="#5A35A0" active />
                <Chip label="🌟 Peak fertility" color={C.mid} />
              </div>
            </div>

            {/* Wellness stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { icon: '😴', label: 'Avg Sleep', val: '7.2h', trend: '↑ 0.4h', tColor: '#1A6B45', bg: C.lavender },
                { icon: '💧', label: 'Hydration', val: '6 / 8', trend: 'On track', tColor: '#1A6B45', bg: C.mint },
                { icon: '🏃', label: 'Active Days', val: '4 / 7', trend: '↑ vs last wk', tColor: '#1A6B45', bg: C.roseQuartz },
                { icon: '🧘', label: 'Stress Score', val: '3.2 / 5', trend: '↓ Improving', tColor: '#1A6B45', bg: C.blushL },
              ].map(s => (
                <Card key={s.label} style={{ background: `${s.bg}55` }}>
                  <span style={{ fontSize: 26 }}>{s.icon}</span>
                  <p style={{ fontSize: 11, color: C.soft, margin: '8px 0 2px', fontWeight: 700 }}>{s.label}</p>
                  <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 24, fontWeight: 800, color: C.dark, margin: '0 0 3px' }}>{s.val}</p>
                  <p style={{ fontSize: 11, color: s.tColor, margin: 0, fontWeight: 700 }}>{s.trend}</p>
                </Card>
              ))}
            </div>

            {/* Recommendations */}
            <Card>
              <Label style={{ marginBottom: 14 }}>PERSONALISED RECOMMENDATIONS</Label>
              <div style={{ marginTop: 12, ...col(0) }}>
                {[
                  { icon: '🥗', text: 'Iron-rich foods today: spinach, lentils, dark chocolate', badge: 'Nutrition', bc: '#FFF4E3', bt: '#A0621A' },
                  { icon: '🛁', text: 'Warm bath tonight promotes progesterone-ready sleep', badge: 'Sleep', bc: C.lavender, bt: '#5A35A0' },
                  { icon: '🚶', text: '30-min walk amplifies ovulation-phase energy', badge: 'Movement', bc: C.mint, bt: '#1A6B45' },
                ].map((r, i) => (
                  <div key={i} style={{
                    ...row(12, 'flex-start'), padding: '13px 0',
                    borderBottom: i < 2 ? `1px solid ${C.rose}44` : 'none',
                  }}>
                    <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, color: C.dark, margin: '0 0 6px', lineHeight: 1.5, fontWeight: 500 }}>{r.text}</p>
                      <span style={{ fontSize: 10, fontWeight: 800, color: r.bt, background: r.bc, padding: '3px 9px', borderRadius: 20 }}>{r.badge}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'mood' && (
          <div className="anim-slide" style={col(14)}>
            <Card>
              <Label style={{ marginBottom: 16 }}>MOOD THIS WEEK</Label>
              <div style={{ ...row(8), alignItems: 'flex-end', marginTop: 8 }}>
                {[
                  { day: 'M', m: 'calm',      h: 58, emoji: '🌸' },
                  { day: 'T', m: 'energized', h: 80, emoji: '⚡' },
                  { day: 'W', m: 'radiant',   h: 92, emoji: '✨' },
                  { day: 'T', m: 'tired',     h: 44, emoji: '🌙' },
                  { day: 'F', m: 'calm',      h: 65, emoji: '🌸' },
                  { day: 'S', m: 'energized', h: 76, emoji: '⚡' },
                  { day: 'S', m: 'radiant',   h: 88, emoji: '✨' },
                ].map((d, i) => {
                  const mood = MOODS.find(x => x.id === d.m)!
                  const isToday = i === 6
                  return (
                    <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                      <span style={{ fontSize: 14 }}>{d.emoji}</span>
                      <div style={{
                        height: d.h, borderRadius: '6px 6px 3px 3px',
                        background: isToday ? `linear-gradient(180deg, ${mood.color}, ${mood.color}88)` : `${mood.color}44`,
                        border: isToday ? `1.5px solid ${mood.color}` : 'none',
                        margin: '6px auto 0', width: '100%',
                        boxShadow: isToday ? `0 4px 12px ${mood.color}33` : 'none',
                      }} />
                      <p style={{ fontSize: 10, color: isToday ? C.blush : C.lighter, margin: '5px 0 0', fontWeight: isToday ? 800 : 400 }}>{d.day}</p>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card style={{ background: `rgba(232,213,245,0.45)` }}>
              <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 17, fontStyle: 'italic', color: C.dark, margin: '0 0 12px', lineHeight: 1.7 }}>
                "You tend to feel most radiant mid-cycle and need extra rest in your luteal phase. This is perfectly in tune with your hormones."
              </p>
              <div style={{ ...row(8), flexWrap: 'wrap' }}>
                <Chip label="✨ Radiant 3×" color={C.blush} active />
                <Chip label="🌸 Calm 2×" color={C.mauve} />
                <Chip label="⚡ Energized 2×" color="#A0621A" />
              </div>
            </Card>
          </div>
        )}

        {tab === 'breathing' && (
          <div className="anim-slide" style={col(12)}>
            {[
              { name: '4-7-8 Breathing', desc: 'Calm anxiety & drift to sleep faster', dur: '5 min', emoji: '🫁', bg: C.lavender, color: '#5A35A0' },
              { name: 'Box Breathing',   desc: 'Sharpens focus, dissolves stress',       dur: '4 min', emoji: '📦', bg: C.mint,     color: '#1A6B45' },
              { name: 'Belly Breathing', desc: 'Eases cramps & abdominal tension',        dur: '6 min', emoji: '🌸', bg: '#FFE8EF', color: C.blush  },
              { name: 'Energising Breath', desc: 'Boost energy without caffeine',         dur: '8 min', emoji: '⚡', bg: '#FFF4E3', color: '#A0621A' },
            ].map((ex, i) => (
              <Card key={i} className={`anim-up anim-d${i + 1}`} style={{ background: `${ex.bg}66` }}>
                <div style={{ ...row(14) }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 18, flexShrink: 0,
                    background: 'rgba(255,255,255,0.72)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                    boxShadow: '0 4px 14px rgba(212,165,181,0.16)',
                  }}>{ex.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: C.dark, margin: '0 0 3px' }}>{ex.name}</p>
                    <p style={{ fontSize: 12, color: C.mid, margin: '0 0 9px', lineHeight: 1.4 }}>{ex.desc}</p>
                    <Chip label={`⏱ ${ex.dur}`} color={ex.color} />
                  </div>
                  <button className="btn-press" style={{
                    width: 44, height: 44, borderRadius: 14, border: 'none', flexShrink: 0,
                    background: `linear-gradient(135deg, ${ex.color}, ${ex.color}CC)`,
                    color: '#fff', fontSize: 18, cursor: 'pointer',
                    boxShadow: `0 4px 14px ${ex.color}44`,
                  }}>▶</button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   SCREEN: CHAT
═══════════════════════════════════════════════════════ */
function ChatScreen() {
  const [msgs, setMsgs] = useState([
    { ai: true,  t: "Hi Sofia! 🌸 I'm Luna, your AI wellness companion. How are you feeling today?" },
    { ai: false, t: "I've been feeling really tired around day 20 of my cycle. Is that normal?" },
    { ai: true,  t: "Absolutely — that's your luteal phase. Progesterone peaks then dips, causing fatigue and sometimes low mood. It's completely normal. Try magnesium-rich foods like dark chocolate, pumpkin seeds, and leafy greens. Want a personalised luteal phase plan? 🥗🌙" },
    { ai: false, t: "Yes please! And what about the bloating?" },
    { ai: true,  t: "Luteal bloating happens due to water retention from progesterone. Reduce sodium and refined carbs, drink warm water with lemon, and gentle yoga can help. I've added a bloating relief routine to your Wellness tab! 💚" },
  ])
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const send = () => {
    if (!input.trim()) return
    setMsgs(p => [...p,
      { ai: false, t: input },
      { ai: true,  t: "That's a great question. Based on your cycle history and today being Day 14, your body is primed for connection and creativity. I'd suggest a light workout, some journalling, and staying well hydrated. You've got this! ✨" },
    ])
    setInput('')
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const suggestions = ['Cramping tips', 'Sleep help', 'Mood boost', 'Nutrition plan']

  return (
    <div style={{ background: C.cream, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(180deg, rgba(255,179,198,0.25) 0%, rgba(255,248,240,0) 100%), ${C.cream}`,
        padding: '52px 18px 14px',
        borderBottom: `1px solid ${C.rose}55`,
        flexShrink: 0,
      }}>
        <div style={{ ...row(12) }}>
          <div style={{
            ...circle(46), flexShrink: 0,
            background: `linear-gradient(135deg, ${C.blush}, ${C.lavender})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            boxShadow: '0 4px 16px rgba(255,107,138,0.32)',
            position: 'relative',
          }}>
            🤖
            <div style={{
              width: 12, height: 12, borderRadius: '50%', background: '#3CC87A',
              border: '2px solid #fff', position: 'absolute', bottom: 0, right: 0,
            }} />
          </div>
          <div>
            <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: 19, fontWeight: 800, color: C.dark, margin: 0 }}>Luna AI</h3>
            <p style={{ fontSize: 12, color: '#1A6B45', margin: 0, fontWeight: 700 }}>Online · Cycle-aware · Always here</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px', ...col(12) }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.ai ? 'flex-start' : 'flex-end', gap: 8, alignItems: 'flex-end' }}>
            {m.ai && (
              <div style={{
                ...circle(28), flexShrink: 0,
                background: `linear-gradient(135deg, ${C.blush}, ${C.lavender})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>🤖</div>
            )}
            <div style={{
              maxWidth: '78%', padding: '11px 15px',
              background: m.ai ? 'rgba(255,255,255,0.90)' : `linear-gradient(135deg, ${C.blush}, #D4507A)`,
              color: m.ai ? C.dark : '#fff',
              borderRadius: m.ai ? '18px 18px 18px 5px' : '18px 18px 5px 18px',
              fontSize: 14, lineHeight: 1.65,
              boxShadow: m.ai ? '0 2px 12px rgba(212,165,181,0.14)' : '0 4px 16px rgba(255,107,138,0.30)',
              border: m.ai ? `1px solid ${C.rose}55` : 'none',
            }}>
              {m.t}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {suggestions.map(s => (
            <button key={s} onClick={() => setInput(s)} style={{
              whiteSpace: 'nowrap', padding: '7px 13px', borderRadius: 20,
              border: `1.5px solid ${C.rose}`, background: 'rgba(255,255,255,0.75)',
              color: C.blush, fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 34,
            }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div style={{
        padding: '8px 16px 28px', flexShrink: 0,
        background: 'rgba(255,248,240,0.96)', backdropFilter: 'blur(16px)',
        borderTop: `1px solid ${C.rose}55`, ...row(10),
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask Luna anything…"
          className="sc-input"
          style={{
            flex: 1, height: 46, borderRadius: 16, border: `1.5px solid ${C.rose}`,
            background: 'rgba(255,255,255,0.85)', padding: '0 16px',
            fontSize: 14, color: C.dark, fontFamily: 'Inter, sans-serif',
          }}
        />
        <button onClick={send} className="btn-press" style={{
          width: 46, height: 46, borderRadius: 14, border: 'none', flexShrink: 0,
          background: `linear-gradient(135deg, ${C.blush}, #D4507A)`,
          color: '#fff', fontSize: 20, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(255,107,138,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>↑</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   SCREEN: SETTINGS
═══════════════════════════════════════════════════════ */
function SettingsScreen() {
  const [notifs, setNotifs]     = useState(true)
  const [bio, setBio]           = useState(false)
  const [dark, setDark]         = useState(false)
  const [reminders, setRem]     = useState(true)
  const [aiInsights, setAI]     = useState(true)
  const [location, setLoc]      = useState(true)

  function SettRow({ icon, label, sub, right, last = false }: { icon: string; label: string; sub?: string; right?: React.ReactNode; last?: boolean }) {
    return (
      <div style={{
        ...row(13), padding: '14px 16px', minHeight: 58,
        borderBottom: last ? 'none' : `1px solid ${C.rose}44`,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: `rgba(255,107,138,0.10)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.dark, margin: 0 }}>{label}</p>
          {sub && <p style={{ fontSize: 12, color: C.soft, margin: '1px 0 0' }}>{sub}</p>}
        </div>
        {right}
      </div>
    )
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', color: C.soft, margin: '0 0 8px' }}>{title}</p>
        <div className="glass shadow-card" style={{ borderRadius: 20, overflow: 'hidden' }}>{children}</div>
      </div>
    )
  }

  return (
    <div style={{ background: C.cream, minHeight: '100%', paddingBottom: 96 }}>
      <div style={{ padding: '52px 18px 0' }}>
        {/* Profile hero */}
        <div className="anim-spring shadow-hero" style={{
          borderRadius: 26, padding: 20, marginBottom: 24,
          background: `linear-gradient(135deg, ${C.blush} 0%, #D4507A 55%, #A83060 100%)`,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', right: -40, top: -40 }} />
          <div style={{ ...row(14), position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <Avatar size={60} />
              <button style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 22, height: 22, borderRadius: '50%',
                background: '#fff', border: 'none', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✏️</button>
            </div>
            <div style={{ flex: 1, color: '#fff' }}>
              <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: 21, fontWeight: 800, margin: '0 0 2px' }}>Sofia Adeyemi</h3>
              <p style={{ fontSize: 13, opacity: 0.82, margin: '0 0 6px' }}>sofia@shecare.app</p>
              <div style={{ ...row(8) }}>
                <span style={{ fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,0.22)', padding: '3px 10px', borderRadius: 20 }}>✨ Premium</span>
                <span style={{ fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 20 }}>🔥 3-month streak</span>
              </div>
            </div>
          </div>
        </div>

        <Section title="NOTIFICATIONS">
          <SettRow icon="🔔" label="Push Notifications"  sub="All alerts and reminders"    right={<Toggle on={notifs}    onChange={setNotifs}    />} />
          <SettRow icon="📅" label="Period Reminders"    sub="3 days before predicted date" right={<Toggle on={reminders} onChange={setRem}       />} />
          <SettRow icon="🤖" label="Luna AI Insights"    sub="Daily at 8:00 AM"            right={<Toggle on={aiInsights} onChange={setAI}       />} last />
        </Section>

        <Section title="PRIVACY & SECURITY">
          <SettRow icon="👆" label="Biometric Login"     sub="Face ID / Fingerprint"       right={<Toggle on={bio}      onChange={setBio}       />} />
          <SettRow icon="📍" label="Location Sharing"   sub="For emergency SOS"            right={<Toggle on={location}  onChange={setLoc}      />} />
          <SettRow icon="🔒" label="Data Encryption"    sub="End-to-end encrypted"         right={<span style={{ fontSize: 12, fontWeight: 800, color: '#1A6B45' }}>Active ✓</span>} />
          <SettRow icon="📤" label="Export My Data"                                        right={<span style={{ fontSize: 18, color: C.lighter }}>›</span>} last />
        </Section>

        <Section title="APPEARANCE">
          <SettRow icon="🌙" label="Dark Mode"                                             right={<Toggle on={dark}     onChange={setDark}     />} />
          <SettRow icon="🌐" label="Language"            sub="English"                     right={<span style={{ fontSize: 18, color: C.lighter }}>›</span>} last />
        </Section>

        <Section title="SUPPORT">
          <SettRow icon="💬" label="Help Centre"                                           right={<span style={{ fontSize: 18, color: C.lighter }}>›</span>} />
          <SettRow icon="⭐" label="Rate SheCare"                                          right={<span style={{ fontSize: 18, color: C.lighter }}>›</span>} />
          <SettRow icon="📖" label="Privacy Policy"                                        right={<span style={{ fontSize: 18, color: C.lighter }}>›</span>} />
          <SettRow icon="🔔" label="What's New"          sub="v2.1.0"                      right={<span style={{ fontSize: 18, color: C.lighter }}>›</span>} last />
        </Section>

        <button className="btn-press" style={{
          width: '100%', minHeight: 52, borderRadius: 16, marginBottom: 10,
          border: '1.5px solid rgba(239,68,68,0.28)',
          background: 'rgba(239,68,68,0.06)', color: C.red,
          fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>
          Sign Out
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: C.lighter, marginBottom: 16 }}>
          SheCare v2.1.0 · Made with 💗 for every woman
        </p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   BOTTOM NAVIGATION
═══════════════════════════════════════════════════════ */
const NAV: { id: Screen; icon: string; label: string }[] = [
  { id: 'home',     icon: '⌂',  label: 'Home' },
  { id: 'calendar', icon: '◫',  label: 'Cycle' },
  { id: 'journal',  icon: '✎',  label: 'Journal' },
  { id: 'wellness', icon: '✦',  label: 'Wellness' },
  { id: 'settings', icon: '◉',  label: 'Profile' },
]

function BottomNav({ active, go }: { active: Screen; go: (s: Screen) => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430, zIndex: 999,
      background: 'rgba(255,248,240,0.94)',
      backdropFilter: 'blur(24px) saturate(1.5)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
      borderTop: `1px solid ${C.rose}66`,
      boxShadow: '0 -4px 24px rgba(212,165,181,0.16)',
      display: 'flex', padding: '10px 8px 22px',
    }}>
      {NAV.map(item => {
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            onClick={() => go(item.id)}
            className="btn-press"
            style={{
              flex: 1, minHeight: 44, border: 'none', cursor: 'pointer',
              background: 'none', ...col(3, 'center'), justifyContent: 'center',
            }}
          >
            <div style={{
              width: isActive ? 42 : 36, height: 32, borderRadius: 12,
              background: isActive ? `linear-gradient(135deg, ${C.blush}, #D4507A)` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isActive ? 18 : 20,
              boxShadow: isActive ? '0 4px 14px rgba(255,107,138,0.35)' : 'none',
              transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              {isActive
                ? <span style={{ color: '#fff', fontSize: 16, fontWeight: 900 }}>{item.icon}</span>
                : <span style={{ color: C.lighter, fontSize: 20 }}>{item.icon}</span>
              }
            </div>
            <span style={{
              fontSize: 10, fontWeight: isActive ? 800 : 500,
              color: isActive ? C.blush : C.lighter,
              transition: 'color 0.25s ease',
            }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen] = useState<Screen | 'onboarding'>('onboarding')

  const go = (s: Screen) => setScreen(s)

  const showNav = screen !== 'onboarding' && screen !== 'sos' && screen !== 'chat'

  return (
    /* Outer shell — dark surround simulating a phone on a desk */
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', background: '#1A0F14',
      paddingTop: 0,
    }}>
      {/* Phone frame */}
      <div style={{
        width: '100%', maxWidth: 430, minHeight: '100vh',
        background: C.cream, position: 'relative', overflow: 'hidden',
        boxShadow: '0 0 120px rgba(255,107,138,0.15), 0 0 40px rgba(0,0,0,0.40)',
      }}>
        {/* Scrollable screen */}
        <div style={{ height: '100vh', overflowY: screen === 'chat' ? 'hidden' : 'auto' }}>
          {screen === 'onboarding' && <OnboardingScreen onDone={() => setScreen('home')} />}
          {screen === 'home'       && <HomeScreen go={go} />}
          {screen === 'calendar'   && <CalendarScreen />}
          {screen === 'journal'    && <JournalScreen />}
          {screen === 'sos'        && <SOSScreen onBack={() => setScreen('home')} />}
          {screen === 'wellness'   && <WellnessScreen />}
          {screen === 'chat'       && <ChatScreen />}
          {screen === 'settings'   && <SettingsScreen />}
        </div>

        {/* Fixed bottom nav */}
        {showNav && <BottomNav active={screen as Screen} go={go} />}
      </div>
    </div>
  )
}
