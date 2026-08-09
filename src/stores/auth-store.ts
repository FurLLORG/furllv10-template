import { create } from 'zustand'

const JWT_KEY = 'jwt'

interface AuthUser {
  id: number
  username: string
  email: string
  phone: string
  phone_code: string
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    reset: () => void
  }
}

function getJwt(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(JWT_KEY) ?? ''
}

export const useAuthStore = create<AuthState>()((set) => {
  return {
    auth: {
      user: null,
      setUser: (user) =>
        set((state) => ({ ...state, auth: { ...state.auth, user } })),
      accessToken: getJwt(),
      setAccessToken: (accessToken) =>
        set((state) => {
          // 与官方 JS 约定一致：token 存 localStorage.jwt
          window.localStorage.setItem(JWT_KEY, accessToken)
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          window.localStorage.removeItem(JWT_KEY)
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      reset: () =>
        set((state) => {
          window.localStorage.removeItem(JWT_KEY)
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '' },
          }
        }),
    },
  }
})
