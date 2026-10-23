import { expect, test } from '@playwright/test'

test.describe('極速待辦事項', () => {
  test.beforeEach(async ({ page, request }) => {
    // 每次測試前清空伺服器上的待辦事項，確保測試互不影響。
    const response = await request.get('/api/todos')
    const todos = (await response.json()) as Array<{ id: string }>
    for (const todo of todos) {
      await request.delete(`/api/todos/${todo.id}`)
    }
    await page.goto('/')
  })

  test('一開始顯示空狀態', async ({ page }) => {
    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByTestId('todo-input')).toBeVisible()
  })

  test('可以新增待辦事項', async ({ page }) => {
    await page.getByTestId('todo-input').fill('買牛奶')
    await page.getByTestId('todo-add').click()

    const item = page.getByTestId('todo-item').filter({ hasText: '買牛奶' })
    await expect(item).toBeVisible()
    await expect(item.getByTestId('todo-title')).toHaveText('買牛奶')
    await expect(page.getByTestId('todo-count')).toContainText('1')
  })

  test('可以切換完成狀態', async ({ page }) => {
    await page.getByTestId('todo-input').fill('寫測試')
    await page.getByTestId('todo-add').click()

    const item = page.getByTestId('todo-item').filter({ hasText: '寫測試' })
    const toggle = item.getByTestId('todo-toggle')
    await toggle.click()

    await expect(toggle).toBeChecked()
    await expect(item).toHaveAttribute('data-completed', 'true')
    await expect(page.getByTestId('todo-count')).toContainText('0')
  })

  test('可以刪除待辦事項', async ({ page }) => {
    await page.getByTestId('todo-input').fill('臨時事項')
    await page.getByTestId('todo-add').click()

    const item = page.getByTestId('todo-item').filter({ hasText: '臨時事項' })
    await expect(item).toBeVisible()

    await item.getByTestId('todo-delete').click()
    await expect(item).toHaveCount(0)
    await expect(page.getByTestId('empty-state')).toBeVisible()
  })

  test('重新整理後資料仍在（由 Rust API 保存）', async ({ page }) => {
    await page.getByTestId('todo-input').fill('持久化檢查')
    await page.getByTestId('todo-add').click()
    await expect(
      page.getByTestId('todo-item').filter({ hasText: '持久化檢查' }),
    ).toBeVisible()

    await page.reload()
    await expect(
      page.getByTestId('todo-item').filter({ hasText: '持久化檢查' }),
    ).toBeVisible()
  })
})
