import './style.css'
import { supabase } from './lib/supabase'
import type { CategoryWithLinks, StudyCategory, StudyLink } from './types'

const app = document.querySelector<HTMLDivElement>('#app')!

const SCHEMA_SQL = `-- สร้างตารางสำหรับ Study Todo
create table if not exists public.study_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_links (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.study_categories (id) on delete cascade,
  title text not null,
  url text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.study_categories enable row level security;
alter table public.study_links enable row level security;

create policy "study_categories_select" on public.study_categories for select to anon, authenticated using (true);
create policy "study_categories_insert" on public.study_categories for insert to anon, authenticated with check (true);
create policy "study_categories_update" on public.study_categories for update to anon, authenticated using (true) with check (true);
create policy "study_categories_delete" on public.study_categories for delete to anon, authenticated using (true);
create policy "study_links_select" on public.study_links for select to anon, authenticated using (true);
create policy "study_links_insert" on public.study_links for insert to anon, authenticated with check (true);
create policy "study_links_update" on public.study_links for update to anon, authenticated using (true) with check (true);
create policy "study_links_delete" on public.study_links for delete to anon, authenticated using (true);`

let categories: CategoryWithLinks[] = []
let needsSetup = false

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
  return `${done}/${links.length} เรียนแล้ว`
}

function progressPercent(links: StudyLink[]): number {
  if (links.length === 0) return 0
  const done = links.filter((l) => l.completed).length
  return Math.round((done / links.length) * 100)
}

function renderSetupBanner(): string {
  if (!needsSetup) return ''

  return `
    <section class="setup-banner" role="alert">
      <div class="setup-banner__content">
        <h2>ต้องตั้งค่าฐานข้อมูลก่อนใช้งาน</h2>
        <p>เปิด Supabase SQL Editor แล้วรัน SQL ด้านล่างเพื่อสร้างตาราง</p>
        <div class="setup-banner__actions">
          <a
            class="btn btn--primary"
            href="https://supabase.com/dashboard/project/rwsyiiulfbolymxppvmy/sql/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            เปิด SQL Editor
          </a>
          <button type="button" class="btn btn--ghost" id="copy-schema-btn">คัดลอก SQL</button>
          <button type="button" class="btn btn--ghost" id="retry-setup-btn">ลองใหม่</button>
        </div>
        <pre class="setup-banner__sql"><code>${escapeHtml(SCHEMA_SQL)}</code></pre>
      </div>
    </section>
  `
}

function renderCategory(category: CategoryWithLinks): string {
  const percent = progressPercent(category.links)

  const linksHtml =
    category.links.length === 0
      ? '<p class="empty-state">ยังไม่มีลิงก์ — เพิ่มเนื้อหาที่ต้องเรียนด้านล่าง</p>'
      : `<ul class="link-list">
          ${category.links
            .map(
              (link) => `
            <li class="link-item ${link.completed ? 'link-item--done' : ''}" data-link-id="${link.id}">
              <label class="checkbox">
                <input
                  type="checkbox"
                  class="toggle-complete"
                  data-link-id="${link.id}"
                  ${link.completed ? 'checked' : ''}
                  ${needsSetup ? 'disabled' : ''}
                />
                <span class="checkbox__mark"></span>
              </label>
              <div class="link-item__body">
                <a
                  class="link-item__title"
                  href="${escapeHtml(normalizeUrl(link.url))}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ${escapeHtml(link.title)}
                </a>
                <span class="link-item__url">${escapeHtml(link.url)}</span>
              </div>
              <button
                type="button"
                class="icon-btn delete-link"
                data-link-id="${link.id}"
                title="ลบลิงก์"
                aria-label="ลบลิงก์"
                ${needsSetup ? 'disabled' : ''}
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
      <header class="category-card__header">
        <div>
          <h2 class="category-card__title">${escapeHtml(category.name)}</h2>
          <p class="category-card__progress">${progressText(category.links)}</p>
        </div>
        <button
          type="button"
          class="icon-btn delete-category"
          data-category-id="${category.id}"
          title="ลบหมวดหมู่"
          aria-label="ลบหมวดหมู่"
          ${needsSetup ? 'disabled' : ''}
        >
          🗑
        </button>
      </header>
      <div class="progress-bar" aria-hidden="true">
        <div class="progress-bar__fill" style="width: ${percent}%"></div>
      </div>
      ${linksHtml}
      <form class="add-link-form" data-category-id="${category.id}">
        <input
          type="text"
          name="title"
          placeholder="ชื่อเนื้อหา เช่น บทที่ 1"
          required
          ${needsSetup ? 'disabled' : ''}
        />
        <input
          type="url"
          name="url"
          placeholder="https://..."
          required
          ${needsSetup ? 'disabled' : ''}
        />
        <button type="submit" class="btn btn--secondary" ${needsSetup ? 'disabled' : ''}>เพิ่มลิงก์</button>
      </form>
    </article>
  `
}

function render(): void {
  const totalLinks = categories.reduce((sum, c) => sum + c.links.length, 0)
  const totalDone = categories.reduce(
    (sum, c) => sum + c.links.filter((l) => l.completed).length,
    0,
  )

  app.innerHTML = `
    <div class="page">
      <header class="hero">
        <div class="hero__badge">📚 Study Todo</div>
        <h1>รายการเรียน</h1>
        <p>สร้างหมวดหมู่ → ใส่ลิงก์เนื้อหา → ติ๊กเมื่อเรียนเสร็จ</p>
        <div class="hero__stats">
          <div class="stat">
            <span class="stat__value">${categories.length}</span>
            <span class="stat__label">หมวดหมู่</span>
          </div>
          <div class="stat">
            <span class="stat__value">${totalDone}/${totalLinks}</span>
            <span class="stat__label">เรียนแล้ว</span>
          </div>
        </div>
      </header>

      ${renderSetupBanner()}

      <section class="panel">
        <h2 class="panel__title">เพิ่มหมวดหมู่เรียน</h2>
        <form id="add-category-form" class="add-category-form">
          <input
            type="text"
            name="name"
            placeholder="เช่น JavaScript, คณิตศาสตร์, ภาษาอังกฤษ"
            required
            ${needsSetup ? 'disabled' : ''}
          />
          <button type="submit" class="btn btn--primary" ${needsSetup ? 'disabled' : ''}>
            สร้างหมวดหมู่
          </button>
        </form>
      </section>

      <section class="categories">
        ${
          categories.length === 0
            ? `<div class="empty-panel">
                <p>ยังไม่มีหมวดหมู่ — เริ่มต้นด้วยการสร้างหมวดหมู่แรกของคุณ</p>
              </div>`
            : categories.map(renderCategory).join('')
        }
      </section>
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
  }, 2800)
}

async function checkDatabaseSetup(): Promise<boolean> {
  const { error } = await supabase.from('study_categories').select('id').limit(1)
  if (!error) return true

  if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
    return false
  }

  throw error
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

  categories = (categoryRows ?? []).map((category: StudyCategory) => ({
    ...category,
    links: linksByCategory.get(category.id) ?? [],
  }))
}

async function init(): Promise<void> {
  try {
    needsSetup = !(await checkDatabaseSetup())
    if (!needsSetup) {
      await loadData()
    }
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
  render()
  showToast('สร้างหมวดหมู่แล้ว')
}

async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('study_categories').delete().eq('id', id)
  if (error) throw error

  categories = categories.filter((c) => c.id !== id)
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

  document.querySelector<HTMLButtonElement>('#copy-schema-btn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(SCHEMA_SQL)
      showToast('คัดลอก SQL แล้ว')
    } catch {
      showToast('คัดลอกไม่สำเร็จ', true)
    }
  })

  document.querySelector<HTMLButtonElement>('#retry-setup-btn')?.addEventListener('click', () => {
    void init()
  })
}

void init()
