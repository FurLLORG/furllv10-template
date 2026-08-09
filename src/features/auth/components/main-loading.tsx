/**
 * 全屏加载动画（对齐官方 #mainLoading：五根条形柱交错 scaleY 跳动）。
 * 登录/注册页在公共配置（/common）未获取完成前显示。
 */
export function MainLoading({ text }: { text?: string }) {
  return (
    <div className='fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background'>
      <div className='flex items-center justify-center'>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className='auth-loading-bar mx-[2px]'
            style={{ animationDelay: `${-1 + i * 0.1}s` }}
          />
        ))}
      </div>
      {text && (
        <p className='mt-6 text-sm text-muted-foreground'>{text}</p>
      )}
      <style>{`
        @keyframes auth-loading-keyframes {
          0%, 40%, 100% { transform: scaleY(0.5); }
          20% { transform: scaleY(1); }
        }
        .auth-loading-bar {
          width: 8px;
          height: 48px;
          background-color: var(--color-primary, hsl(var(--primary)));
          animation: auth-loading-keyframes 1s infinite ease-in-out;
        }
      `}</style>
    </div>
  )
}
