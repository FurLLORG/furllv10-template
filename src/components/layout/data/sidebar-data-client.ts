import {
  Home,
  Package,
  Receipt,
  Ticket,
  Wallet,
  ShieldCheck,
  UserCircle,
  ArrowLeftRight,
  Landmark,
} from 'lucide-react'
import { FurLLLogo } from '@/assets/furll-logo'
import { type SidebarData } from '../types'

export const clientSidebarData: SidebarData = {
  user: {
    name: '用户',
    email: '',
    avatar: '',
  },
  teams: [
    {
      name: 'FurLL 客户中心',
      logo: FurLLLogo,
      plan: 'FurLLV10',
    },
  ],
  navGroups: [
    {
      title: '总览',
      items: [
        {
          title: '首页',
          url: '/home.htm',
          icon: Home,
        },
      ],
    },
    {
      title: '业务',
      items: [
        {
          title: '我的产品',
          url: '/productList.htm',
          icon: Package,
        },
        {
          title: '账单与充值',
          url: '/finance.htm',
          icon: Receipt,
        },
        {
          title: '消费记录',
          url: '/transaction.htm',
          icon: Wallet,
        },
        {
          title: '提现',
          url: '/withdrawal.htm',
          icon: Landmark,
        },
        {
          title: '产品转移',
          url: '/transfer.htm',
          icon: ArrowLeftRight,
        },
      ],
    },
    {
      title: '服务',
      items: [
        {
          title: '工单',
          url: '/ticket.htm',
          icon: Ticket,
        },
      ],
    },
    {
      title: '账户',
      items: [
        {
          title: '账户设置',
          url: '/account.htm',
          icon: UserCircle,
        },
        {
          title: '安全中心',
          url: '/security.htm',
          icon: ShieldCheck,
        },
      ],
    },
  ],
}
