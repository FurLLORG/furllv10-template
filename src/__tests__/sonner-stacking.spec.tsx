import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/context/theme-provider'
import { Toaster } from '@/components/ui/sonner'

vi.mock('sonner', () => ({
  Toaster: (props: { style?: React.CSSProperties }) => (
    <div data-testid='sonner-toaster' style={props.style} />
  ),
}))

describe('Toaster stacking', () => {
  it('sets the layer on the toaster container', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <Toaster style={{ zIndex: 1 }} />
      </ThemeProvider>
    )

    expect(getByTestId('sonner-toaster').style.zIndex).toBe('99999')
  })
})
