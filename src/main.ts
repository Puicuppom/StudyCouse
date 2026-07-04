import './style.css'
import { supabase } from './lib/supabase'
import type { CategoryWithLinks, StudyCategory, StudyLink } from './types'

const app = document.querySelector<HTMLDivElement>('#app')!

let categories: CategoryWithLinks[] = []
let expandedCategories = new Set<string>()

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function progressText(links: StudyLink[]): string {
  if (links.length === 0) return 'ยังไม่มีเนื้อหา'
  const done = links.filter((l) => l.completed).length
  return `${done}/${links.length}`
}

function progressPercent(links: StudyLink[]): number {
  if (links.length === 0) return 0
  const done = links.filter((l) => l.completed).length
  return Math.round((done / links.length) * 100)
}

function isExpanded(categoryId: string): boolean {
  return expandedCategories.has(categoryId)
}

function renderCategory(category: CategoryWithLinks): string {
  const percent = progressPercent(category.links)
  const expanded = isExpanded(category.id)

  const linksHtml =
    category.links.length === 0
      ? '<p class="empty-state">ยังไม่มีลิงก์</p>'
      : `<ul class="link-list">
          ${category.links
            .map(
              (link) => `
            <li class="link-item ${link.completed ? 'link-item--done' : ''}" data-link-id="${link.id}">
              <label class="checkbox" aria-label="ติ๊กว่าเรียนแล้ว">
                <input
                  type="checkbox"
                  class="toggle-complete"
                  data-link-id="${link.id}"
                  ${link.completed ? 'checked' : ''}
                />
                <span class="checkbox__mark"></span>
              </label>
              <a
                class="link-item__title"
                href="${escapeHtml(normalizeUrl(link.url))}"
                target="_blank"
                rel="noopener noreferrer"
              >
                ${escapeHtml(link.title)}
              </a>
              <button
                type="button"
                class="icon-btn delete-link"
                data-link-id="${link.id}"
                aria-label="ลบลิงก์"
              >
                ✕
              </button>
            </li>
          `,
            )
            .join('')}
        </ul>`

  return `
    <article class="category-card" data-category-id="${category.id}">
      <button
        type="button"
        class="category-card__toggle"
        data-category-id="${category.id}"
        aria-expanded="${expanded}"
      >
        <div class="category-card__summary">
          <h2 class="category-card__title">${escapeHtml(category.name)}</h2>
          <span class="category-card__progress">${progressText(category.links)} เรียนแล้ว</span>
        </div>
        <div class="category-card__meta">
          <span class="category-card__percent">${percent}%</span>
          <span class="category-card__chevron" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
        </div>
      </button>
      <div class="progress-bar" aria-hidden="true">
        <div class="progress-bar__fill" style="width: ${percent}%"></div>
      </div>
      <div class="category-card__body ${expanded ? 'category-card__body--open' : ''}">
        ${linksHtml}
        <form class="add-link-form" data-category-id="${category.id}">
          <input
            type="text"
            name="title"
            placeholder="ชื่อเนื้อหา"
            required
            autocomplete="off"
          />
          <input
            type="text"
            name="url"
            placeholder="ลิงก์ https://..."
            required
            inputmode="url"
            autocomplete="off"
          />
          <button type="submit" class="btn btn--secondary btn--block">+ เพิ่มลิงก์</button>
        </form>
        <button
          type="button"
          class="btn btn--danger-text delete-category"
          data-category-id="${category.id}"
        >
          ลบหมวดหมู่นี้
        </button>
      </div>
    </article>
  `
}

function render(): void {
  const totalLinks = categories.reduce((sum, c) => sum + c.links.length, 0)
  const totalDone = categories.reduce(
    (sum, c) => sum + c.links.filter((l) => l.completed).length,
    0,
  )
  const totalPercent = totalLinks === 0 ? 0 : Math.round((totalDone / totalLinks) * 100)

  app.innerHTML = `
    <div class="page">
      <header class="topbar">
        <div class="topbar__brand">
          <span class="topbar__icon" aria-hidden="true">📚</span>
          <div>
            <h1>รายการเรียน</h1>
            <p>${categories.length} หมวด · ${totalDone}/${totalLinks} เรียนแล้ว</p>
          </div>
        </div>
        <div class="topbar__ring" style="--progress: ${totalPercent}">
          <span>${totalPercent}%</span>
        </div>
      </header>

      <section class="categories">
        ${
          categories.length === 0
            ? `<div class="empty-panel">
                <p>ยังไม่มีหมวดหมู่</p>
                <span>กดปุ่ม + ด้านล่างเพื่อเริ่มต้น</span>
              </div>`
            : categories.map(renderCategory).join('')
        }
      </section>
    </div>

    <div class="bottom-bar">
      <form id="add-category-form" class="add-category-form">
        <input
          type="text"
          name="name"
          placeholder="ชื่อหมวดหมู่ใหม่"
          required
          autocomplete="off"
        />
        <button type="submit" class="btn btn--primary btn--fab" aria-label="สร้างหมวดหมู่">
          +
        </button>
      </form>
    </div>

    <div id="toast" class="toast" hidden></div>
  `

  bindEvents()
}

function showToast(message: string, isError = false): void {
  const toast = document.querySelector<HTMLDivElement>('#toast')
  if (!toast) return

  toast.textContent = message
  toast.classList.toggle('toast--error', isError)
  toast.hidden = false

  window.setTimeout(() => {
    toast.hidden = true
  }, 2600)
}

async function loadData(): Promise<void> {
  const [{ data: categoryRows, error: catError }, { data: linkRows, error: linkError }] =
    await Promise.all([
      supabase.from('study_categories').select('*').order('created_at', { ascending: true }),
      supabase.from('study_links').select('*').order('created_at', { ascending: true }),
    ])

  if (catError) throw catError
  if (linkError) throw linkError

  const linksByCategory = new Map<string, StudyLink[]>()
  for (const link of linkRows ?? []) {
    const list = linksByCategory.get(link.category_id) ?? []
    list.push(link)
    linksByCategory.set(link.category_id, list)
  }

  const nextCategories = (categoryRows ?? []).map((category: StudyCategory) => ({
    ...category,
    links: linksByCategory.get(category.id) ?? [],
  }))

  if (expandedCategories.size === 0 && nextCategories.length > 0) {
    expandedCategories = new Set([nextCategories[0].id])
  }

  categories = nextCategories
}

async function init(): Promise<void> {
  try {
    await loadData()
  } catch (error) {
    console.error(error)
    showToast('โหลดข้อมูลไม่สำเร็จ', true)
  }

  render()
}

async function addCategory(name: string): Promise<void> {
  const { data, error } = await supabase
    .from('study_categories')
    .insert({ name })
    .select()
    .single()

  if (error) throw error

  categories.push({ ...data, links: [] })
  expandedCategories.add(data.id)
  render()
  showToast('สร้างหมวดหมู่แล้ว')
}

async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('study_categories').delete().eq('id', id)
  if (error) throw error

  categories = categories.filter((c) => c.id !== id)
  expandedCategories.delete(id)
  render()
  showToast('ลบหมวดหมู่แล้ว')
}

async function addLink(categoryId: string, title: string, url: string): Promise<void> {
  const { data, error } = await supabase
    .from('study_links')
    .insert({
      category_id: categoryId,
      title,
      url: normalizeUrl(url),
    })
    .select()
    .single()

  if (error) throw error

  const category = categories.find((c) => c.id === categoryId)
  if (category) {
    category.links.push(data)
  }

  expandedCategories.add(categoryId)
  render()
  showToast('เพิ่มลิงก์แล้ว')
}

async function toggleComplete(linkId: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from('study_links')
    .update({ completed })
    .eq('id', linkId)

  if (error) throw error

  for (const category of categories) {
    const link = category.links.find((l) => l.id === linkId)
    if (link) {
      link.completed = completed
      break
    }
  }

  render()
}

async function deleteLink(linkId: string): Promise<void> {
  const { error } = await supabase.from('study_links').delete().eq('id', linkId)
  if (error) throw error

  for (const category of categories) {
    category.links = category.links.filter((l) => l.id !== linkId)
  }

  render()
  showToast('ลบลิงก์แล้ว')
}

function bindEvents(): void {
  document.querySelector<HTMLFormElement>('#add-category-form')?.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault()
      const form = event.currentTarget as HTMLFormElement
      const formData = new FormData(form)
      const name = String(formData.get('name') ?? '').trim()
      if (!name) return

      try {
        await addCategory(name)
        form.reset()
      } catch (error) {
        console.error(error)
        showToast('สร้างหมวดหมู่ไม่สำเร็จ', true)
      }
    },
  )

  document.querySelectorAll<HTMLButtonElement>('.category-card__toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const categoryId = button.dataset.categoryId
      if (!categoryId) return

      if (expandedCategories.has(categoryId)) {
        expandedCategories.delete(categoryId)
      } else {
        expandedCategories.add(categoryId)
      }

      render()
    })
  })

  document.querySelectorAll<HTMLFormElement>('.add-link-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const categoryId = form.dataset.categoryId
      if (!categoryId) return

      const formData = new FormData(form)
      const title = String(formData.get('title') ?? '').trim()
      const url = String(formData.get('url') ?? '').trim()
      if (!title || !url) return

      try {
        await addLink(categoryId, title, url)
        form.reset()
      } catch (error) {
        console.error(error)
        showToast('เพิ่มลิงก์ไม่สำเร็จ', true)
      }
    })
  })

  document.querySelectorAll<HTMLInputElement>('.toggle-complete').forEach((input) => {
    input.addEventListener('change', async () => {
      const linkId = input.dataset.linkId
      if (!linkId) return

      try {
        await toggleComplete(linkId, input.checked)
      } catch (error) {
        console.error(error)
        input.checked = !input.checked
        showToast('อัปเดตสถานะไม่สำเร็จ', true)
      }
    })
  })

  document.querySelectorAll<HTMLButtonElement>('.delete-category').forEach((button) => {
    button.addEventListener('click', async () => {
      const categoryId = button.dataset.categoryId
      if (!categoryId) return
      if (!confirm('ลบหมวดหมู่นี้และลิงก์ทั้งหมด?')) return

      try {
        await deleteCategory(categoryId)
      } catch (error) {
        console.error(error)
        showToast('ลบหมวดหมู่ไม่สำเร็จ', true)
      }
    })
  })

  document.querySelectorAll<HTMLButtonElement>('.delete-link').forEach((button) => {
    button.addEventListener('click', async () => {
      const linkId = button.dataset.linkId
      if (!linkId) return
      if (!confirm('ลบลิงก์นี้?')) return

      try {
        await deleteLink(linkId)
      } catch (error) {
        console.error(error)
        showToast('ลบลิงก์ไม่สำเร็จ', true)
      }
    })
  })
}

void init()
