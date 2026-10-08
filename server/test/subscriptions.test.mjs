import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import {
  ensureTables,
  listSubscriptions,
  addSubscription,
  getSubscription,
  updateSubscription,
  deleteSubscription,
  recordFetch,
  getContent,
} from '../subscriptions/store.mjs'
import { countNodesHeuristic } from '../subscriptions/fetcher.mjs'

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sub-test-'))
const db = new DatabaseSync(path.join(tmp, 'test.sqlite'))
ensureTables(db)

test('增删改查', () => {
  const s = addSubscription(db, { name: '测试', url: 'https://example.com/sub' })
  assert.equal(s.name, '测试')
  assert.equal(s.enabled, true)

  assert.equal(listSubscriptions(db).length, 1)

  const updated = updateSubscription(db, s.id, { name: '改名', enabled: false })
  assert.equal(updated.name, '改名')
  assert.equal(updated.enabled, false)

  assert.equal(deleteSubscription(db, s.id), true)
  assert.equal(getSubscription(db, s.id), null)
})

test('非法输入被拒绝', () => {
  assert.throws(() => addSubscription(db, { name: '', url: 'https://x.com' }), /name/)
  assert.throws(() => addSubscription(db, { name: 'a', url: 'ftp://x.com' }), /http/)
})

test('recordFetch 存内容与错误', () => {
  const s = addSubscription(db, { name: '拉取测试', url: 'https://example.com/2' })
  recordFetch(db, s.id, { content: 'vless://x\nvmess://y', nodeCount: 2 })
  const c = getContent(db, s.id)
  assert.ok(c.content.includes('vless://'))
  const after = getSubscription(db, s.id)
  assert.equal(after.last_node_count, 2)
  assert.equal(after.last_error, null)

  recordFetch(db, s.id, { error: 'HTTP 404' })
  assert.equal(getSubscription(db, s.id).last_error, 'HTTP 404')
  // 失败不覆盖上次成功的内容
  assert.ok(getContent(db, s.id).content.includes('vless://'))
})

test('countNodesHeuristic 启发式计数', () => {
  assert.equal(countNodesHeuristic('vless://a\ntrojan://b\n\n'), 2)
  const b64 = Buffer.from('ss://x\nss://y').toString('base64')
  assert.equal(countNodesHeuristic(b64), 2)
  assert.equal(countNodesHeuristic(''), 0)
})
