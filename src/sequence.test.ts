import { describe, it, expect, vi } from 'vitest'
import { forEachInSequence } from './sequence.js'

describe('forEachInSequence', () => {
  it('runs each task after the previous one settles', async () => {
    const order: string[] = []
    await forEachInSequence([30, 10, 20], async (delay) => {
      order.push(`start ${delay}`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      order.push(`end ${delay}`)
    })
    expect(order).toEqual(['start 30', 'end 30', 'start 10', 'end 10', 'start 20', 'end 20'])
  })

  it('stops at the first failing task', async () => {
    const task = vi.fn(async (item: number) => {
      if (item === 2) throw new Error('boom')
    })
    await expect(forEachInSequence([1, 2, 3], task)).rejects.toThrow('boom')
    expect(task).toHaveBeenCalledTimes(2)
  })

  it('resolves immediately for an empty list', async () => {
    const task = vi.fn()
    await forEachInSequence([], task)
    expect(task).not.toHaveBeenCalled()
  })
})
