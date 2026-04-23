import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

/* ── Google Fonts ────────────────────────────────────────────────────── */
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap'

/* ── Tokens ──────────────────────────────────────────────────────────── */
const T = {
  bg:      '#070b10',
  surface: 'rgba(255,255,255,0.03)',
  border:  'rgba(255,255,255,0.07)',
  teal:    '#00d4aa',
  amber:   '#f0883e',
  violet:  '#7c3aed',
  muted:   'rgba(255,255,255,0.45)',
  faint:   'rgba(255,255,255,0.15)',
}

/* ── useInView ───────────────────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

/* ── FadeIn wrapper ──────────────────────────────────────────────────── */
function FadeIn({ children, delay = 0, className = '' }) {
  const [ref, visible] = useInView()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.65s ease ${delay}s, transform 0.65s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

/* ── Terminal typewriter ─────────────────────────────────────────────── */
const TERMINAL_LINES = [
  { type: 'prompt', text: 'opsiq> What deployed to production in the last hour?' },
  { type: 'tool',   text: '  ↳ github_get_deployments  →  3 results' },
  { type: 'tool',   text: '  ↳ datadog_get_active_alerts  →  2 alerts firing' },
  { type: 'tool',   text: '  ↳ datadog_query_logs  →  scanning last 60 min' },
  { type: 'answer', text: '3 deploys found: api-service v2.4.1, auth-service v1.9.0,' },
  { type: 'answer', text: 'worker v3.1.2. ⚠ api-service latency p99 > 2s correlates' },
  { type: 'answer', text: 'with the 14:32 UTC deploy. Recommend rollback or inspect' },
  { type: 'answer', text: '/checkout endpoint added in PR #847.' },
]

function TerminalCard() {
  const [lineIdx, setLineIdx]   = useState(0)
  const [charIdx, setCharIdx]   = useState(0)
  const [displayed, setDisplayed] = useState([])

  useEffect(() => {
    if (lineIdx >= TERMINAL_LINES.length) {
      const reset = setTimeout(() => {
        setLineIdx(0); setCharIdx(0); setDisplayed([])
      }, 3500)
      return () => clearTimeout(reset)
    }

    const line = TERMINAL_LINES[lineIdx]
    if (charIdx < line.text.length) {
      const speed = line.type === 'prompt' ? 38 : line.type === 'tool' ? 18 : 22
      const t = setTimeout(() => setCharIdx(c => c + 1), speed)
      return () => clearTimeout(t)
    }

    const pause = line.type === 'prompt' ? 400 : line.type === 'tool' ? 120 : 80
    const t = setTimeout(() => {
      setDisplayed(d => [...d, { ...line }])
      setLineIdx(i => i + 1)
      setCharIdx(0)
    }, pause)
    return () => clearTimeout(t)
  }, [lineIdx, charIdx])

  const currentLine = lineIdx < TERMINAL_LINES.length ? TERMINAL_LINES[lineIdx] : null
  const currentText = currentLine ? currentLine.text.slice(0, charIdx) : ''

  const colorFor = (type) => {
    if (type === 'prompt') return T.teal
    if (type === 'tool')   return T.amber
    return 'rgba(255,255,255,0.75)'
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(7,11,16,0.85)',
        border: `1px solid ${T.border}`,
        boxShadow: `0 0 60px rgba(0,212,170,0.07), 0 0 0 1px rgba(0,212,170,0.05)`,
        backdropFilter: 'blur(20px)',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
        <span className="ml-3 text-[11px]" style={{ color: T.muted }}>opsiq — terminal</span>
      </div>
      {/* Body */}
      <div className="p-5 min-h-[260px] text-[12px] leading-relaxed space-y-1">
        {displayed.map((line, i) => (
          <div key={i} style={{ color: colorFor(line.type) }}>{line.text}</div>
        ))}
        {currentLine && (
          <div style={{ color: colorFor(currentLine.type) }}>
            {currentText}
            <span
              className="inline-block w-[7px] h-[14px] align-middle ml-0.5"
              style={{ background: T.teal, animation: 'blink 1s step-end infinite' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Logos marquee ───────────────────────────────────────────────────── */
const LOGOS = ['GitHub', 'Datadog', 'Jira', 'Grafana', 'Slack', 'Confluence', 'Prometheus', 'New Relic', 'PagerDuty', 'OpsGenie']

function LogosBar() {
  const items = [...LOGOS, ...LOGOS]
  return (
    <div className="relative overflow-hidden py-8" style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
      <div
        className="flex gap-12 whitespace-nowrap"
        style={{ animation: 'marquee 28s linear infinite', width: 'max-content' }}
      >
        {items.map((name, i) => (
          <span
            key={i}
            className="text-sm font-medium tracking-wide"
            style={{ color: T.faint, fontFamily: "'DM Sans', sans-serif" }}
          >
            {name}
          </span>
        ))}
      </div>
      {/* Fade masks */}
      <div className="absolute inset-y-0 left-0 w-24 pointer-events-none" style={{ background: `linear-gradient(to right, ${T.bg}, transparent)` }} />
      <div className="absolute inset-y-0 right-0 w-24 pointer-events-none" style={{ background: `linear-gradient(to left, ${T.bg}, transparent)` }} />
    </div>
  )
}

/* ── Feature card ────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: '⚡',
    accent: T.teal,
    title: 'Instant Incident Triage',
    body: 'Correlate alerts, deploys, and code changes in a single query. Cut MTTR from hours to seconds.',
  },
  {
    icon: '📋',
    accent: T.amber,
    title: 'Sprint Intelligence',
    body: '"What\'s blocked and why?" — OpsIQ scans Jira, finds the bottleneck, and summarises in plain English.',
  },
  {
    icon: '📖',
    accent: '#a78bfa',
    title: 'Runbook Lookup',
    body: 'Surface the right Confluence doc for any alert automatically. No more copy-pasting alert names into search.',
  },
  {
    icon: '🤖',
    accent: T.teal,
    title: 'Autonomous Actions',
    body: 'Create Jira tickets, send Slack alerts, acknowledge pages — with your confirmation before anything fires.',
  },
  {
    icon: '💬',
    accent: T.amber,
    title: 'Multi-turn Memory',
    body: 'Follow-up questions remember the full conversation context. No need to repeat yourself.',
  },
  {
    icon: '🔌',
    accent: '#a78bfa',
    title: 'Open & Extensible',
    body: 'Add a new integration in under 30 lines. OpsIQ is designed to grow with your stack.',
  },
]

function FeatureCard({ icon, accent, title, body, delay }) {
  return (
    <FadeIn delay={delay}>
      <div
        className="rounded-2xl p-6 h-full transition-all duration-300"
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = `${accent}44`
          e.currentTarget.style.background = `${accent}08`
          e.currentTarget.style.boxShadow = `0 0 30px ${accent}18`
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = T.border
          e.currentTarget.style.background = T.surface
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-5"
          style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
        >
          {icon}
        </div>
        <h3 className="text-white font-semibold text-[15px] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>{title}</h3>
        <p className="text-[13px] leading-relaxed" style={{ color: T.muted, fontFamily: "'DM Sans', sans-serif" }}>{body}</p>
      </div>
    </FadeIn>
  )
}

/* ── How it works ────────────────────────────────────────────────────── */
const STEPS = [
  {
    n: '01',
    accent: T.teal,
    title: 'Connect your stack',
    body: 'Add your API keys to .env. OpsIQ gracefully skips any tool whose credentials are missing — start with one, add more later.',
  },
  {
    n: '02',
    accent: T.amber,
    title: 'Ask in plain English',
    body: 'No query language. No dashboard hunting. Type your question in Slack, the web UI, or the CLI.',
  },
  {
    n: '03',
    accent: '#a78bfa',
    title: 'Get a synthesised answer',
    body: 'Claude orchestrates your tools, pulls the relevant data, and returns one clear answer with sources cited.',
  },
]

/* ── Pricing ─────────────────────────────────────────────────────────── */
const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    accent: T.teal,
    highlight: false,
    features: [
      'Self-hosted deployment',
      'All integrations',
      'Web + CLI interfaces',
      'Bring your own Anthropic key',
      'Community support',
    ],
    cta: 'Get started free',
    href: 'https://github.com/your-org/opsiq',
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    accent: T.violet,
    highlight: true,
    features: [
      'Everything in Free',
      'Hosted on OpsIQ Cloud',
      'API access included',
      'Slack bot provisioned',
      'Priority support',
    ],
    cta: 'Start free trial',
    href: 'https://opsiq.theinfinityloop.space/pricing',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    accent: T.amber,
    highlight: false,
    features: [
      'Everything in Pro',
      'SSO + audit logs',
      'Custom integrations',
      'Dedicated infra',
      'SLA + dedicated CSM',
    ],
    cta: 'Contact sales',
    href: 'mailto:hello@opsiq.dev',
  },
]

function PricingCard({ plan, delay }) {
  return (
    <FadeIn delay={delay}>
      <div
        className="rounded-2xl p-7 flex flex-col h-full"
        style={{
          background: plan.highlight ? `${plan.accent}14` : T.surface,
          border: `1px solid ${plan.highlight ? plan.accent + '50' : T.border}`,
          boxShadow: plan.highlight ? `0 0 50px ${plan.accent}18` : 'none',
        }}
      >
        {plan.highlight && (
          <div
            className="text-[10px] font-bold uppercase tracking-widest mb-4 px-2 py-1 rounded-full w-fit"
            style={{ background: `${plan.accent}20`, color: plan.accent, border: `1px solid ${plan.accent}40` }}
          >
            Most popular
          </div>
        )}
        <div className="mb-6">
          <p className="text-white font-semibold text-[15px] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>{plan.name}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-white" style={{ fontFamily: "'Syne', sans-serif" }}>{plan.price}</span>
            {plan.period && <span className="text-sm" style={{ color: T.muted }}>{plan.period}</span>}
          </div>
        </div>
        <ul className="space-y-3 flex-1 mb-8">
          {plan.features.map(f => (
            <li key={f} className="flex items-center gap-2.5 text-[13px]" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: plan.accent }}>✓</span>
              {f}
            </li>
          ))}
        </ul>
        <a
          href={plan.href}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-[13px] font-semibold py-3 rounded-xl transition-all duration-200"
          style={{
            background: plan.highlight ? plan.accent : 'transparent',
            color: plan.highlight ? T.bg : plan.accent,
            border: `1px solid ${plan.accent}`,
          }}
          onMouseEnter={e => {
            if (!plan.highlight) {
              e.currentTarget.style.background = `${plan.accent}15`
            }
          }}
          onMouseLeave={e => {
            if (!plan.highlight) {
              e.currentTarget.style.background = 'transparent'
            }
          }}
        >
          {plan.cta}
        </a>
      </div>
    </FadeIn>
  )
}

/* ── Navbar ──────────────────────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(7,11,16,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? `1px solid ${T.border}` : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: T.violet, boxShadow: `0 0 16px ${T.violet}60` }}
          >
            ⚡
          </div>
          <span className="font-bold text-white text-sm tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>OpsIQ</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'How it works', 'Pricing'].map(label => (
            <a
              key={label}
              href={`#${label.toLowerCase().replace(/\s+/g, '-')}`}
              className="text-[13px] transition-colors duration-200"
              style={{ color: T.muted, fontFamily: "'DM Sans', sans-serif" }}
              onMouseEnter={e => e.currentTarget.style.color = 'white'}
              onMouseLeave={e => e.currentTarget.style.color = T.muted}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/your-org/opsiq"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-medium px-4 py-2 rounded-full transition-colors duration-200"
            style={{ color: T.muted, border: `1px solid ${T.border}`, fontFamily: "'DM Sans', sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border }}
          >
            GitHub
          </a>
          <Link
            to="/app"
            className="text-[12px] font-semibold px-4 py-2 rounded-full transition-all duration-200"
            style={{ background: T.teal, color: T.bg, fontFamily: "'DM Sans', sans-serif" }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Launch app →
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* ── Landing ─────────────────────────────────────────────────────────── */
export default function Landing() {
  return (
    <>
      {/* Font injection */}
      <link rel="stylesheet" href={FONT_HREF} />

      {/* Blink keyframe + marquee */}
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes orb-slow { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-20px)} }
      `}</style>

      <div style={{ background: T.bg, minHeight: '100vh', color: 'white', overflowX: 'hidden' }}>
        <Navbar />

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="relative pt-32 pb-24 px-6">
          {/* Glow orb */}
          <div
            className="pointer-events-none absolute"
            style={{
              top: '-80px',
              left: '50%',
              width: '800px',
              height: '600px',
              background: `radial-gradient(ellipse at center, ${T.teal}18 0%, ${T.violet}10 40%, transparent 70%)`,
              filter: 'blur(40px)',
              animation: 'orb-slow 8s ease-in-out infinite',
              zIndex: 0,
            }}
          />

          <div className="relative z-10 max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div>
              <FadeIn>
                <div
                  className="inline-flex items-center gap-2 text-[11px] font-medium px-3 py-1.5 rounded-full mb-8"
                  style={{ background: `${T.teal}12`, border: `1px solid ${T.teal}30`, color: T.teal, fontFamily: "'DM Sans', sans-serif" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.teal, boxShadow: `0 0 6px ${T.teal}` }} />
                  Built on Claude · Open source
                </div>
              </FadeIn>
              <FadeIn delay={0.1}>
                <h1
                  className="font-black leading-[1.05] tracking-tight mb-6"
                  style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(2.6rem, 5vw, 3.8rem)' }}
                >
                  Ask your{' '}
                  <span style={{ color: T.teal }}>infrastructure</span>
                  {' '}anything.
                </h1>
              </FadeIn>
              <FadeIn delay={0.2}>
                <p className="text-[16px] leading-relaxed mb-10" style={{ color: T.muted, fontFamily: "'DM Sans', sans-serif", maxWidth: '420px' }}>
                  OpsIQ connects to GitHub, Jira, Datadog, Confluence and Slack — then answers questions about your stack in seconds, without leaving your terminal or chat.
                </p>
              </FadeIn>
              <FadeIn delay={0.3}>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/app"
                    className="inline-flex items-center gap-2 text-[13px] font-semibold px-6 py-3 rounded-full transition-all duration-200"
                    style={{ background: T.teal, color: T.bg, fontFamily: "'DM Sans', sans-serif", boxShadow: `0 0 30px ${T.teal}40` }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 50px ${T.teal}60`}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = `0 0 30px ${T.teal}40`}
                  >
                    Try it live →
                  </Link>
                  <a
                    href="https://github.com/your-org/opsiq"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-[13px] font-medium px-6 py-3 rounded-full transition-all duration-200"
                    style={{ color: 'rgba(255,255,255,0.7)', border: `1px solid ${T.border}`, fontFamily: "'DM Sans', sans-serif" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'white' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
                  >
                    ★ Star on GitHub
                  </a>
                </div>
              </FadeIn>
            </div>

            {/* Right — terminal */}
            <FadeIn delay={0.2}>
              <TerminalCard />
            </FadeIn>
          </div>
        </section>

        {/* ── Logos ──────────────────────────────────────────────────── */}
        <LogosBar />

        {/* ── Features ───────────────────────────────────────────────── */}
        <section id="features" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <FadeIn>
              <div className="text-center mb-16">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4" style={{ color: T.teal, fontFamily: "'DM Sans', sans-serif" }}>
                  Capabilities
                </p>
                <h2
                  className="font-black text-white leading-tight mb-4"
                  style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(2rem, 3.5vw, 2.8rem)' }}
                >
                  Everything your on-call engineer does,<br />in seconds.
                </h2>
                <p className="text-[15px]" style={{ color: T.muted, fontFamily: "'DM Sans', sans-serif" }}>
                  OpsIQ orchestrates your existing tools — no new dashboards, no new logins.
                </p>
              </div>
            </FadeIn>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.title} {...f} delay={i * 0.07} />
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────────── */}
        <section id="how-it-works" className="py-24 px-6" style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="max-w-4xl mx-auto">
            <FadeIn>
              <div className="text-center mb-16">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4" style={{ color: T.amber, fontFamily: "'DM Sans', sans-serif" }}>
                  How it works
                </p>
                <h2
                  className="font-black text-white"
                  style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(2rem, 3.5vw, 2.8rem)' }}
                >
                  Up and running in 3 steps.
                </h2>
              </div>
            </FadeIn>
            <div className="space-y-6">
              {STEPS.map((step, i) => (
                <FadeIn key={step.n} delay={i * 0.1}>
                  <div
                    className="rounded-2xl p-7 flex gap-7 items-start"
                    style={{ background: T.surface, border: `1px solid ${T.border}` }}
                  >
                    <div
                      className="shrink-0 text-2xl font-black leading-none mt-1"
                      style={{ fontFamily: "'Syne', sans-serif", color: step.accent, opacity: 0.6 }}
                    >
                      {step.n}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-[16px] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>{step.title}</h3>
                      <p className="text-[14px] leading-relaxed" style={{ color: T.muted, fontFamily: "'DM Sans', sans-serif" }}>{step.body}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Code snippet */}
            <FadeIn delay={0.3}>
              <div
                className="mt-10 rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${T.border}`, fontFamily: "'JetBrains Mono', monospace" }}
              >
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.02)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
                  <span className="ml-2 text-[11px]" style={{ color: T.muted }}>quick start</span>
                </div>
                <div className="p-5 text-[12px] leading-loose" style={{ background: 'rgba(7,11,16,0.6)' }}>
                  <div><span style={{ color: T.muted }}>$</span> <span style={{ color: T.teal }}>git clone</span> <span style={{ color: 'rgba(255,255,255,0.6)' }}>https://github.com/your-org/opsiq</span></div>
                  <div><span style={{ color: T.muted }}>$</span> <span style={{ color: T.teal }}>cp</span> <span style={{ color: 'rgba(255,255,255,0.6)' }}>.env.example .env</span> <span style={{ color: T.muted }}># add your keys</span></div>
                  <div><span style={{ color: T.muted }}>$</span> <span style={{ color: T.teal }}>docker-compose up</span></div>
                  <div className="mt-2"><span style={{ color: T.muted }}># API ready at http://localhost:8000</span></div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────────────────── */}
        <section id="pricing" className="py-24 px-6" style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="max-w-5xl mx-auto">
            <FadeIn>
              <div className="text-center mb-16">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4" style={{ color: '#a78bfa', fontFamily: "'DM Sans', sans-serif" }}>
                  Pricing
                </p>
                <h2
                  className="font-black text-white mb-4"
                  style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(2rem, 3.5vw, 2.8rem)' }}
                >
                  Free to self-host.<br />Managed if you need it.
                </h2>
                <p className="text-[15px]" style={{ color: T.muted, fontFamily: "'DM Sans', sans-serif" }}>
                  No surprise bills. Bring your own Anthropic key when self-hosting.
                </p>
              </div>
            </FadeIn>
            <div className="grid md:grid-cols-3 gap-5">
              {PLANS.map((plan, i) => (
                <PricingCard key={plan.name} plan={plan} delay={i * 0.1} />
              ))}
            </div>
          </div>
        </section>

        {/* ── About / Open source ────────────────────────────────────── */}
        <section className="py-24 px-6" style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <FadeIn>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-5" style={{ color: T.teal, fontFamily: "'DM Sans', sans-serif" }}>
                Open source
              </p>
              <h2
                className="font-black text-white leading-tight mb-6"
                style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(1.8rem, 3vw, 2.5rem)' }}
              >
                Built in the open.<br />Owned by you.
              </h2>
              <p className="text-[15px] leading-relaxed mb-8" style={{ color: T.muted, fontFamily: "'DM Sans', sans-serif" }}>
                OpsIQ is open-source under BSL 1.1 — free for personal and community use. Read the code, fork it, extend it. Adding a new integration takes under 30 lines.
              </p>
              <div className="flex gap-3">
                <a
                  href="https://github.com/your-org/opsiq"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-[13px] font-semibold px-5 py-2.5 rounded-full transition-all duration-200"
                  style={{ background: `${T.teal}14`, color: T.teal, border: `1px solid ${T.teal}40`, fontFamily: "'DM Sans', sans-serif" }}
                  onMouseEnter={e => e.currentTarget.style.background = `${T.teal}22`}
                  onMouseLeave={e => e.currentTarget.style.background = `${T.teal}14`}
                >
                  View on GitHub →
                </a>
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <div
                className="rounded-2xl p-6"
                style={{ background: 'rgba(7,11,16,0.7)', border: `1px solid ${T.border}`, fontFamily: "'JetBrains Mono', monospace" }}
              >
                <div className="text-[11px] mb-4" style={{ color: T.muted }}>integrations/my_tool_client.py</div>
                <div className="text-[12px] leading-loose">
                  <div><span style={{ color: '#a78bfa' }}>def</span> <span style={{ color: T.teal }}>my_tool_search</span><span style={{ color: 'rgba(255,255,255,0.5)' }}>(query: str) -&gt; dict:</span></div>
                  <div className="pl-4"><span style={{ color: T.muted }}># 1. Call your API</span></div>
                  <div className="pl-4"><span style={{ color: 'rgba(255,255,255,0.6)' }}>resp = requests.get(MY_API, params=&#123;&#125;)</span></div>
                  <div className="pl-4"><span style={{ color: T.muted }}># 2. Return structured data</span></div>
                  <div className="pl-4"><span style={{ color: '#a78bfa' }}>return</span> <span style={{ color: 'rgba(255,255,255,0.6)' }}>resp.json()</span></div>
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                    <div style={{ color: T.amber }}># Add to agent/tools.py — done.</div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── CTA Banner ─────────────────────────────────────────────── */}
        <section className="py-20 px-6">
          <FadeIn>
            <div
              className="max-w-3xl mx-auto rounded-3xl p-12 text-center relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${T.teal}12, ${T.violet}10)`,
                border: `1px solid ${T.teal}30`,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${T.teal}15, transparent 60%)`,
                }}
              />
              <h2
                className="relative font-black text-white mb-5"
                style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(1.8rem, 3vw, 2.5rem)' }}
              >
                Stop hunting dashboards.
              </h2>
              <p className="relative text-[15px] mb-8" style={{ color: T.muted, fontFamily: "'DM Sans', sans-serif" }}>
                Ask your infrastructure anything — in plain English.
              </p>
              <div className="relative flex flex-wrap justify-center gap-3">
                <Link
                  to="/app"
                  className="inline-flex items-center gap-2 text-[13px] font-bold px-7 py-3.5 rounded-full transition-all duration-200"
                  style={{ background: T.teal, color: T.bg, fontFamily: "'DM Sans', sans-serif", boxShadow: `0 0 40px ${T.teal}40` }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 60px ${T.teal}60`}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = `0 0 40px ${T.teal}40`}
                >
                  Try OpsIQ free →
                </Link>
                <a
                  href="https://github.com/your-org/opsiq"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-[13px] font-medium px-7 py-3.5 rounded-full transition-all duration-200"
                  style={{ color: 'rgba(255,255,255,0.65)', border: `1px solid ${T.border}`, fontFamily: "'DM Sans', sans-serif" }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; e.currentTarget.style.borderColor = T.border }}
                >
                  Self-host for free
                </a>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="px-6 py-12" style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                style={{ background: T.violet }}
              >⚡</div>
              <span className="text-sm font-semibold text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>OpsIQ</span>
              <span className="text-[12px]" style={{ color: T.muted, fontFamily: "'DM Sans', sans-serif" }}>— AI-powered DevOps intelligence</span>
            </div>
            <div className="flex items-center gap-8">
              {[
                { label: 'GitHub', href: 'https://github.com/your-org/opsiq' },
                { label: 'Docs', href: 'https://github.com/your-org/opsiq#readme' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'License', href: 'https://github.com/your-org/opsiq/blob/main/LICENSE' },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noreferrer' : undefined}
                  className="text-[12px] transition-colors"
                  style={{ color: T.muted, fontFamily: "'DM Sans', sans-serif" }}
                  onMouseEnter={e => e.currentTarget.style.color = 'white'}
                  onMouseLeave={e => e.currentTarget.style.color = T.muted}
                >
                  {label}
                </a>
              ))}
            </div>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)', fontFamily: "'DM Sans', sans-serif" }}>
              © {new Date().getFullYear()} OpsIQ. BSL 1.1.
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}
