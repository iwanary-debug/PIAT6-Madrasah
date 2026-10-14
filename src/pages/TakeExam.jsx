import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api, post } from '../lib/api'
import { Card, Pill, Loading, Empty, Confirm } from '../components/ui'
import { num, tanggal, waktu, label } from '../lib/format'

export default function TakeExam() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [deadline, setDeadline] = useState(null)
  const [status, setStatus] = useState(null)
  const [current, setCurrent] = useState(0)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [review, setReview] = useState(null)
  const [remaining, setRemaining] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const timers = useRef({})
  const submittedRef = useRef(false)

  const loadExam = useCallback(async () => {
    try {
      const res = await api(`/exams/${id}`)
      setExam(res.exam)
      setStatus(res.participant ? res.participant.status : 'not_registered')
      if (res.participant) setExam((e) => ({ ...e, my_score: res.participant.final_score, published: res.participant.published }))
    } catch (e) { setError(e) }
  }, [id])

  useEffect(() => { loadExam() }, [id, loadExam])

  const begin = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const res = await post(`/exam/${id}/start`)
      setExam((e) => ({ ...e, ...res.exam }))
      setQuestions(res.questions)
      const map = {}
      for (const a of res.answers || []) map[a.question_id] = a.answer
      setAnswers(map)
      setDeadline(res.deadline)
      setStatus('in_progress')
    } catch (e) { setError(e) } finally { setBusy(false) }
  }, [id])

  useEffect(() => {
    if (status === 'in_progress' && questions.length === 0 && exam && !busy) begin()
  }, [status, questions.length, exam, begin, busy])

  const submit = useCallback(async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setBusy(true)
    try {
      await post(`/exam/${id}/submit`)
      const res = await api(`/exam/${id}/attempt`)
      setReview(res)
      setStatus(res.participant.status)
      setDeadline(null)
    } catch (e) { setError(e); submittedRef.current = false } finally { setBusy(false); setConfirmSubmit(false) }
  }, [id])

  useEffect(() => {
    if (!deadline || status !== 'in_progress') return
    const tick = () => {
      const left = Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)
      setRemaining(left > 0 ? left : 0)
      if (left <= 0) submit()
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [deadline, status, submit])

  const saveAnswer = (questionId, value) => {
    setAnswers((s) => ({ ...s, [questionId]: value }))
    clearTimeout(timers.current[questionId])
    timers.current[questionId] = setTimeout(async () => {
      try {
        await post(`/exam/${id}/answer`, { question_id: questionId, answer: value })
        setSavedAt(new Date().toISOString())
      } catch (e) {
        setError(e)
        if (/berakhir|habis/i.test(e.message)) { submittedRef.current = false; submit() }
      }
    }, 700)
  }

  useEffect(() => {
    if (status === 'submitted' || status === 'graded') {
      api(`/exam/${id}/attempt`).then(setReview).catch((e) => setError(e))
    }
  }, [status, id])

  const answeredCount = useMemo(() => questions.filter((q) => answers[q.question_id] != null && String(answers[q.question_id]).trim() !== '').length, [questions, answers])
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  if (error && !exam && !review) return <Card title="Ujian tidak dapat dibuka"><div className="err">{error.message}</div><Link className="btn secondary sm mt1" to="/cbt/ujian-saya">Kembali ke daftar ujian</Link></Card>
  if (!exam) return <Loading text="Memuat data ujian…" />

  return (
    <div className="exam-shell stack">
      <Card title={exam.title} subtitle={`${exam.subject_name || ''} • ${exam.duration_minutes} menit • ${questions.length || exam.question_count} soal`}>
        <div className="row between">
          <div className="row tight">
            <Pill value={exam.window_state} text={label(exam.window_state)} />
            <span className="small muted">{tanggal(exam.start_at)} {waktu(exam.start_at).split(', ').pop()} – {waktu(exam.end_at).split(', ').pop()}</span>
            <span className="small muted">Peserta: {user.name}</span>
          </div>
          {status === 'in_progress' && remaining != null ? <span className="timer">Sisa waktu {mmss(remaining)}</span> : null}
        </div>
        {exam.instructions && <p className="small mt1" style={{ background: '#f7faf9', padding: '.6rem', borderRadius: 8 }}>{exam.instructions}</p>}
        {error && <div className="err" role="alert">{error.message}</div>}
        {savedAt && status === 'in_progress' ? <div className="small muted">Jawaban terakhir tersimpan {waktu(savedAt)}</div> : null}
      </Card>

      {status === 'not_registered' && <Card><Empty text="Anda tidak terdaftar sebagai peserta ujian ini. Hubungi guru pengampu bila menurut Anda ini keliru." /></Card>}

      {status === 'not_started' && (
        <Card title="Siap mengerjakan?">
          <p className="small">Ujian ini memiliki batas waktu <b>{exam.duration_minutes} menit</b> sejak Anda menekan tombol mulai, dan akan otomatis dikirim ketika waktu habis atau jadwal berakhir.</p>
          <button className="btn" onClick={begin} disabled={busy || exam.window_state !== 'berlangsung'}>{busy ? 'Menyiapkan…' : 'Mulai ujian'}</button>
          {exam.window_state !== 'berlangsung' ? <div className="small muted mt1">Ujian belum/sudah tidak dapat dikerjakan pada waktu sekarang.</div> : null}
        </Card>
      )}

      {status === 'in_progress' && questions.length > 0 && (
        <>
          <Card title={`Soal ${current + 1} dari ${questions.length}`} subtitle={`${answeredCount} soal sudah dijawab`}>
            <QuestionView question={questions[current]} answer={answers[questions[current].question_id]} onChange={(v) => saveAnswer(questions[current].question_id, v)} />
            <div className="row between mt2">
              <button className="btn secondary" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>← Sebelumnya</button>
              <button className="btn secondary" onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))} disabled={current === questions.length - 1}>Berikutnya →</button>
            </div>
          </Card>
          <Card title="Navigasi soal" subtitle="Hijau berarti jawaban sudah tersimpan otomatis">
            <div className="qnav">
              {questions.map((q, i) => {
                const done = answers[q.question_id] != null && String(answers[q.question_id]).trim() !== ''
                return <button key={q.question_id} className={`${done ? 'done' : ''} ${i === current ? 'cur' : ''}`} onClick={() => setCurrent(i)}>{i + 1}</button>
              })}
            </div>
            <div className="row between mt2">
              <span className="small muted">{questions.length - answeredCount} soal belum dijawab. Jawaban tersimpan otomatis saat diketik.</span>
              <button className="btn" onClick={() => setConfirmSubmit(true)} disabled={busy}>{busy ? 'Mengirim…' : 'Kirim jawaban ujian'}</button>
            </div>
          </Card>
        </>
      )}

      {['submitted', 'graded'].includes(status) && review && (
        <Card title="Jawaban yang telah dikirim" subtitle={review.result_visible ? 'Nilai sudah dipublikasikan guru' : 'Menunggu koreksi/publikasi guru'}>
          <div className="row tight mb2">
            <Pill value={review.participant.status} />
            <span className="small">Dikirim: <b>{waktu(review.participant.submitted_at)}</b></span>
            {review.result_visible ? <>
              <span className="small">Nilai objektif: <b>{num(review.participant.objective_score)}</b></span>
              <span className="small">Nilai uraian: <b>{num(review.participant.essay_score)}</b></span>
              <span className="small">Nilai akhir: <b>{num(review.participant.final_score)}</b></span>
            </> : <span className="small muted">Nilai akan tampil setelah guru mempublikasikan hasil.</span>}
          </div>
          <div className="stack">
            {review.questions.map((q, i) => (
              <div className="qbox" key={q.question_id}>
                <div className="small"><b>Soal {i + 1} ({label(q.type)})</b> — {q.question}</div>
                {q.options ? <div className="small muted">{q.options.join(' • ')}</div> : null}
                <div className="small mt1">Jawaban Anda: <b>{q.answer || '(tidak dijawab)'}</b></div>
                {review.result_visible ? (
                  <div className="row tight mt1">
                    {q.type !== 'essay' ? <Pill value={q.is_correct ? 'ok' : 'alpa'} text={q.is_correct ? 'Benar' : 'Belum tepat'} /> : <Pill value={q.score == null ? 'warn' : 'ok'} text={q.score == null ? 'Menunggu koreksi' : `Nilai uraian: ${q.score}`} />}
                    {q.feedback ? <span className="small muted">Umpan balik: {q.feedback}</span> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <Link className="btn secondary sm mt2" to="/cbt/ujian-saya">Kembali ke daftar ujian</Link>
        </Card>
      )}

      {status === 'in_progress' && questions.length === 0 && <Loading text="Menyiapkan soal…" />}

      {confirmSubmit && <Confirm title="Kirim jawaban ujian" confirmLabel="Kirim sekarang"
        message={`Anda telah menjawab ${answeredCount} dari ${questions.length} soal. Setelah dikirim, jawaban tidak dapat diubah lagi.`}
        busy={busy} onCancel={() => setConfirmSubmit(false)} onConfirm={submit} />}
      <div className="row between no-print">
        <button className="btn secondary sm" onClick={() => navigate('/cbt/ujian-saya')}>← Daftar ujian</button>
        <span className="small muted">Jangan menutup halaman saat ujian berlangsung. Aktivitas penyimpanan jawaban tercatat waktunya.</span>
      </div>
    </div>
  )
}

function QuestionView({ question, answer, onChange }) {
  if (!question) return null
  if (question.type === 'multiple_choice') {
    return (
      <div>
        <div className="mb1"><b>{question.question}</b></div>
        {(question.options || []).map((o, i) => (
          <label key={i} className={`opt ${answer === o ? 'sel' : ''}`}>
            <input type="radio" name={`q${question.question_id}`} checked={answer === o} onChange={() => onChange(o)} />
            <span>{String.fromCharCode(65 + i)}. {o}</span>
          </label>
        ))}
      </div>
    )
  }
  if (question.type === 'true_false') {
    return (
      <div>
        <div className="mb1"><b>{question.question}</b></div>
        <div className="row tight">
          <button className={`btn ${answer === 'true' ? '' : 'secondary'}`} onClick={() => onChange('true')}>Benar</button>
          <button className={`btn ${answer === 'false' ? '' : 'secondary'}`} onClick={() => onChange('false')}>Salah</button>
        </div>
      </div>
    )
  }
  return (
    <div>
      <div className="mb1"><b>{question.question}</b></div>
      <textarea rows={8} value={answer || ''} onChange={(e) => onChange(e.target.value)} placeholder="Tulis jawaban uraian Anda di sini…" />
      <div className="hint">Jawaban uraian akan diperiksa langsung oleh guru pengampu.</div>
    </div>
  )
}
