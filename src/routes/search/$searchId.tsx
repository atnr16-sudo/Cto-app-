import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/search/$searchId')({
  component: SearchResults,
})

function SearchResults() {
  const { searchId } = Route.useParams()
  const navigate = useNavigate()
  const markSeen = useMutation((api.leads as any).markLeadsSeen)

  const { data: search } = useSuspenseQuery(
    convexQuery(api.leads.getSearch, { searchId: searchId as any }),
  )
  const { data: leads } = useSuspenseQuery(
    convexQuery(api.leads.getLeads, { searchId: searchId as any }),
  )

  // Mark leads as seen when viewing
  useEffect(() => {
    if (search?.status === 'completed') {
      markSeen({ searchId: searchId as any })
    }
  }, [search?.status, searchId, markSeen])

  if (!search) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-4">
        <div className="card p-8 text-center max-w-sm">
          <div className="text-3xl mb-3">🔍</div>
          <h2 className="text-lg font-bold text-white mb-1">Suche nicht gefunden</h2>
          <button onClick={() => (navigate as any)({ to: '/' })}
            className="btn-gold mt-4 text-sm">Zurück</button>
        </div>
      </div>
    )
  }

  const isRunning = search.status === 'running'
  const isError = search.status === 'error'
  const isCompleted = search.status === 'completed'
  const newCount = leads.filter(l => l.isNew).length

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-b from-[#1A1A1A] to-[#111] border-b border-[#222] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => (navigate as any)({ to: '/' })}
            className="text-gray-500 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">{search.city}</h1>
              {search.isAutoscan && <span className="text-[10px] text-gray-500">🤖</span>}
              {newCount > 0 && (
                <span className="badge-new">{newCount} neu</span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {search.maxLeads} Leads · Hotel-Suche
              {search.isAutoscan && ' · Autoscan'}
            </p>
          </div>
          <div>
            {isRunning && (
              <span className="badge-status gold-bg text-[#1A1A1A] animate-pulse">Scannt...</span>
            )}
            {isCompleted && (
              <span className="badge-status bg-green-900/40 text-green-400 border border-green-800/50">
                ✓ {leads.length} Leads
              </span>
            )}
            {isError && (
              <span className="badge-status bg-red-900/40 text-red-400 border border-red-800/50">✗ Fehler</span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 max-w-4xl mx-auto w-full">
        {/* Running */}
        {isRunning && (
          <div className="card p-8 text-center">
            <div className="w-10 h-10 border-3 border-[#D4A843]/30 border-t-[#D4A843] rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-base font-semibold text-white">Suche läuft...</h2>
            <p className="text-sm text-gray-500 mt-1">Durchsuche Jobportale nach Hotels in {search.city}</p>
            {leads.length > 0 && (
              <p className="text-sm gold-text mt-2">Bereits {leads.length} Leads gefunden!</p>
            )}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="card p-8 text-center border-red-900/50">
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-base font-semibold text-white mb-1">Fehler bei der Suche</h2>
            <p className="text-sm text-gray-400">{search.errorMessage}</p>
          </div>
        )}

        {/* Empty */}
        {isCompleted && leads.length === 0 && (
          <div className="card p-8 text-center">
            <div className="text-3xl mb-3">🏨</div>
            <h2 className="text-base font-semibold text-white mb-1">Keine Leads gefunden</h2>
            <p className="text-sm text-gray-500">Keine Hotels mit Jobausschreibungen in {search.city}</p>
          </div>
        )}

        {/* Leads */}
        {leads.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">
                {leads.length} Lead{leads.length !== 1 ? 's' : ''}
                {newCount > 0 && <span className="gold-text ml-1">({newCount} neu)</span>}
              </h2>
              <button onClick={() => {
                const csv = [
                  ['Hotel-Name','GF/CEO','Hotel-Email','Hotel-Telefon','Stellenausschreibung','Ansprechpartner','AP-Email','AP-Telefon','Hotel-URL','Job-URL','Quelle'].join(','),
                  ...leads.map(l => [
                    `"${l.name}"`,`"${l.ceo||''}"`,`"${l.email||''}"`,`"${l.phone||''}"`,`"${l.jobTitle||''}"`,`"${l.ansprechpartner||''}"`,`"${l.ansprechpartnerEmail||''}"`,`"${l.ansprechpartnerPhone||''}"`,`"${l.website||''}"`,`"${l.jobUrl||''}"`,`"${l.source}"`,
                  ].join(','))
                ].join('\n')
                const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `leads-${search.city}-${Date.now()}.csv`
                a.click()
              }} className="btn-ghost text-xs py-2 px-3">
                📥 CSV
              </button>
            </div>

            <div className="space-y-2.5">
              {leads.map(lead => (
                <div key={lead._id} className={`card p-4 transition ${
                  lead.isNew ? 'card-gold' : ''
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white truncate">{lead.name}</h3>
                        {lead.isNew && <span className="badge-new shrink-0">New</span>}
                      </div>
                      {lead.website && (
                        <a href={lead.website} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-[#D4A843] hover:underline truncate block mt-0.5">
                          {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      )}
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#2A2A2A] gold-text">
                      {lead.jobPostingsCount} Job{lead.jobPostingsCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 mt-2.5 text-xs">
                    {lead.ceo && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 shrink-0">👔 GF:</span>
                        <span className="text-gray-200">{lead.ceo}</span>
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 shrink-0">✉ Hotel:</span>
                        <a href={`mailto:${lead.email}`} className="text-[#D4A843] hover:underline truncate">{lead.email}</a>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 shrink-0">📞 Hotel:</span>
                        <span className="text-gray-200">{lead.phone}</span>
                      </div>
                    )}
                    {lead.jobTitle && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 shrink-0">📋 Stelle:</span>
                        <span className="text-gray-200">{lead.jobTitle}</span>
                      </div>
                    )}
                    {lead.jobUrl && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 shrink-0">🔗 Job-URL:</span>
                        <a href={lead.jobUrl} target="_blank" rel="noopener noreferrer" className="text-[#D4A843] hover:underline truncate">{lead.jobUrl}</a>
                      </div>
                    )}
                    {lead.ansprechpartner && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 shrink-0">👤 AP:</span>
                        <span className="text-gray-200">{lead.ansprechpartner}</span>
                        {lead.ansprechpartnerPosition && <span className="text-gray-500 text-[10px]">({lead.ansprechpartnerPosition})</span>}
                      </div>
                    )}
                    {lead.ansprechpartnerEmail && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 shrink-0">✉ AP:</span>
                        <a href={`mailto:${lead.ansprechpartnerEmail}`} className="text-[#D4A843] hover:underline truncate">{lead.ansprechpartnerEmail}</a>
                      </div>
                    )}
                    {lead.ansprechpartnerPhone && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 shrink-0">📞 AP:</span>
                        <span className="text-gray-200">{lead.ansprechpartnerPhone}</span>
                      </div>
                    )}
                    {lead.website && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-gray-500 shrink-0">🌐 Web:</span>
                        <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-[#D4A843] hover:underline truncate">{lead.website}</a>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t border-[#222] text-[10px] text-gray-600">
                    {lead.source}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="tab-bar px-2 py-1.5">
        <div className="max-w-4xl mx-auto flex justify-around">
          <button onClick={() => (navigate as any)({ to: '/' })}
            className="tab-btn active">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Start</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
