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

const homeRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'home.htm',
})

// 复刻 router.tsx：声明父为 clientRoute，但树中挂在 rootRoute 下
const goodsListRoute = createRoute({
  getParentRoute: () => clientRoute,
  path: 'cart/goodsList.htm',
})

const routeTree = rootRoute.addChildren([
  clientRoute.addChildren([homeRoute]),
  goodsListRoute,
])

const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/home.htm'] }),
  defaultPreload: false,
})

router.history.push('/cart/goodsList.htm')
await router.load()
console.log('goodsList fullPath:', goodsListRoute.fullPath)
console.log('goodsList parent id:', goodsListRoute.id)
console.log(
  'matches:',
  router.state.matches.map((m) => m.routeId).join(' → ')
)
console.log('matched pathname:', router.state.location.pathname)
console.log('found route:', router.state.matches.at(-1)?.routeId)

router.history.push('/home.htm')
await router.load()
console.log(
  'back to home matches:',
  router.state.matches.map((m) => m.routeId).join(' → ')
)
