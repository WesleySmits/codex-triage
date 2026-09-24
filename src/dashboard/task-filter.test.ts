import { describe, expect, it } from 'vitest'

import type { Task } from '../server/task-types'
import { filterTasks, projectCounts, tasksInView } from './task-filter'

const tasks: Task[] = [
  {
    id: '1',
    title: 'Alpha',
    createdAt: 1,
    updatedAt: 2,
    pinned: true,
    projectId: 'a',
    projectName: 'North',
    automationId: null,
  },
  {
    id: '2',
    title: 'Beta',
    createdAt: 1,
    updatedAt: 2,
    pinned: false,
    projectId: 'a',
    projectName: 'North',
    automationId: null,
  },
  {
    id: '3',
    title: 'Gamma',
    createdAt: 1,
    updatedAt: 2,
    pinned: false,
    projectId: null,
    projectName: null,
    automationId: null,
  },
]

describe('task filters', () => {
  it('changes project counts with the pin view', () => {
    expect(projectCounts(tasksInView(tasks, 'all')).get('a')).toBe(2)
    expect(projectCounts(tasksInView(tasks, 'pinned')).get('a')).toBe(1)
    expect(projectCounts(tasksInView(tasks, 'unpinned')).get(null)).toBe(1)
  })

  it('combines project and title search without losing projectless tasks', () => {
    expect(
      filterTasks(tasks, 'a', 'beta', 'en-US').map((task) => task.id),
    ).toEqual(['2'])
    expect(
      filterTasks(tasks, 'none', '', 'en-US').map((task) => task.id),
    ).toEqual(['3'])
    expect(
      filterTasks(tasks, 'all', 'north', 'en-US').map((task) => task.id),
    ).toEqual(['1', '2'])
  })
})
