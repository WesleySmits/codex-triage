import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCodexClient } from './codex-client'

const temporaryDirectories: string[] = []

async function fakeAppServer(
  mode: 'normal' | 'repeated-cursor' | 'silent' | 'close-stdin',
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'codex-triage-test-'))
  temporaryDirectories.push(directory)
  const executable = join(directory, 'codex')
  const script = `#!/usr/bin/env node
const mode = ${JSON.stringify(mode)};
let input = '';
process.stdin.on('data', chunk => {
  input += chunk;
  let end;
  while ((end = input.indexOf('\\n')) !== -1) {
    const line = input.slice(0, end);
    input = input.slice(end + 1);
    const request = JSON.parse(line);
    if (request.method === 'initialized') {
      if (mode === 'close-stdin') {
        process.stdin.destroy();
        require('node:fs').closeSync(0);
        setInterval(() => {}, 1000);
      }
      continue;
    }
    if (mode === 'silent') continue;
    let result = {};
    if (request.method === 'thread/list') {
      const first = !request.params.cursor;
      result = {
        data: [{ id: first ? 'synthetic-1' : 'synthetic-2', name: null, preview: 'Synthetic task', projectId: null, createdAt: 1, updatedAt: 2 }],
        nextCursor: first || mode === 'repeated-cursor' ? 'next' : null,
      };
    }
    if (request.method === 'project/list') result = { data: [{ id: 'sample', name: 'Synthetic project' }], nextCursor: null };
    if (request.method === 'thread/turns/list') result = { data: [{ items: [{ type: 'userMessage', content: [{ type: 'text', text: 'Automation: Example\\nAutomation ID: synthetic' }] }] }] };
    process.stdout.write(JSON.stringify({ id: request.id, result }) + '\\n');
  }
});
`
  await writeFile(executable, script)
  await chmod(executable, 0o700)
  return executable
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe('Codex app-server transport', () => {
  it('initializes and paginates synthetic tasks', async () => {
    const client = createCodexClient({
      command: await fakeAppServer('normal'),
      requestTimeoutMs: 1_000,
    })
    try {
      await client.connect()
      expect((await client.listActiveThreads()).map((task) => task.id)).toEqual(
        ['synthetic-1', 'synthetic-2'],
      )
      expect(await client.listProjects()).toEqual([
        { id: 'sample', name: 'Synthetic project' },
      ])
      expect(await client.readOpeningUserText('synthetic-1')).toContain(
        'Automation ID: synthetic',
      )
    } finally {
      client.close()
    }
  })

  it('stops repeated cursors', async () => {
    const client = createCodexClient({
      command: await fakeAppServer('repeated-cursor'),
      requestTimeoutMs: 1_000,
    })
    try {
      await client.connect()
      await expect(client.listActiveThreads()).rejects.toThrow(
        'Repeated cursor',
      )
    } finally {
      client.close()
    }
  })

  it('bounds pages and total items', async () => {
    const command = await fakeAppServer('normal')
    const pageLimited = createCodexClient({ command, maxPages: 1 })
    try {
      await pageLimited.connect()
      await expect(pageLimited.listActiveThreads()).rejects.toThrow(
        'Too many pages',
      )
    } finally {
      pageLimited.close()
    }

    const itemLimited = createCodexClient({ command, maxItems: 1 })
    try {
      await itemLimited.connect()
      await expect(itemLimited.listActiveThreads()).rejects.toThrow(
        'Too many results',
      )
    } finally {
      itemLimited.close()
    }
  })

  it('bounds an unresponsive initialization', async () => {
    const client = createCodexClient({
      command: await fakeAppServer('silent'),
      requestTimeoutMs: 50,
    })
    await expect(client.connect()).rejects.toThrow('timed out')
    client.close()
  })

  it('rejects a broken input pipe without crashing the app', async () => {
    const client = createCodexClient({
      command: await fakeAppServer('close-stdin'),
      requestTimeoutMs: 1_000,
    })
    try {
      await client.connect()
      await new Promise((resolve) => setTimeout(resolve, 100))
      await expect(client.listActiveThreads()).rejects.toThrow(
        /input failed|write failed/,
      )
    } finally {
      client.close()
    }
  })
})
