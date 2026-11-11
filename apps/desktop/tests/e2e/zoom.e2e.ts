import { test, expect } from './fixtures'

test('la ventana principal se mantiene al 100 % de zoom', async ({ mainWindow }) => {
  const ratio = () => mainWindow.evaluate(() => window.outerWidth / window.innerWidth)
  expect(await ratio()).toBeCloseTo(1, 1)

  await mainWindow.keyboard.press('ControlOrMeta+Equal')
  await mainWindow.keyboard.press('ControlOrMeta+Equal')
  expect(await ratio()).toBeCloseTo(1, 1)
})
