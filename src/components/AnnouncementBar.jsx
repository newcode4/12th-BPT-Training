import { useEffect, useState } from 'react'
import { Check, Loader2, Megaphone, PenLine, Trash2, X } from 'lucide-react'
import { listRecords, putRecord, removeRecord } from '../utils/cloudStore'
import { isAdminMode } from '../utils/admin'

const NOTICE_ID = '00000000-0000-4000-8000-000000000002'

function dismissedKey(notice) {
  return `pt-notice-dismissed-${notice.id}-${notice.updatedAt || ''}`
}

export default function AnnouncementBar() {
  const admin = isAdminMode()
  const [notice, setNotice] = useState(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listRecords('notice')
      .then((rows) => {
        if (cancelled) return
        const latest = [...rows].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null
        setNotice(latest)
        setDraft(latest?.text || '')
        setDismissed(latest ? localStorage.getItem(dismissedKey(latest)) === 'true' : false)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message || '공지사항을 불러오지 못했어요.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleDismiss = () => {
    if (notice) localStorage.setItem(dismissedKey(notice), 'true')
    setDismissed(true)
  }

  const handleSave = async () => {
    const text = draft.trim()
    if (!text) {
      setError('공지 내용을 입력해주세요.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const next = { id: NOTICE_ID, text, updatedAt: new Date().toISOString() }
      await putRecord('notice', next)
      setNotice(next)
      setDismissed(false)
      setEditing(false)
    } catch (e) {
      setError(e.message || '공지사항 저장에 실패했어요.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('공지사항을 내릴까요?')) return
    setSaving(true)
    setError('')
    try {
      await removeRecord('notice', NOTICE_ID)
      setNotice(null)
      setDraft('')
      setEditing(false)
      setDismissed(false)
    } catch (e) {
      setError(e.message || '공지사항 삭제에 실패했어요.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null
  if (!admin && (!notice || dismissed)) return null

  return (
    <div className="bg-amber-500/10 border-b border-amber-400/20">
      <div className="max-w-5xl mx-auto px-4 py-2.5">
        {admin && editing ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Megaphone size={16} className="text-amber-300 mt-3 shrink-0" />
              <textarea
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setError('') }}
                placeholder="공지사항을 입력하세요"
                rows={2}
                className="flex-1 min-w-0 resize-none rounded-xl border border-amber-400/20 bg-surface/80 px-3 py-2 text-sm font-bold text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-amber-300"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                title="공지 저장"
                className="w-9 h-9 mt-1 flex items-center justify-center rounded-full bg-amber-400 text-gray-950 hover:bg-amber-300 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button
                onClick={() => { setEditing(false); setDraft(notice?.text || '') }}
                title="취소"
                className="w-9 h-9 mt-1 flex items-center justify-center rounded-full bg-white/10 text-gray-300 hover:bg-white/15"
              >
                <X size={16} />
              </button>
            </div>
            {error && <p className="pl-6 text-xs font-bold text-red-300">{error}</p>}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Megaphone size={16} className="text-amber-300 shrink-0" />
            <p className="flex-1 min-w-0 text-sm font-bold text-amber-50 leading-relaxed whitespace-pre-wrap">
              {notice?.text || '등록된 공지사항이 없어요.'}
            </p>
            {admin ? (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditing(true)}
                  title="공지 수정"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-amber-100 hover:bg-white/15"
                >
                  <PenLine size={14} />
                </button>
                {notice && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    title="공지 삭제"
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-red-200 hover:bg-white/15 disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleDismiss}
                title="공지 닫기"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-amber-100 hover:bg-white/15 shrink-0"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
