import { describe, expect, it } from 'vitest'
import { extractRequestId, findVideoUrl, parseStatus } from './higgsfield'

describe('extractRequestId', () => {
  it('reads the common shapes', () => {
    expect(extractRequestId({ id: 'r1' })).toBe('r1')
    expect(extractRequestId({ request_id: 'r2' })).toBe('r2')
    expect(extractRequestId({ jobs: [{ id: 'r3' }] })).toBe('r3')
  })
  it('null on garbage', () => {
    expect(extractRequestId(null)).toBeNull()
    expect(extractRequestId({ jobs: [] })).toBeNull()
    expect(extractRequestId('r4')).toBeNull()
  })
})

describe('findVideoUrl', () => {
  it('finds nested video urls in varying shapes', () => {
    expect(findVideoUrl({ results: { raw: { url: 'https://cdn.x/video/abc.mp4' } } })).toBe('https://cdn.x/video/abc.mp4')
    expect(findVideoUrl({ jobs: [{ result: { video_url: 'https://cdn.x/a.webm' } }] })).toBe('https://cdn.x/a.webm')
    expect(findVideoUrl([{ url: 'https://cdn.x/take.mov?sig=1' }])).toBe('https://cdn.x/take.mov?sig=1')
  })
  it('ignores non-video urls and non-urls', () => {
    expect(findVideoUrl({ url: 'https://cdn.x/thumb.jpg' })).toBeNull()
    expect(findVideoUrl({ note: 'no url here' })).toBeNull()
  })
})

describe('parseStatus', () => {
  it('pending while queued/in_progress', () => {
    expect(parseStatus({ status: 'queued' }).state).toBe('pending')
    expect(parseStatus({ status: 'in_progress' }).state).toBe('pending')
  })
  it('done with url on completed', () => {
    const r = parseStatus({ status: 'completed', results: [{ raw: { url: 'https://c/x.mp4' } }] })
    expect(r).toEqual({ state: 'done', url: 'https://c/x.mp4' })
  })
  it('completed WITHOUT a url is failed, not silently done', () => {
    expect(parseStatus({ status: 'completed' }).state).toBe('failed')
  })
  it('failed / nsfw map to failed with the reason', () => {
    expect(parseStatus({ status: 'nsfw' })).toEqual({ state: 'failed', reason: 'nsfw' })
  })
})
