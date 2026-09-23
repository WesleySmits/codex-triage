import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main>
      <h1>Codex Triage</h1>
      <p>Project setup is ready. Task review features will follow.</p>
    </main>
  )
}
