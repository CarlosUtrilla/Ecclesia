// @vitest-environment jsdom
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ThemeToolbar from '../ThemeToolbar'

vi.mock('@/ui/fontFamilySelector', () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="font-family"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="Arial">Arial</option>
    </select>
  )
}))

type TestData = {
  textStyle: Record<string, unknown>
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.')
  const root = { ...obj }
  let current: Record<string, unknown> = root

  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]
    const next = (current[key] as Record<string, unknown>) || {}
    current[key] = { ...next }
    current = current[key] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
  return root
}

function TestHarness() {
  const [watchedData, setWatchedData] = useState<TestData>({
    textStyle: {
      color: '#000000',
      fontSize: 24
    }
  })

  const setValue = (path: string, value: unknown) => {
    setWatchedData(
      (previous) => setByPath(previous as Record<string, unknown>, path, value) as TestData
    )
  }

  return (
    <>
      <ThemeToolbar
        setValue={setValue}
        watchedData={watchedData}
        selectedBoundsTarget="text"
        canSelectVerseBounds
        setSelectedBoundsTarget={() => {}}
        handlePreviewAnimation={() => {}}
        handlePreviewTransition={() => {}}
      />
      <pre data-testid="form-state">{JSON.stringify(watchedData)}</pre>
    </>
  )
}

describe('ThemeToolbar', () => {
  it('deberia alternar fontWeight bold al hacer click en el boton de negrita', () => {
    render(<TestHarness />)

    const boldButton = screen.getByTestId('bold-btn')

    fireEvent.click(boldButton)
    expect(screen.getByTestId('form-state').textContent).toContain('"fontWeight":"bold"')

    fireEvent.click(boldButton)
    expect(screen.getByTestId('form-state').textContent).not.toContain('"fontWeight":"bold"')
  })
})
