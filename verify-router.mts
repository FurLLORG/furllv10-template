import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'

const rootRoute = createRootRoute()

const clientRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'client',
})

// 免登录公共路由组（cart goodsList / 公告 / 新闻）
const publicClientRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'public-client',
})

const homeRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'home.htm',
})

const settlementRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'cart/settlement.htm',
})

const sourceRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'source.htm',
})

const goodsListRoute = createRoute({
  getParentRoute: () => publicClientRoute,
  path: 'cart/goodsList.htm',
})

const routeTree = rootRoute.addChildren([
  clientRoute.addChildren([homeRoute, settlementRoute, sourceRoute]),
  publicClientRoute.addChildren([goodsListRoute]),
])

const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/home.htm'] }),
  defaultPreload: false,
})

for (const path of [
  '/home.htm',
  '/cart/goodsList.htm',
  '/source.htm',
  '/cart/settlement.htm',
]) {
  router.history.push(path)
  await router.load()
  console.log(
    path,
    '→',
    router.state.matches.map((m) => m.routeId).join(' → ')
  )
}
