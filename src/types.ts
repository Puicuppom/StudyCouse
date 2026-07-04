export interface StudyCategory {
  id: string
  name: string
  created_at: string
}

export interface StudyLink {
  id: string
  category_id: string
  title: string
  url: string
  completed: boolean
  created_at: string
}

export interface CategoryWithLinks extends StudyCategory {
  links: StudyLink[]
}
