import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'

/* ── Design tokens ───────────────────────────────────────────────────── */
const T = {
  bg:     '#070b10',
  teal:   '#00d4aa',
  amber:  '#f0883e',
  violet: '#7c3aed',
  muted:  'rgba(255,255,255,0.45)',
  faint:  'rgba(255,255,255,0.15)',
  border: 'rgba(255,255,255,0.07)',
  surface:'rgba(255,255,255,0.03)',
}

/* ── useInView ───────────────────────────────────────────────────────── */
function useInView(threshold = 0.12) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

function FadeIn({ children, delay = 0, className = '' }) {
  const [ref, visible] = useInView()
  return (
    <div ref={ref} className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(26px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}>
      {children}
    </div>
  )
}

/* ── Terminal typewriter ─────────────────────────────────────────────── */
const LINES = [
  { t: 'prompt', s: 'opsiq> What deployed to prod in the last hour?' },
  { t: 'tool',   s: '  ↳ github_get_deployments  →  3 results' },
  { t: 'tool',   s: '  ↳ datadog_get_active_alerts  →  2 firing' },
  { t: 'tool',   s: '  ↳ datadog_query_logs  →  scanning 60 min' },
  { t: 'out',    s: '3 deploys: api-service v2.4.1, auth-service v1.9.0,' },
  { t: 'out',    s: 'worker v3.1.2. ⚠ api-service p99 > 2s correlates' },
  { t: 'out',    s: 'with the 14:32 deploy. Inspect /checkout — PR #847.' },
]
const LINE_COLOR = { prompt: '#00d4aa', tool: '#f0883e', out: 'rgba(255,255,255,0.75)' }
const LINE_SPEED = { prompt: 36, tool: 16, out: 20 }
const LINE_PAUSE = { prompt: 380, tool: 100, out: 60 }

function TerminalCard() {
  const [lineIdx, setLineIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [done, setDone] = useState([])

  useEffect(() => {
    if (lineIdx >= LINES.length) {
      const t = setTimeout(() => { setLineIdx(0); setCharIdx(0); setDone([]) }, 3200)
      return () => clearTimeout(t)
    }
    const line = LINES[lineIdx]
    if (charIdx < line.s.length) {
      const t = setTimeout(() => setCharIdx(c => c + 1), LINE_SPEED[line.t])
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setDone(d => [...d, line])
      setLineIdx(i => i + 1)
      setCharIdx(0)
    }, LINE_PAUSE[line.t])
    return () => clearTimeout(t)
  }, [lineIdx, charIdx])

  const current = lineIdx < LINES.length ? LINES[lineIdx] : null

  return (
    <div className="rounded-2xl overflow-hidden font-mono text-[12px]"
      style={{ background: 'rgba(5,9,14,0.9)', border: `1px solid ${T.border}`, boxShadow: '0 0 60px rgba(0,212,170,0.06), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-1.5 px-4 py-3"
        style={{ borderBottom: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.02)' }}>
        <span className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
        <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
        <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
        <span className="ml-3 text-[11px] font-sans" style={{ color: T.muted }}>opsiq — terminal</span>
      </div>
      <div className="p-5 min-h-[240px] space-y-1 leading-relaxed">
        {done.map((l, i) => (
          <div key={i} style={{ color: LINE_COLOR[l.t] }}>{l.s}</div>
        ))}
        {current && (
          <div style={{ color: LINE_COLOR[current.t] }}>
            {current.s.slice(0, charIdx)}
            <span className="inline-block w-[6px] h-[13px] align-middle ml-px"
              style={{ background: T.teal, animation: 'blink 1s step-end infinite' }} />
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Tech quotes marquee ─────────────────────────────────────────────── */
const QUOTES = [
  { q: '"The first rule of any technology is that automation applied to an efficient operation magnifies efficiency."', a: '— Bill Gates' },
  { q: '"Move fast and fix things. 🛠️"', a: '— OpsIQ team' },
  { q: '"It\'s not a bug — it\'s an undocumented feature. 🐛"', a: '— Ancient dev proverb' },
  { q: '"Any sufficiently advanced monitoring is indistinguishable from magic. ✨"', a: '— SRE wisdom' },
  { q: '"On-call at 3am builds character. OpsIQ lets you sleep. 😴"', a: '— OpsIQ team' },
  { q: '"You can\'t manage what you can\'t measure. 📊"', a: '— Peter Drucker' },
  { q: '"The cloud is just someone else\'s computer. ☁️ Make sure it\'s working."', a: '— DevOps proverb' },
]

function QuotesBar() {
  const items = [...QUOTES, ...QUOTES]
  return (
    <div className="relative overflow-hidden py-6"
      style={{ borderBottom: `1px solid ${T.border}`, background: 'rgba(0,212,170,0.02)' }}>
      <div className="flex gap-16 whitespace-nowrap items-center"
        style={{ animation: 'marquee 55s linear infinite', width: 'max-content' }}>
        {items.map(({ q, a }, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-[12px] font-sans shrink-0"
            style={{ color: 'rgba(255,255,255,0.35)', maxWidth: '420px' }}>
            <span style={{ color: T.teal, opacity: 0.6, fontSize: '16px' }}>"</span>
            <span className="truncate" style={{ maxWidth: '360px' }}>{q}</span>
            <span style={{ color: T.amber, opacity: 0.7, whiteSpace: 'nowrap' }}>{a}</span>
            <span className="mx-6" style={{ color: 'rgba(255,255,255,0.1)' }}>✦</span>
          </span>
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 w-20 pointer-events-none"
        style={{ background: `linear-gradient(to right, ${T.bg}, transparent)` }} />
      <div className="absolute inset-y-0 right-0 w-20 pointer-events-none"
        style={{ background: `linear-gradient(to left, ${T.bg}, transparent)` }} />
    </div>
  )
}

/* ── Logos marquee ───────────────────────────────────────────────────── */
const LOGOS = ['GitHub','Datadog','Jira','Grafana','Slack','Confluence','Prometheus','New Relic','PagerDuty','OpsGenie']

function LogosBar() {
  const items = [...LOGOS, ...LOGOS]
  return (
    <div className="relative overflow-hidden py-7"
      style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
      <div className="flex gap-14 whitespace-nowrap"
        style={{ animation: 'marquee 30s linear infinite', width: 'max-content' }}>
        {items.map((name, i) => (
          <span key={i} className="text-sm font-medium tracking-wide font-sans" style={{ color: T.faint }}>{name}</span>
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 w-24 pointer-events-none"
        style={{ background: `linear-gradient(to right, ${T.bg}, transparent)` }} />
      <div className="absolute inset-y-0 right-0 w-24 pointer-events-none"
        style={{ background: `linear-gradient(to left, ${T.bg}, transparent)` }} />
    </div>
  )
}

/* ── Features section ────────────────────────────────────────────────── */
const ALL_FEATURES = [
  { icon: '🚨', accent: '#00d4aa', cat: 'Incident',   title: 'Instant Triage',      body: 'Correlate alerts, deploys, and code changes in one query. Cut MTTR from hours ⏱ to seconds.' },
  { icon: '🗂️', accent: '#f0883e', cat: 'Knowledge',  title: 'Sprint Intelligence', body: '"What\'s blocked and why?" 🤔 OpsIQ scans Jira, finds the bottleneck, answers in plain English.' },
  { icon: '📖', accent: '#a78bfa', cat: 'Knowledge',  title: 'Runbook Lookup',      body: 'Surface the right Confluence doc for any alert 🔍 automatically. No more copy-pasting into search.' },
  { icon: '🤖', accent: '#00d4aa', cat: 'Automation', title: 'Autonomous Actions',  body: 'Create Jira tickets, send Slack pings 📣, acknowledge pages — always with your 👍 confirmation first.' },
  { icon: '🧠', accent: '#f0883e', cat: 'Incident',   title: 'Multi-turn Memory',   body: 'Ask follow-ups naturally 💬 — OpsIQ remembers your full session context. No repeating yourself.' },
  { icon: '🔌', accent: '#a78bfa', cat: 'Automation', title: 'Open & Extensible',   body: 'New integration in under 30 lines 🛠️. Fork it, extend it, make it yours. PRs welcome!' },
]
const FEATURE_TABS = ['All', 'Incident', 'Automation', 'Knowledge']

function FeatureCard({ icon, accent, title, body, delay }) {
  const [ref, visible] = useInView()
  return (
    <div ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.55s ease ${delay}s, transform 0.55s ease ${delay}s`,
      }}>
      <div className="rounded-2xl p-6 h-full transition-all duration-300 cursor-default"
        style={{ background: T.surface, border: `1px solid ${T.border}` }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = `${accent}44`
          e.currentTarget.style.background  = `${accent}08`
          e.currentTarget.style.boxShadow   = `0 0 28px ${accent}14`
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = T.border
          e.currentTarget.style.background  = T.surface
          e.currentTarget.style.boxShadow   = 'none'
        }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-5"
          style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
          {icon}
        </div>
        <h3 className="text-white font-semibold text-[15px] mb-2 font-sans">{title}</h3>
        <p className="text-[13px] leading-relaxed font-sans" style={{ color: T.muted }}>{body}</p>
      </div>
    </div>
  )
}

function FeaturesSection() {
  const [active, setActive] = useState('All')
  const filtered = active === 'All' ? ALL_FEATURES : ALL_FEATURES.filter(f => f.cat === active)
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4 font-sans" style={{ color: T.teal }}>
              Capabilities
            </p>
            <h2 className="font-syne font-bold text-white leading-tight mb-4"
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', letterSpacing: '-0.02em' }}>
              Everything your on-call engineer does,<br className="hidden md:block" /> in seconds. ⚡
            </h2>
            <p className="text-[15px] font-sans" style={{ color: T.muted }}>
              OpsIQ orchestrates your existing tools — no new dashboards, no new logins.
            </p>
          </div>
        </FadeIn>

        {/* Category tabs */}
        <FadeIn delay={0.05}>
          <div className="flex justify-center gap-2 mb-10 flex-wrap">
            {FEATURE_TABS.map(tab => (
              <button key={tab} onClick={() => setActive(tab)}
                className="text-[12px] font-medium font-sans px-4 py-1.5 rounded-full transition-all duration-200"
                style={{
                  background: active === tab ? `${T.teal}18` : 'transparent',
                  color: active === tab ? T.teal : T.muted,
                  border: `1px solid ${active === tab ? T.teal + '50' : T.border}`,
                }}>
                {tab}
              </button>
            ))}
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.06} />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── How it works ────────────────────────────────────────────────────── */
const STEPS = [
  { n: '01', emoji: '🔑', accent: T.teal,   title: 'Connect your stack',      body: 'Drop your API keys in .env — GitHub, Datadog, Jira, whatever you have. OpsIQ skips anything missing. Start with one tool 🛠️, add the rest later.' },
  { n: '02', emoji: '💬', accent: T.amber,  title: 'Ask in plain English',     body: 'No dashboards, no query language, no hunting. Type your question in Slack, the web UI, or just the CLI. Even "what\'s on fire right now? 🔥" works.' },
  { n: '03', emoji: '✨', accent: '#a78bfa',title: 'Get a synthesised answer', body: 'Claude orchestrates your tools, pulls the relevant data 📊, and hands you one clear answer — with every source cited so you can drill in.' },
]

/* ── Pricing ─────────────────────────────────────────────────────────── */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const BASE_PLANS = [
  { name: 'Free',       accent: '#00d4aa', highlight: false, cta: 'Get started free',
    ctaHref: 'https://github.com/nshivakumar1/opsiq', ctaAction: null,
    features: ['Self-hosted deployment','All integrations','Web + CLI interfaces','Bring your own Anthropic key','Community support'],
    monthly: '$0', annual: '$0', annualNote: '' },
  { name: 'Pro',        accent: '#7c3aed', highlight: true,  cta: 'Start free trial →',
    ctaHref: null, ctaAction: 'checkout',
    features: ['Everything in Free','Hosted on OpsIQ Cloud','2,000 queries/month','API access included','Priority support'],
    monthly: '$49', annual: '$39', annualNote: 'billed annually ($468/yr)' },
  { name: 'Enterprise', accent: '#f0883e', highlight: false, cta: 'Contact sales',
    ctaHref: 'mailto:hello@opsiq.dev', ctaAction: null,
    features: ['Everything in Pro','SSO + audit logs','Custom integrations','Dedicated infra','SLA + dedicated CSM'],
    monthly: 'Custom', annual: 'Custom', annualNote: '' },
]

function PricingCard({ plan, annual, delay, onProClick }) {
  const [ref, visible] = useInView()
  const price = annual ? plan.annual : plan.monthly

  const isProAction = plan.ctaAction === 'checkout'

  return (
    <div ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.55s ease ${delay}s, transform 0.55s ease ${delay}s`,
      }}>
      <div className="rounded-2xl p-7 flex flex-col h-full"
        style={{
          background: plan.highlight ? `${plan.accent}12` : T.surface,
          border: `1px solid ${plan.highlight ? plan.accent + '50' : T.border}`,
          boxShadow: plan.highlight ? `0 0 50px ${plan.accent}14` : 'none',
        }}>
        {plan.highlight && (
          <div className="text-[10px] font-bold uppercase tracking-widest mb-4 px-2 py-1 rounded-full w-fit font-sans"
            style={{ background: `${plan.accent}20`, color: plan.accent, border: `1px solid ${plan.accent}40` }}>
            Most popular
          </div>
        )}
        <div className="mb-6">
          <p className="text-white font-semibold text-[15px] mb-2 font-sans">{plan.name}</p>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-syne font-black text-white text-4xl">{price}</span>
            {price !== 'Custom' && (
              <span className="text-sm font-sans" style={{ color: T.muted }}>/mo</span>
            )}
            {annual && plan.name === 'Pro' && (
              <span className="text-[10px] font-semibold font-sans px-1.5 py-0.5 rounded-full"
                style={{ background: `${T.teal}20`, color: T.teal, border: `1px solid ${T.teal}30` }}>
                −20%
              </span>
            )}
          </div>
          {annual && plan.annualNote && (
            <p className="text-[11px] mt-1 font-sans" style={{ color: T.muted }}>{plan.annualNote}</p>
          )}
        </div>
        <ul className="space-y-3 flex-1 mb-8">
          {plan.features.map(f => (
            <li key={f} className="flex items-center gap-2.5 text-[13px] font-sans" style={{ color: 'rgba(255,255,255,0.7)' }}>
              <span style={{ color: plan.accent }}>✓</span>{f}
            </li>
          ))}
        </ul>

        {isProAction ? (
          <button
            onClick={onProClick}
            className="block w-full text-center text-[13px] font-semibold font-sans py-3 rounded-xl transition-all duration-200"
            style={{ background: plan.accent, color: '#070b10', border: `1px solid ${plan.accent}`, cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            {plan.cta}
          </button>
        ) : (
          <a href={plan.ctaHref} target="_blank" rel="noreferrer"
            className="block text-center text-[13px] font-semibold font-sans py-3 rounded-xl transition-all duration-200"
            style={{ background: 'transparent', color: plan.accent, border: `1px solid ${plan.accent}` }}
            onMouseEnter={e => e.currentTarget.style.background = `${plan.accent}15`}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {plan.cta}
          </a>
        )}
      </div>
    </div>
  )
}

function PricingSection() {
  const [annual, setAnnual] = useState(false)
  const [loading, setLoading] = useState(false)
  const { isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0()
  const navigate = useNavigate()

  async function handleProClick() {
    if (!isAuthenticated) {
      loginWithRedirect({ appState: { returnTo: '/app?upgrade=true' } })
      return
    }
    setLoading(true)
    try {
      const token = await getAccessTokenSilently()
      const res   = await fetch(`${API_BASE}/cloud/billing/checkout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ plan: 'pro' }),
      })
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        navigate('/app')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      navigate('/app')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="pricing" className="py-24 px-6" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4 font-sans" style={{ color: '#a78bfa' }}>
              Pricing
            </p>
            <h2 className="font-syne font-bold text-white mb-4"
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', letterSpacing: '-0.02em' }}>
              Free to self-host. 🆓<br />Managed if you need it.
            </h2>
            <p className="text-[15px] font-sans mb-8" style={{ color: T.muted }}>
              No surprise bills. Bring your own Anthropic key when self-hosting.
            </p>
            {/* Billing toggle */}
            <div className="inline-flex items-center gap-1 p-1 rounded-full"
              style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              {[['Monthly', false], ['Annual', true]].map(([label, val]) => (
                <button key={label} onClick={() => setAnnual(val)}
                  className="text-[12px] font-medium font-sans px-5 py-1.5 rounded-full transition-all duration-200"
                  style={{
                    background: annual === val ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: annual === val ? 'white' : T.muted,
                  }}>
                  {label}
                  {label === 'Annual' && (
                    <span className="ml-1.5 text-[10px]" style={{ color: T.teal }}>−20%</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </FadeIn>
        <div className="grid md:grid-cols-3 gap-5">
          {BASE_PLANS.map((plan, i) => (
            <PricingCard
              key={plan.name}
              plan={plan}
              annual={annual}
              delay={i * 0.1}
              onProClick={loading ? undefined : handleProClick}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Navbar ──────────────────────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const { isAuthenticated, loginWithRedirect } = useAuth0()
  const navigate = useNavigate()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  function handleLaunch() {
    if (isAuthenticated) navigate('/app')
    else loginWithRedirect()
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(7,11,16,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? `1px solid ${T.border}` : '1px solid transparent',
      }}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: T.violet, boxShadow: `0 0 16px ${T.violet}60` }}>⚡</div>
          <span className="font-syne font-bold text-white text-sm tracking-tight">OpsIQ</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {[['Features','#features'],['How it works','#how-it-works'],['Pricing','#pricing']].map(([label, href]) => (
            <a key={label} href={href}
              className="text-[13px] font-sans transition-colors duration-200"
              style={{ color: T.muted }}
              onMouseEnter={e => e.currentTarget.style.color = 'white'}
              onMouseLeave={e => e.currentTarget.style.color = T.muted}>
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a href="https://github.com/your-org/opsiq" target="_blank" rel="noreferrer"
            className="text-[12px] font-medium font-sans px-4 py-2 rounded-full transition-colors duration-200"
            style={{ color: T.muted, border: `1px solid ${T.border}` }}
            onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border }}>
            GitHub
          </a>
          <button
            onClick={handleLaunch}
            className="text-[12px] font-semibold font-sans px-4 py-2 rounded-full transition-opacity duration-200"
            style={{ background: T.teal, color: T.bg, border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            {isAuthenticated ? 'Open app →' : 'Get started free →'}
          </button>
        </div>
      </div>
    </nav>
  )
}

/* ── Landing page ────────────────────────────────────────────────────── */
export default function Landing() {
  const { isAuthenticated, loginWithRedirect } = useAuth0()
  const navigate = useNavigate()

  function handleCta() {
    if (isAuthenticated) navigate('/app')
    else loginWithRedirect()
  }

  return (
    <div style={{ background: T.bg, color: 'white', overflowX: 'hidden' }}>
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div style={{
            position: 'absolute', top: '-100px', left: '50%',
            width: '900px', height: '600px',
            background: 'radial-gradient(ellipse at center, rgba(0,212,170,0.13) 0%, rgba(124,58,237,0.07) 45%, transparent 70%)',
            filter: 'blur(50px)',
            transform: 'translateX(-50%)',
          }} />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          {/* Left copy */}
          <div>
            <FadeIn>
              <div className="inline-flex items-center gap-2 text-[11px] font-medium font-sans px-3 py-1.5 rounded-full mb-8"
                style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.28)', color: T.teal }}>
                <span className="w-1.5 h-1.5 rounded-full"
                  style={{ background: T.teal, boxShadow: `0 0 6px ${T.teal}` }} />
                🤖 Built on Claude · Open source
              </div>
            </FadeIn>
            <FadeIn delay={0.08}>
              <h1 className="font-syne font-bold leading-[1.1] mb-6"
                style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.02em' }}>
                Ask your{' '}
                <span style={{ color: T.teal }}>infrastructure</span>
                {' '}anything. 🔍
              </h1>
            </FadeIn>
            <FadeIn delay={0.16}>
              <p className="text-[16px] leading-relaxed font-sans mb-10"
                style={{ color: T.muted, maxWidth: '420px' }}>
                OpsIQ connects to GitHub, Jira, Datadog, Confluence and Slack ⚡ — then answers questions about your stack in seconds, without leaving your terminal or chat.
              </p>
            </FadeIn>
            <FadeIn delay={0.22}>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleCta}
                  className="inline-flex items-center gap-2 text-[13px] font-semibold font-sans px-6 py-3 rounded-full transition-all duration-200"
                  style={{ background: T.teal, color: T.bg, boxShadow: '0 0 32px rgba(0,212,170,0.35)', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 52px rgba(0,212,170,0.52)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 32px rgba(0,212,170,0.35)'}>
                  {isAuthenticated ? 'Open app →' : 'Get started free →'}
                </button>
                <a href="https://github.com/your-org/opsiq" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-[13px] font-medium font-sans px-6 py-3 rounded-full transition-all duration-200"
                  style={{ color: 'rgba(255,255,255,0.7)', border: `1px solid ${T.border}` }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'white' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}>
                  ★ Star on GitHub
                </a>
              </div>
            </FadeIn>
          </div>

          {/* Right — terminal */}
          <FadeIn delay={0.18}>
            <TerminalCard />
          </FadeIn>
        </div>
      </section>

      <LogosBar />
      <QuotesBar />
      <FeaturesSection />

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6" style={{ borderTop: `1px solid ${T.border}` }}>
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-4 font-sans" style={{ color: T.amber }}>
                How it works
              </p>
              <h2 className="font-syne font-bold text-white"
                style={{ fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', letterSpacing: '-0.02em' }}>
                Up and running in 3 steps. 🚀
              </h2>
            </div>
          </FadeIn>
          <div className="space-y-5">
            {STEPS.map((step, i) => (
              <FadeIn key={step.n} delay={i * 0.1}>
                <div className="rounded-2xl p-7 flex gap-7 items-start"
                  style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <div className="shrink-0 flex flex-col items-center gap-1 mt-0.5">
                    <span className="text-xl leading-none">{step.emoji}</span>
                    <span className="font-syne font-bold text-[11px]"
                      style={{ color: step.accent, opacity: 0.6, letterSpacing: '0.05em' }}>{step.n}</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-[16px] mb-2 font-sans">{step.title}</h3>
                    <p className="text-[14px] leading-relaxed font-sans" style={{ color: T.muted }}>{step.body}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={0.3}>
            <div className="mt-10 rounded-2xl overflow-hidden font-mono text-[12px]"
              style={{ border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-1.5 px-4 py-3"
                style={{ borderBottom: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.02)' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
                <span className="ml-2 text-[11px] font-sans" style={{ color: T.muted }}>quick start</span>
              </div>
              <div className="p-5 leading-loose" style={{ background: 'rgba(5,9,14,0.8)' }}>
                <div><span style={{ color: T.muted }}>$</span> <span style={{ color: T.teal }}>git clone</span> <span style={{ color: 'rgba(255,255,255,0.55)' }}>https://github.com/your-org/opsiq</span></div>
                <div><span style={{ color: T.muted }}>$</span> <span style={{ color: T.teal }}>cp</span> <span style={{ color: 'rgba(255,255,255,0.55)' }}>.env.example .env</span> <span style={{ color: T.muted }}># add your keys</span></div>
                <div><span style={{ color: T.muted }}>$</span> <span style={{ color: T.teal }}>docker-compose up</span></div>
                <div className="mt-2" style={{ color: T.muted }}># API ready at http://localhost:8000</div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <PricingSection />

      {/* ── About / OSS ──────────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ borderTop: `1px solid ${T.border}` }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-5 font-sans" style={{ color: T.teal }}>
              Open source
            </p>
            <h2 className="font-syne font-bold text-white leading-tight mb-6"
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', letterSpacing: '-0.02em' }}>
              Built in the open. 🔓<br />Owned by you.
            </h2>
            <p className="text-[15px] leading-relaxed font-sans mb-8" style={{ color: T.muted }}>
              OpsIQ is open-source under BSL 1.1 — free for personal and community use. Read the code, fork it, extend it. Adding a new integration takes under 30 lines.
            </p>
            <a href="https://github.com/your-org/opsiq" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-[13px] font-semibold font-sans px-5 py-2.5 rounded-full transition-all duration-200"
              style={{ background: 'rgba(0,212,170,0.12)', color: T.teal, border: '1px solid rgba(0,212,170,0.35)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,170,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,212,170,0.12)'}>
              View on GitHub →
            </a>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="rounded-2xl p-6 font-mono text-[12px]"
              style={{ background: 'rgba(5,9,14,0.8)', border: `1px solid ${T.border}` }}>
              <div className="text-[11px] mb-4 font-sans" style={{ color: T.muted }}>integrations/my_tool_client.py</div>
              <div className="leading-loose">
                <div><span style={{ color: '#a78bfa' }}>def</span> <span style={{ color: T.teal }}>my_tool_search</span><span style={{ color: 'rgba(255,255,255,0.45)' }}>(query: str) -&gt; dict:</span></div>
                <div className="pl-5" style={{ color: T.muted }}># 1. Call your API</div>
                <div className="pl-5" style={{ color: 'rgba(255,255,255,0.6)' }}>resp = requests.get(MY_API, params=&#123;&#125;)</div>
                <div className="pl-5" style={{ color: T.muted }}># 2. Return structured data</div>
                <div className="pl-5"><span style={{ color: '#a78bfa' }}>return</span> <span style={{ color: 'rgba(255,255,255,0.6)' }}>resp.json()</span></div>
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${T.border}`, color: T.amber }}>
                  # Add to agent/tools.py — done.
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <FadeIn>
          <div className="max-w-3xl mx-auto rounded-3xl p-12 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,170,0.08), rgba(124,58,237,0.07))', border: '1px solid rgba(0,212,170,0.22)' }}>
            <div className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,212,170,0.1), transparent 60%)' }} />
            <h2 className="relative font-syne font-bold text-white mb-5"
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', letterSpacing: '-0.02em' }}>
              Stop hunting dashboards. 🎯
            </h2>
            <p className="relative text-[15px] font-sans mb-8" style={{ color: T.muted }}>
              Ask your infrastructure anything — in plain English.
            </p>
            <div className="relative flex flex-wrap justify-center gap-3">
              <button
                onClick={handleCta}
                className="inline-flex items-center gap-2 text-[13px] font-bold font-sans px-7 py-3.5 rounded-full transition-all duration-200"
                style={{ background: T.teal, color: T.bg, boxShadow: '0 0 40px rgba(0,212,170,0.35)', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 60px rgba(0,212,170,0.52)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 40px rgba(0,212,170,0.35)'}>
                {isAuthenticated ? 'Open app →' : 'Try OpsIQ free →'}
              </button>
              <a href="https://github.com/your-org/opsiq" target="_blank" rel="noreferrer"
                className="inline-flex items-center text-[13px] font-medium font-sans px-7 py-3.5 rounded-full transition-all duration-200"
                style={{ color: 'rgba(255,255,255,0.65)', border: `1px solid ${T.border}` }}
                onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; e.currentTarget.style.borderColor = T.border }}>
                Self-host for free
              </a>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="px-6 py-12" style={{ borderTop: `1px solid ${T.border}` }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
              style={{ background: T.violet }}>⚡</div>
            <span className="text-sm font-syne font-bold text-white">OpsIQ</span>
            <span className="text-[12px] font-sans" style={{ color: T.muted }}>— AI-powered DevOps intelligence</span>
          </div>
          <div className="flex items-center gap-8">
            {[
              ['GitHub','https://github.com/your-org/opsiq'],
              ['Docs','https://github.com/your-org/opsiq#readme'],
              ['Pricing','#pricing'],
              ['License','https://github.com/your-org/opsiq/blob/main/LICENSE'],
            ].map(([label, href]) => (
              <a key={label} href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noreferrer' : undefined}
                className="text-[12px] font-sans transition-colors"
                style={{ color: T.muted }}
                onMouseEnter={e => e.currentTarget.style.color = 'white'}
                onMouseLeave={e => e.currentTarget.style.color = T.muted}>
                {label}
              </a>
            ))}
          </div>
          <p className="text-[11px] font-sans" style={{ color: 'rgba(255,255,255,0.18)' }}>
            © {new Date().getFullYear()} OpsIQ. BSL 1.1.
          </p>
        </div>
      </footer>
    </div>
  )
}
