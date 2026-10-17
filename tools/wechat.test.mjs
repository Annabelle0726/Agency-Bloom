import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { runWeChatCli } from './wechat.mjs'

test('open fails when the installed CLI reports a disabled port with exit code zero', { skip: process.platform !== 'win32' }, async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'agency wechat '))
  try {
    const cli = path.join(fixture, 'cli.cmd')
    await writeFile(cli, '@echo off\r\necho [error] IDE service port disabled.\r\nexit /b 0\r\n')
    await assert.rejects(runWeChatCli(cli, fixture), /service port.*disabled/i)
  } finally { await rm(fixture, { recursive: true, force: true }) }
})

test('open rejects an unknown build mode before invoking the developer tools', () => {
  const result = spawnSync(process.execPath, ['tools/wechat.mjs', 'open', 'production-typo'], {
    cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Use dev or build/)
})
