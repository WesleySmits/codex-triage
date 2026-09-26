import { describe, expect, it } from 'vitest'

import type { Task } from '../server/task-types'
import {
  arrangeTasks,
  filterTasks,
  projectCounts,
  projectGroups,
  tasksInView,
} from './task-filter'

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

describe('task arrangement', () => {
  it('sorts by activity or creation date without mutating the snapshot', () => {
    const base = tasks[0]
    if (!base) throw new Error('Missing test task')
    const items = [
      { ...base, id: 'a', createdAt: 10, updatedAt: 20 },
      { ...base, id: 'b', createdAt: 30, updatedAt: 15 },
      { ...base, id: 'c', createdAt: 20, updatedAt: 25 },
    ]
    expect(
      arrangeTasks(items, 'recent', 'none').map((task) => task.id),
    ).toEqual(['c', 'a', 'b'])
    expect(
      arrangeTasks(items, 'created-newest', 'none').map((task) => task.id),
    ).toEqual(['b', 'c', 'a'])
    expect(
      arrangeTasks(items, 'created-oldest', 'none').map((task) => task.id),
    ).toEqual(['a', 'c', 'b'])
    expect(items.map((task) => task.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps filtered project groups contiguous through a page boundary', () => {
    const base = tasks[0]
    if (!base) throw new Error('Missing test task')
    const items = Array.from({ length: 27 }, (_, index): Task => ({
      ...base,
      id: String(index),
      projectId: index % 2 ? 'second' : 'first',
      createdAt: 100 - index,
      updatedAt: 100 - index,
      pinned: index < 26,
    }))
    const pinned = tasksInView(items, 'pinned')
    const ordered = arrangeTasks(
      filterTasks(pinned, { kind: 'all' }, '', 'en-US'),
      'created-newest',
      'project',
    )
    expect(ordered).toHaveLength(26)
    expect(new Set(ordered.map((task) => task.id)).size).toBe(26)
    expect(
      projectGroups(ordered.slice(0, 25)).map((group) => [
        group.id,
        group.tasks.length,
      ]),
    ).toEqual([
      ['first', 13],
      ['second', 12],
    ])
    expect(
      projectGroups(ordered.slice(25, 50)).map((group) => [
        group.id,
        group.tasks.length,
      ]),
    ).toEqual([['second', 1]])
  })
})
