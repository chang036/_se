import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api, type Todo } from './api'

type Filter = 'all' | 'active' | 'completed'

const FILTER_LABELS: Record<Filter, string> = {
  all: '全部',
  active: '未完成',
  completed: '已完成',
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      setTodos(await api.list())
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法載入待辦事項')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const addTodo = async (event: FormEvent) => {
    event.preventDefault()
    const title = input.trim()
    if (!title) return
    try {
      setError(null)
      await api.create(title)
      setInput('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法新增待辦事項')
    }
  }

  const toggleTodo = async (todo: Todo) => {
    // Optimistic update: flip the UI immediately, roll back if the API fails.
    const optimistic = { ...todo, completed: !todo.completed }
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? optimistic : t)))
    try {
      setError(null)
      const updated = await api.update(todo.id, { completed: !todo.completed })
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)))
    } catch (e) {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)))
      setError(e instanceof Error ? e.message : '無法更新待辦事項')
    }
  }

  const removeTodo = async (id: string) => {
    try {
      setError(null)
      await api.remove(id)
      setTodos((prev) => prev.filter((t) => t.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法刪除待辦事項')
    }
  }

  const clearCompleted = async () => {
    try {
      setError(null)
      const completed = todos.filter((t) => t.completed)
      await Promise.all(completed.map((t) => api.remove(t.id)))
      setTodos((prev) => prev.filter((t) => !t.completed))
    } catch (e) {
      setError(e instanceof Error ? e.message : '無法清除已完成事項')
    }
  }

  const visibleTodos = useMemo(() => {
    if (filter === 'active') return todos.filter((t) => !t.completed)
    if (filter === 'completed') return todos.filter((t) => t.completed)
    return todos
  }, [todos, filter])

  const activeCount = todos.filter((t) => !t.completed).length
  const completedCount = todos.length - activeCount

  return (
    <main className="app">
      <header className="header">
        <h1>
          <span className="bolt">⚡</span> 極速待辦事項
        </h1>
        <p className="subtitle">Rust + Axum · React + Vite · Playwright</p>
      </header>

      <form className="add-form" onSubmit={addTodo}>
        <input
          id="todo-input"
          data-testid="todo-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="接下來要完成什麼？"
          aria-label="新增待辦事項"
          maxLength={200}
          autoFocus
        />
        <button data-testid="todo-add" type="submit" disabled={!input.trim()}>
          新增
        </button>
      </form>

      {error && (
        <p className="error" data-testid="error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="hint" data-testid="loading">
          載入中…
        </p>
      ) : todos.length === 0 ? (
        <p className="hint" data-testid="empty-state">
          目前沒有待辦事項，享受極速的自由吧 ⚡
        </p>
      ) : (
        <>
          <ul className="todo-list" data-testid="todo-list">
            {visibleTodos.map((todo) => (
              <li
                key={todo.id}
                data-testid="todo-item"
                data-completed={todo.completed}
                className={todo.completed ? 'completed' : ''}
              >
                <label className="toggle-wrap">
                  <input
                    type="checkbox"
                    data-testid="todo-toggle"
                    checked={todo.completed}
                    onChange={() => void toggleTodo(todo)}
                    aria-label={`切換「${todo.title}」完成狀態`}
                  />
                  <span className="checkmark" aria-hidden="true" />
                </label>
                <span className="title" data-testid="todo-title">
                  {todo.title}
                </span>
                <button
                  className="delete"
                  data-testid="todo-delete"
                  onClick={() => void removeTodo(todo.id)}
                  aria-label={`刪除「${todo.title}」`}
                  title="刪除"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <footer className="footer">
            <span data-testid="todo-count">
              <strong>{activeCount}</strong> 項待完成
              {completedCount > 0 && ` · ${completedCount} 項已完成`}
            </span>

            <div className="filters" role="group" aria-label="篩選">
              {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
                <button
                  key={key}
                  data-testid={`filter-${key}`}
                  className={filter === key ? 'active' : ''}
                  onClick={() => setFilter(key)}
                  type="button"
                >
                  {FILTER_LABELS[key]}
                </button>
              ))}
            </div>

            <button
              className="clear"
              data-testid="clear-completed"
              onClick={() => void clearCompleted()}
              disabled={completedCount === 0}
              type="button"
            >
              清除已完成
            </button>
          </footer>
        </>
      )}
    </main>
  )
}
