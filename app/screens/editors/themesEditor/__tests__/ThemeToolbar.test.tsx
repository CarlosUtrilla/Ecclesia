// @vitest-environment jsdom
import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
// jest-dom matchers are setup globally in tests/setup/vitest.setup.ts
import ThemesEditor from '../index'
import React from 'react'
import * as ReactDOMClient from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import ThemesEditor from '../index'
import { vi } from 'vitest'

// Mock FontFamilySelector to avoid FontsProvider
vi.mock('@/ui/fontFamilySelector', () => {
  return {
    __esModule: true,
    default: ({ value, onChange }: any) =>
      React.createElement(
        'select',
        {
          'data-testid': 'font-family',
          value: value,
          onChange: (e: any) => onChange(e.target.value)
        },
        React.createElement('option', { value: 'Arial' }, 'Arial')
      )
  }
})

import ThemeToolbar from '../ThemeToolbar'
import { useForm } from 'react-hook-form'

describe('ThemeToolbar unit', () => {
  it('toggles bold in textStyle when Bold button is clicked', async () => {
    // Test harness that exposes form state
    function TestHarness() {
      const { control, setValue, watch } = useForm({
        defaultValues: {
          textStyle: {
            color: '#000000',
            fontSize: 24
          }
        }
      })

      const watched = watch()

      return (
        <div>
          <ThemeToolbar
            control={control}
            setValue={setValue}
            watchedData={watched}
            translateValues={{ x: 0, y: 0 }}
            handleTextBoundsChange={() => {}}
            handleBibleVersePositionChange={() => {}}
            selectedBoundsTarget={'text'}
            setSelectedBoundsTarget={() => {}}
            animationSettings={{}}
            transitionSettings={{}}
            handleAnimationChange={() => {}}
            handleTransitionChange={() => {}}
            handlePreviewAnimation={() => {}}
            handlePreviewTransition={() => {}}
          />
          <pre data-testid="form-state">{JSON.stringify(watched)}</pre>
        </div>
      )
    }

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = ReactDOMClient.createRoot(container)

    await act(async () => {
      root.render(React.createElement(TestHarness))
    })

    const boldBtn = container.querySelector('[data-testid="bold-btn"]') as HTMLButtonElement | null
    if (!boldBtn) throw new Error('bold button not found')

    const formState = () => container.querySelector('[data-testid="form-state"]')?.textContent || ''

    // Click to enable bold
    await act(async () => {
      boldBtn.click()
    })

    expect(formState()).toContain('"fontWeight":"bold"')

    // Click again to disable
    await act(async () => {
      boldBtn.click()
    })

    expect(formState()).not.toContain('"fontWeight":"bold"')
  })
})
