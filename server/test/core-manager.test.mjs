import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getPinnedVersion,
  getInstalledVersion,
  checkForUpdate,
} from '../core/manager.mjs'

test('getPinnedVersion 读到版本文件', async () => {
  const v = await getPinnedVersion()
  assert.match(v, /^v\d+\.\d+\.\d+$/, `版本格式不对: ${v}`)
})

test('getInstalledVersion 没装二进制时返回 null', async () => {
  // core/bin/mihomo 默认不存在（仓库不提交二进制）
  const v = await getInstalledVersion()
  assert.ok(v === null || /^v\d+\.\d+\.\d+$/.test(v))
})

test('checkForUpdate 能对比版本（mock fetch）', async () => {
  const pinned = await getPinnedVersion()
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ tag_name: 'v9.9.9' }),
  })
  const r = await checkForUpdate(fakeFetch)
  assert.equal(r.pinned, pinned)
  assert.equal(r.latest, 'v9.9.9')
  assert.equal(r.updateAvailable, true)
})

test('checkForUpdate 版本一致时无更新', async () => {
  const pinned = await getPinnedVersion()
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ tag_name: pinned }),
  })
  const r = await checkForUpdate(fakeFetch)
  assert.equal(r.updateAvailable, false)
})

test('checkForUpdate 上游失败时抛错', async () => {
  const fakeFetch = async () => ({ ok: false, status: 403 })
  await assert.rejects(() => checkForUpdate(fakeFetch), /GitHub API 403/)
})
