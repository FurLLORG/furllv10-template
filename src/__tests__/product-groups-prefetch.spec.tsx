import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProductGroupsPrefetch } from '@/features/cart/product-groups-prefetch'

vi.mock('@/api', () => ({
  fetchProductGroupFirst: vi.fn().mockResolvedValue({
    status: 200,
    msg: 'ok',
    data: {
      list: [
        { id: 1, name: '云服务器' },
        { id: 2, name: '独立服务器' },
      ],
      count: 2,
    },
  }),
  fetchProductGroupSecond: vi.fn().mockResolvedValue({
    status: 200,
    msg: 'ok',
    data: {
      list: [
        { id: 11, name: '国内云' },
        { id: 12, name: '海外云' },
      ],
      count: 2,
    },
  }),
  fetchProductList: vi.fn().mockResolvedValue({
    status: 200,
    msg: 'ok',
    data: {
      list: [{ id: 111, name: '云服务器 S1' }],
      count: 1,
    },
  }),
  getErrorMessage: (e: unknown) => (e as Error)?.message || 'error',
  api: {},
}))

import {
  fetchProductGroupFirst,
  fetchProductGroupSecond,
  fetchProductList,
} from '@/api'

describe('ProductGroupsPrefetch 预取链路', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  it('打开界面即预取一级分组 → 第一个分组的二级分组 → 该二级分组的产品', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ProductGroupsPrefetch />
      </QueryClientProvider>
    )

    // 一级分组先请求
    await vi.waitFor(() =>
      expect(fetchProductGroupFirst).toHaveBeenCalled()
    )

    // 拿到第一个一级分组（id=1）后请求其二级分组
    await vi.waitFor(() =>
      expect(fetchProductGroupSecond).toHaveBeenCalledWith(1)
    )

    // 拿到第一个二级分组（id=11）后请求该组产品
    await vi.waitFor(() =>
      expect(fetchProductList).toHaveBeenCalledWith({ id: 11 })
    )
  })

  it('预取数据写入与商品列表页一致的 queryKey 缓存', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ProductGroupsPrefetch />
      </QueryClientProvider>
    )

    await vi.waitFor(() =>
      expect(queryClient.getQueryData(['cart-goods-first'])).toBeDefined()
    )
    await vi.waitFor(() =>
      expect(
        queryClient.getQueryData(['cart-goods-second', 1])
      ).toBeDefined()
    )
    await vi.waitFor(() =>
      expect(
        queryClient.getQueryData(['cart-goods-products', 11, ''])
      ).toBeDefined()
    )

    // 缓存内容即商品列表页渲染所需数据
    const products = queryClient.getQueryData<{
      data: { list: Array<{ id: number; name: string }> }
    }>(['cart-goods-products', 11, ''])
    expect(products?.data.list).toEqual([{ id: 111, name: '云服务器 S1' }])
  })
})
