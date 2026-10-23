export interface Todo {
  id: string
  title: string
  completed: boolean
  created_at: string
  updated_at: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed with status ${response.status}`)
  }
  return data as T
}

export const api = {
  list: () => request<Todo[]>('/api/todos'),
  create: (title: string) =>
    request<Todo>('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  update: (id: string, patch: { title?: string; completed?: boolean }) =>
    request<Todo>(`/api/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<void>(`/api/todos/${id}`, { method: 'DELETE' }),
}
