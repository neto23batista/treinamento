import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  timeout: 7_000,
  headers: { 'Content-Type': 'application/json' },
})

export const getDemoUserKey = () => {
  try {
    return JSON.parse(localStorage.getItem('kurio-user') ?? 'null')?.email ?? 'guest'
  } catch {
    return 'guest'
  }
}

api.interceptors.request.use((config) => {
  if (!config.headers.get('X-Demo-User')) config.headers.set('X-Demo-User', getDemoUserKey())
  const scenarioKeys = [
    'kurio-mock-latency',
    'kurio-mock-failure',
    'kurio-mock-favorites-failure',
    'kurio-mock-order-timeout',
    'kurio-mock-order-status',
  ]
  const scenarioHeaders: Record<string, string> = {
    'kurio-mock-latency': 'X-Demo-Latency',
    'kurio-mock-failure': 'X-Demo-Failure',
    'kurio-mock-favorites-failure': 'X-Demo-Favorites-Failure',
    'kurio-mock-order-timeout': 'X-Demo-Order-Timeout',
    'kurio-mock-order-status': 'X-Demo-Order-Status',
  }
  scenarioKeys.forEach((key) => {
    const value = localStorage.getItem(key)
    if (value) config.headers.set(scenarioHeaders[key], value)
  })
  return config
})
