import { spawn, type ChildProcess } from 'node:child_process'

const viteArgs = process.argv.slice(2)
const children: ChildProcess[] = []
let shuttingDown = false

function start(name: string, command: string, args: string[]) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })

  children.push(child)

  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    shuttingDown = true
    const reason = signal ? `${name} stopped with ${signal}` : `${name} exited with ${code ?? 0}`
    console.error(reason)
    stopChildren()
    process.exit(code ?? 1)
  })
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
}

process.on('SIGINT', () => {
  shuttingDown = true
  stopChildren()
  process.exit(0)
})

process.on('SIGTERM', () => {
  shuttingDown = true
  stopChildren()
  process.exit(0)
})

start('worker', 'bunx', ['wrangler', 'dev', '--port', '8788'])
start('web', 'bunx', ['vite', '--host', '127.0.0.1', ...viteArgs])
