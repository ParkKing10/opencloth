/* ============================================================
   Admin — video provider diagnostics.

   Connection status, active models, recent jobs, errors, latency
   and success rate for the AI Commercial Director's rendering
   provider. The full API key is never available here — it only
   exists as a server-side secret; this page sees booleans.
   ============================================================ */

import { useEffect, useState } from 'react'
import { useT } from '../../../i18n'
import { useToast } from '../../components/ui/Toast'
import { supabase, isSupabaseConfigured } from '../../../lib/supabase'
import { listJobs, resolveProviderId, setProviderOverride } from '../../pages/Explainer/generation/generationService'
import { fmtTime } from '../../pages/Explainer/controls'

type Health = {
  configured: boolean
  webhookConfigured: boolean
  models: { imageToVideo: string; textToImage: string; alternates: string[] }
  recentJobs: { id: string; status: string; model?: string | null; error_code?: string | null; created_at: string; updated_at: string }[]
  stats: { total: number; completed: number; failed: number; successRate: number | null; avgLatencySec: number | null }
}

export function AdminVideoProviders() {
  const t = useT()
  const toast = useToast()
  const [provider, setProvider] = useState(resolveProviderId())
  const [health, setHealth] = useState<Health | null>(null)
  const [checking, setChecking] = useState(false)
  const localJobs = listJobs().slice(-10).reverse()

  const check = async () => {
    if (!supabase) return
    setChecking(true)
    try {
      const { data, error } = await supabase.functions.invoke('hf-health', { body: {} })
      if (error || !data || (data as { error?: unknown }).error) throw new Error('health')
      setHealth(data as Health)
    } catch {
      setHealth(null)
      toast(t('director.diag.checkFailed'), 'info')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (isSupabaseConfigured) void check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchProvider = (id: 'mock' | 'higgsfield') => {
    setProviderOverride(id)
    setProvider(id)
    toast(t('director.diag.switched', { p: id }), 'success')
  }

  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)

  return (
    <div style={{ maxWidth: 860 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{t('director.diag.title')}</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--s-text-2)' }}>{t('director.diag.subtitle')}</p>
      </header>

      <div className="adm-panel" style={{ marginBottom: 20 }}>
        <div className="adm-panel__head">
          <h2>{t('director.diag.provider')}</h2>
        </div>
        <div style={{ padding: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['mock', 'higgsfield'] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`s-btn ${provider === id ? 's-btn--accent' : 's-btn--subtle'}`}
              onClick={() => switchProvider(id)}
            >
              {id === 'mock' ? t('director.diag.mock') : 'Higgsfield Cloud'}
            </button>
          ))}
          <span style={{ fontSize: 12, color: 'var(--s-text-3)' }}>{t('director.diag.switchNote')}</span>
        </div>
      </div>

      <div className="adm-panel" style={{ marginBottom: 20 }}>
        <div className="adm-panel__head">
          <h2>{t('director.diag.connection')}</h2>
          <button type="button" className="s-btn s-btn--subtle" onClick={() => void check()} disabled={!isSupabaseConfigured || checking}>
            {checking ? '…' : t('director.diag.recheck')}
          </button>
        </div>
        <div style={{ padding: 14, fontSize: 13.5, display: 'grid', gap: 6 }}>
          {!isSupabaseConfigured ? (
            <span style={{ color: 'var(--s-text-3)' }}>{t('director.diag.noBackend')}</span>
          ) : health ? (
            <>
              <span>{health.configured ? `✅ ${t('director.diag.keyOk')}` : `⛔ ${t('director.diag.keyMissing')}`}</span>
              <span>{health.webhookConfigured ? `✅ ${t('director.diag.webhookOk')}` : `➖ ${t('director.diag.webhookOff')}`}</span>
              <span style={{ color: 'var(--s-text-2)' }}>
                i2v: <code>{health.models.imageToVideo}</code> · t2i: <code>{health.models.textToImage}</code>
              </span>
              <span style={{ color: 'var(--s-text-2)' }}>
                {t('director.diag.stats', {
                  ok: health.stats.completed,
                  fail: health.stats.failed,
                  rate: pct(health.stats.successRate),
                  lat: health.stats.avgLatencySec === null ? '—' : fmtTime(health.stats.avgLatencySec),
                })}
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--s-text-3)' }}>{t('director.diag.unchecked')}</span>
          )}
        </div>
      </div>

      <div className="adm-panel">
        <div className="adm-panel__head">
          <h2>{t('director.diag.recent')}</h2>
        </div>
        <div style={{ padding: 8 }}>
          {(health?.recentJobs?.length ? health.recentJobs : null)?.map((j) => (
            <div key={j.id} style={{ display: 'flex', gap: 10, padding: '7px 8px', fontSize: 12.5, borderBottom: '1px solid var(--s-line)' }}>
              <b style={{ minWidth: 90 }}>{j.status}</b>
              <span style={{ flex: 1, color: 'var(--s-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.model ?? '—'}</span>
              {j.error_code && <span style={{ color: '#f0616d' }}>{j.error_code}</span>}
              <span style={{ color: 'var(--s-text-3)' }}>{new Date(j.created_at).toLocaleTimeString()}</span>
            </div>
          )) ??
            localJobs.map((j) => (
              <div key={j.id} style={{ display: 'flex', gap: 10, padding: '7px 8px', fontSize: 12.5, borderBottom: '1px solid var(--s-line)' }}>
                <b style={{ minWidth: 90 }}>{j.state}</b>
                <span style={{ flex: 1, color: 'var(--s-text-2)' }}>{j.provider}</span>
                {j.error && <span style={{ color: '#f0616d' }}>{j.error.code}</span>}
                <span style={{ color: 'var(--s-text-3)' }}>{new Date(j.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
          {!health?.recentJobs?.length && localJobs.length === 0 && (
            <p style={{ padding: 8, fontSize: 12.5, color: 'var(--s-text-3)' }}>{t('director.diag.empty')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
