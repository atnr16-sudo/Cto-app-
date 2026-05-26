import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
  head: () => ({
    meta: [{ title: 'Lead Generator Premium' }],
  }),
})

const BW_CITIES = [
  "Stuttgart","Mannheim","Karlsruhe","Freiburg","Heidelberg",
  "Ulm","Heilbronn","Pforzheim","Reutlingen","Tübingen",
  "Esslingen","Ludwigsburg","Konstanz","Aalen","Friedrichshafen",
  "Offenburg","Göppingen","Ravensburg","Baden-Baden","Sindelfingen",
  "Böblingen","Villingen-Schwenningen","Rastatt","Lörrach","Bruchsal",
  "Waiblingen","Schwäbisch Gmünd","Bietigheim-Bissingen",
]

type Tab = 'search' | 'history' | 'autoscan'

function Home() {
  const [tab, setTab] = useState<Tab>('search')
  const newLeadsCount = useQuery(api.leads.countNewLeads) ?? 0

  return (
    <div className="min-h-screen flex flex-col bg-[#0D0D0D]">
      {/* Header */}
      <header className="bg-gradient-to-b from-[#1A1A1A] to-[#111] border-b border-[#222] px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gold-bg flex items-center justify-center text-base font-bold text-[#1A1A1A]">
              L
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Lead Generator</h1>
              <p className="text-[10px] text-gray-500 tracking-wider uppercase">Hotel · Baden-Württemberg</p>
            </div>
          </div>
          {newLeadsCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#D4A843]/10 border border-[#D4A843]/20">
              <span className="w-2 h-2 rounded-full gold-bg pulse-gold" />
              <span className="text-xs font-semibold gold-text">{newLeadsCount} neue</span>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-5 max-w-4xl mx-auto w-full">
        <div className="animate-fade-in">
          {tab === 'search' && <SearchTab />}
          {tab === 'history' && <HistoryTab />}
          {tab === 'autoscan' && <AutoscanTab />}
        </div>
      </main>

      {/* Bottom Tab Bar */}
      <nav className="tab-bar px-2 py-1.5">
        <div className="max-w-4xl mx-auto flex justify-around">
          {[
            { id: 'search' as Tab, label: 'Suchen', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
            { id: 'history' as Tab, label: 'Verlauf', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            { id: 'autoscan' as Tab, label: 'Autoscans', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
              </svg>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

// ─── TAB 1: SUCHEN ───────────────────────────────────────────────

function SearchTab() {
  const [city, setCity] = useState('')
  const [maxLeads, setMaxLeads] = useState(10)
  const startSearch = useMutation(api.leads.startSearch)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!city.trim()) return
    const searchId = await startSearch({ city: city.trim(), industry: 'Hotel', maxLeads })
    ;(navigate as any)({ to: '/search/$searchId', params: { searchId } })
  }

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h2 className="text-lg font-bold text-white mb-1">Einzelsuche</h2>
        <p className="text-sm text-gray-500 mb-5">Hotels mit aktiven Jobausschreibungen in einer Stadt finden</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Stadt</label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)}
              placeholder="z.B. Stuttgart, Freiburg..." list="cities" className="input" required />
            <datalist id="cities">{BW_CITIES.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Anzahl Leads</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setMaxLeads(Math.max(1, maxLeads - 1))}
                className="w-9 h-9 rounded-lg bg-[#2A2A2A] text-white hover:bg-[#333] flex items-center justify-center text-lg font-bold">−</button>
              <input type="number" value={maxLeads}
                onChange={e => setMaxLeads(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                min={1} max={50} className="input text-center w-20" />
              <button type="button" onClick={() => setMaxLeads(Math.min(50, maxLeads + 1))}
                className="w-9 h-9 rounded-lg bg-[#2A2A2A] text-white hover:bg-[#333] flex items-center justify-center text-lg font-bold">+</button>
            </div>
          </div>
          <button type="submit" className="btn-gold w-full">🔍 Suche starten</button>
        </form>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Verfügbare Städte in BW</h3>
        <div className="city-grid">
          {BW_CITIES.map(c => (
            <button key={c} onClick={() => setCity(c)}
              className={`px-2.5 py-1.5 rounded-lg text-xs text-left transition
                ${city === c ? 'gold-bg text-[#1A1A1A] font-semibold' : 'bg-[#2A2A2A] text-gray-400 hover:bg-[#333] hover:text-gray-200'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── TAB 2: VERLAUF ──────────────────────────────────────────────

function HistoryTab() {
  const { data: searches } = useSuspenseQuery(convexQuery(api.leads.listSearches, {}))
  const navigate = useNavigate()

  const manualSearches = searches.filter(s => !s.isAutoscan)
  const autoSearches = searches.filter(s => s.isAutoscan)

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-white">Suchverlauf</h2>

      {searches.length === 0 && (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-3">🔍</div>
          <p className="text-gray-400 text-sm">Noch keine Suchen durchgeführt</p>
          <p className="text-gray-600 text-xs mt-1">Starte eine Suche im Tab "Suchen"</p>
        </div>
      )}

      {manualSearches.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Manuelle Suchen</h3>
          <div className="space-y-1.5">
            {manualSearches.slice(0, 30).map(s => (
              <SearchRow key={s._id} search={s as any} navigate={navigate} />
            ))}
          </div>
        </div>
      )}

      {autoSearches.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Autoscan-Läufe</h3>
          <div className="space-y-1.5">
            {autoSearches.slice(0, 30).map(s => (
              <SearchRow key={s._id} search={s as any} navigate={navigate} isAuto />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SearchRow({ search, navigate, isAuto }: { search: any; navigate: any; isAuto?: boolean }) {
  const statusColors: Record<string, string> = {
    completed: 'bg-green-900/40 text-green-400 border-green-800/50',
    running: 'gold-bg text-[#1A1A1A]',
    error: 'bg-red-900/40 text-red-400 border-red-800/50',
  }
  return (
    <button onClick={() => (navigate as any)({ to: '/search/$searchId', params: { searchId: search._id } })}
      className="card w-full text-left px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{search.city}</span>
          {isAuto && <span className="text-[10px] text-gray-500">🤖</span>}
        </div>
        <span className="text-xs text-gray-500">
          {search.maxLeads} Leads · {new Date(search.createdAt).toLocaleDateString('de-DE')}
        </span>
      </div>
      <span className={`badge-status ${statusColors[search.status] || 'bg-gray-800 text-gray-400'} border`}>
        {search.status === 'running' ? '⟳' : search.status === 'completed' ? '✓' : search.status === 'error' ? '✗' : '?'}
      </span>
    </button>
  )
}

// ─── TAB 3: AUTOSCANS ────────────────────────────────────────────

function AutoscanTab() {
  const { data: autoscans } = useSuspenseQuery(convexQuery(api.leads.listAutoscans, {}))
  const createAutoscan = useMutation(api.leads.createAutoscan)
  const updateAutoscan = useMutation(api.leads.updateAutoscan)
  const deleteAutoscan = useMutation(api.leads.deleteAutoscan)

  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [leadsPerCity, setLeadsPerCity] = useState(10)
  const [frequency, setFrequency] = useState('daily')

  const handleCreate = async () => {
    if (!name.trim() || selectedCities.length === 0) return
    await createAutoscan({
      name: name.trim(),
      cities: selectedCities,
      maxLeadsPerCity: leadsPerCity,
      frequency,
    })
    setName('')
    setSelectedCities([])
    setShowNew(false)
  }

  const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    )
  }

  const selectAll = () => setSelectedCities(BW_CITIES)
  const deselectAll = () => setSelectedCities([])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Autoscans</h2>
        {!showNew && (
          <button onClick={() => setShowNew(true)} className="btn-gold text-sm py-2 px-4">
            + Neu
          </button>
        )}
      </div>

      {/* Create new autoscan */}
      {showNew && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Neuen Autoscan erstellen</h3>
            <button onClick={() => setShowNew(false)} className="text-gray-500 hover:text-white text-lg">&times;</button>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="z.B. BW Hotel-Scan" className="input" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Leads pro Stadt</label>
              <input type="number" value={leadsPerCity}
                onChange={e => setLeadsPerCity(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                min={1} max={50} className="input" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Intervall</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)} className="input">
                <option value="daily">Täglich</option>
                <option value="weekly">Wöchentlich</option>
                <option value="monthly">Monatlich</option>
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Städte ({selectedCities.length}/{BW_CITIES.length})</label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[10px] gold-text hover:underline">Alle</button>
                <button onClick={deselectAll} className="text-[10px] text-gray-500 hover:underline">Keine</button>
              </div>
            </div>
            <div className="city-grid max-h-40 overflow-y-auto p-1">
              {BW_CITIES.map(c => (
                <button key={c} onClick={() => toggleCity(c)}
                  className={`px-2 py-1 rounded-lg text-xs text-left transition border ${
                    selectedCities.includes(c)
                      ? 'gold-bg text-[#1A1A1A] font-semibold border-[#D4A843]'
                      : 'bg-[#2A2A2A] text-gray-400 border-transparent hover:bg-[#333]'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleCreate} disabled={!name.trim() || selectedCities.length === 0}
            className="btn-gold w-full">
            ⚡ Autoscan erstellen
          </button>
        </div>
      )}

      {/* Autoscan list */}
      {autoscans.length === 0 && !showNew && (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-3">⚙️</div>
          <p className="text-gray-400 text-sm">Noch keine Autoscans eingerichtet</p>
          <p className="text-gray-600 text-xs mt-1">Erstelle einen automatischen Scan für ganz BW</p>
        </div>
      )}

      <div className="space-y-3">
        {autoscans.map(a => (
          <AutoscanCard key={a._id} autoscan={a as any} onToggle={(status) => updateAutoscan({ autoscanId: a._id, status })} onDelete={() => deleteAutoscan({ autoscanId: a._id })} />
        ))}
      </div>
    </div>
  )
}

function AutoscanCard({ autoscan, onToggle, onDelete }: { autoscan: any; onToggle: (status: string) => void; onDelete: () => void }) {
  const isActive = autoscan.status === 'active'
  const freqLabels: Record<string, string> = { daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich' }

  return (
    <div className={`card p-5 ${isActive ? 'card-gold' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">{autoscan.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              isActive ? 'gold-bg text-[#1A1A1A]' : 'bg-gray-800 text-gray-400'
            }`}>
              {isActive ? 'Aktiv' : 'Pausiert'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {autoscan.cities.length} Städte · {autoscan.maxLeadsPerCity} Leads/Stadt · {freqLabels[autoscan.frequency] || autoscan.frequency}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`toggle ${isActive ? 'active' : ''}`} onClick={() => onToggle(isActive ? 'paused' : 'active')} />
          <button onClick={onDelete} className="text-gray-600 hover:text-red-400 text-sm p-1">🗑️</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {autoscan.cities.map((c: string) => (
          <span key={c} className="px-2 py-0.5 rounded text-[10px] bg-[#2A2A2A] text-gray-400">{c}</span>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#222] text-[10px] text-gray-600">
        {autoscan.lastRunAt && <span>Letzter Lauf: {new Date(autoscan.lastRunAt).toLocaleDateString('de-DE')}</span>}
        {autoscan.nextRunAt && <span>Nächster Lauf: {new Date(autoscan.nextRunAt).toLocaleDateString('de-DE')}</span>}
      </div>
    </div>
  )
}
