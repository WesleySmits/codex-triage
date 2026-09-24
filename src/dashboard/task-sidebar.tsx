import type { Project, Task } from '../server/task-types'
import { type Language, translator } from './i18n'
import type { ProjectFilter, View } from './task-filter'

interface Props {
  tasks: Task[]
  projects: Project[]
  view: View
  project: ProjectFilter
  counts: Map<string | null, number>
  pinnedCount: number
  language: Language
  onView: (view: View) => void
  onProject: (project: ProjectFilter) => void
  screen: 'tasks' | 'automations' | 'archived'
  onScreen: (screen: 'tasks' | 'automations' | 'archived') => void
  automationCount: number
}

interface FilterButtonProps {
  active: boolean
  label: string
  count?: number
  onClick: () => void
}

function FilterButton({ active, label, count, onClick }: FilterButtonProps) {
  return (
    <button
      type="button"
      className={active ? 'nav-item active' : 'nav-item'}
      aria-current={active ? 'page' : undefined}
      title={label}
      onClick={onClick}
    >
      <span className="project-name">{label}</span>
      {count !== undefined && <span>{count}</span>}
    </button>
  )
}

export function TaskSidebar({
  tasks,
  projects,
  view,
  project,
  counts,
  pinnedCount,
  language,
  onView,
  onProject,
  screen,
  onScreen,
  automationCount,
}: Props) {
  const t = translator(language)
  return (
    <nav className="sidebar" aria-label={t('filters')}>
      <ScreenFilters
        screen={screen}
        onScreen={onScreen}
        automationCount={automationCount}
        language={language}
      />
      <div className="nav-label">{t('view')}</div>
      <FilterButton
        active={view === 'all'}
        label={t('allTasks')}
        count={tasks.length}
        onClick={() => {
          onView('all')
        }}
      />
      <FilterButton
        active={view === 'pinned'}
        label={t('pinnedOnly')}
        count={pinnedCount}
        onClick={() => {
          onView('pinned')
        }}
      />
      <FilterButton
        active={view === 'unpinned'}
        label={t('unpinnedOnly')}
        count={tasks.length - pinnedCount}
        onClick={() => {
          onView('unpinned')
        }}
      />
      <ProjectFilters
        projects={projects}
        project={project}
        counts={counts}
        language={language}
        onProject={onProject}
      />
    </nav>
  )
}

function ScreenFilters({
  screen,
  onScreen,
  automationCount,
  language,
}: Pick<Props, 'screen' | 'onScreen' | 'automationCount' | 'language'>) {
  const t = translator(language)
  return (
    <>
      <FilterButton
        active={screen === 'tasks'}
        label={t('tasks')}
        onClick={() => {
          onScreen('tasks')
        }}
      />
      <FilterButton
        active={screen === 'automations'}
        label={t('automations')}
        count={automationCount}
        onClick={() => {
          onScreen('automations')
        }}
      />
      <FilterButton
        active={screen === 'archived'}
        label={t('archivedTasks')}
        onClick={() => {
          onScreen('archived')
        }}
      />
    </>
  )
}

type ProjectProps = Pick<
  Props,
  'projects' | 'project' | 'counts' | 'language' | 'onProject'
>

function ProjectFilters({
  projects,
  project,
  counts,
  language,
  onProject,
}: ProjectProps) {
  const t = translator(language)
  const label = (item: Project) =>
    item.name ?? t('unknownProject', { id: item.id.slice(0, 8) })
  const sorted = [...projects].sort((a, b) =>
    label(a).localeCompare(label(b), language),
  )
  return (
    <>
      <div className="nav-label project-heading">{t('projects')}</div>
      <FilterButton
        active={project.kind === 'all'}
        label={t('allProjects')}
        onClick={() => {
          onProject({ kind: 'all' })
        }}
      />
      <FilterButton
        active={project.kind === 'none'}
        label={t('noProject')}
        count={counts.get(null) ?? 0}
        onClick={() => {
          onProject({ kind: 'none' })
        }}
      />
      {sorted.map((item) => (
        <FilterButton
          key={item.id}
          active={project.kind === 'project' && project.id === item.id}
          label={label(item)}
          count={counts.get(item.id) ?? 0}
          onClick={() => {
            onProject({ kind: 'project', id: item.id })
          }}
        />
      ))}
    </>
  )
}
