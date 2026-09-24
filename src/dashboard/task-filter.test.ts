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
      filterTasks(tasks, { kind: 'project', id: 'a' }, 'beta', 'en-US').map(
        (task) => task.id,
      ),
    ).toEqual(['2'])
    expect(
      filterTasks(tasks, { kind: 'none' }, '', 'en-US').map((task) => task.id),
    ).toEqual(['3'])
    expect(
      filterTasks(tasks, { kind: 'all' }, 'north', 'en-US').map(
        (task) => task.id,
      ),
    ).toEqual(['1', '2'])
  })

  it('can select projects whose IDs match filter labels', () => {
    const task = (id: string, projectId: string | null): Task => ({
      id,
      projectId,
      title: id,
      createdAt: 1,
      updatedAt: 2,
      pinned: false,
      projectName: null,
      automationId: null,
    })
    const special: Task[] = [
      task('all-project', 'all'),
      task('none-project', 'none'),
      task('projectless', null),
    ]
    expect(
      filterTasks(special, { kind: 'project', id: 'all' }, '', 'en-US').map(
        (task) => task.id,
      ),
    ).toEqual(['all-project'])
    expect(
      filterTasks(special, { kind: 'project', id: 'none' }, '', 'en-US').map(
        (task) => task.id,
      ),
    ).toEqual(['none-project'])
    expect(
      filterTasks(special, { kind: 'none' }, '', 'en-US').map(
        (task) => task.id,
      ),
    ).toEqual(['projectless'])
  })
})
