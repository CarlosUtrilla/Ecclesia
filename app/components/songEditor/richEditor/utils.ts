import { Editor, generateHTML } from '@tiptap/react'

import { generateJSON } from '@tiptap/react'

export function blocksToContent(blocks: BlockEditor[], extensions: any[]) {
  const result: any[] = []
  let currentGroup: { tagId: number | null; paragraphs: any[] } = { tagId: null, paragraphs: [] }

  blocks.forEach((block) => {
    const paragraphContent = block.content
      ? (generateJSON(block.content, extensions).content ?? [])
      : [{ type: 'paragraph' }]

    const tagId = block.tagSongsId

    // Si cambia el tag, cerrar el grupo actual
    if (currentGroup.paragraphs.length > 0 && currentGroup.tagId !== tagId) {
      // Agregar el grupo anterior
      if (currentGroup.tagId !== null) {
        result.push({
          type: 'songGroup',
          attrs: { tagId: currentGroup.tagId },
          content: currentGroup.paragraphs
        })
      } else {
        // Párrafos sin tag, agregarlos directamente
        result.push(...currentGroup.paragraphs)
      }
      currentGroup = { tagId, paragraphs: [] }
    } else if (currentGroup.paragraphs.length === 0) {
      currentGroup.tagId = tagId
    }

    // Agregar los párrafos del block actual (normalmente será 1, pero puede ser más)
    currentGroup.paragraphs.push(...paragraphContent)
  })

  // Agregar el último grupo
  if (currentGroup.paragraphs.length > 0) {
    if (currentGroup.tagId !== null) {
      result.push({
        type: 'songGroup',
        attrs: { tagId: currentGroup.tagId },
        content: currentGroup.paragraphs
      })
    } else {
      result.push(...currentGroup.paragraphs)
    }
  }

  return result
}

export function contentToBlocks(editor: Editor): BlockEditor[] {
  const json = editor.getJSON()

  if (!json.content) return []

  const contents = json.content.flatMap((node: any) => {
    // Caso 1: grupo con tag - descomponer en párrafos individuales
    if (node.type === 'songGroup') {
      const tagId = node.attrs?.tagId ?? null
      const paragraphs = node.content ?? []

      return paragraphs.map((paragraph: any) => ({
        tagSongsId: tagId,
        content: generateHTML(
          {
            type: 'doc',
            content: [paragraph]
          },
          editor.extensionManager.extensions
        )
      }))
    }

    // Caso 2: párrafo libre (sin tag)
    if (node.type === 'paragraph') {
      return {
        tagSongsId: null,
        content: generateHTML(
          {
            type: 'doc',
            content: [node]
          },
          editor.extensionManager.extensions
        )
      }
    }

    // Ignorar otros nodos
    return []
  })

  const blocks = contents.reduce((prev: BlockEditor[], curr: BlockEditor) => {
    if (curr.content.trim() === '<p></p>') {
      prev.push({
        content: '',
        tagSongsId: curr.tagSongsId
      })
    } else {
      if (prev.length === 0 || prev[prev.length - 1].tagSongsId !== curr.tagSongsId) {
        prev.push({
          content: '',
          tagSongsId: curr.tagSongsId
        })
      }
      const last = prev[prev.length - 1]
      last.content += curr.content
      prev[prev.length - 1] = last
    }

    return prev
  }, [] as BlockEditor[])

  return blocks
}

export type BlockEditor = {
  content: string
  tagSongsId: number | null
}

export const fontSizes = [
  { label: '80%', value: '0.8em' },
  { label: '90%', value: '0.9em' },
  { label: '100%', value: '1em' },
  { label: '110%', value: '1.1em' },
  { label: '120%', value: '1.2em' },
  { label: '140%', value: '1.4em' },
  { label: '160%', value: '1.6em' },
  { label: '180%', value: '1.8em' },
  { label: '200%', value: '2em' }
]
