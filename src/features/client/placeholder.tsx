import { Link } from '@tanstack/react-router'
import { Construction } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <Card>
      <CardContent className='flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center'>
        <Construction className='h-10 w-10 text-muted-foreground' />
        <div>
          <p className='text-base font-medium'>{title}</p>
          <p className='mt-1 text-sm text-muted-foreground'>
            该页面正在开发中，敬请期待
          </p>
        </div>
        <Button variant='outline' size='sm' asChild>
          <Link to='/home.htm'>返回首页</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
