/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect, react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export interface Session {
  id: string
  name: string
  symbol: string
  all_instruments: boolean
  all_time: boolean
  time_start: string
  time_end: string
  created_at: number
}

interface SessionContextType {
  sessionId: string | null
  session: Session | null
  setSessionId: (id: string | null) => void
  isLoadingSession: boolean
}

const SessionContext = createContext<SessionContextType>({
  sessionId: null,
  session: null,
  setSessionId: () => {},
  isLoadingSession: false,
})

export const useSession = () => useContext(SessionContext)

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation()
  const [sessionId, setSessionIdState] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(false)

  // Listen to URL search parameter ?session=SESSION_ID
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const urlSessionId = params.get('session')
    if (urlSessionId) {
      setSessionIdState(urlSessionId)
      console.log(`[SessionContext] Active session updated from URL: ${urlSessionId}`)
    }
  }, [location.search])

  const setSessionId = (id: string | null) => {
    setSessionIdState(id)
    if (!id) {
      setSession(null)
    }
  }

  // Fetch session details from backend when sessionId changes
  useEffect(() => {
    if (!sessionId) return

    // Avoid redundant fetch if already matches
    if (session?.id === sessionId) return

    setIsLoadingSession(true)
    fetch('http://localhost:8000/1.1/sessions')
      .then(res => res.json())
      .then(data => {
        const active = data[sessionId]
        if (active) {
          setSession(active)
          console.log(`[SessionContext] Fetched session metadata: ${active.name} (${active.symbol})`)
        } else {
          console.warn(`[SessionContext] Session ID ${sessionId} not found in database`)
        }
      })
      .catch(err => {
        console.error('[SessionContext] Failed to load session configurations:', err)
      })
      .finally(() => {
        setIsLoadingSession(false)
      })
  }, [sessionId, session])

  return (
    <SessionContext.Provider value={{ sessionId, session, setSessionId, isLoadingSession }}>
      {children}
    </SessionContext.Provider>
  )
}
