import { getContrastTextColor } from '@/lib/utils'
import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    songGroup: {
      setSongGroup: (tagId: number) => ReturnType
      unsetSongGroup: () => ReturnType
    }
  }
}

export const SongTagsStorage = Extension.create({
  name: 'songTagsStorage',

  addStorage() {
    return {
      songTags: []
    }
  }
})
const SongGroupView = (props: any) => {
  const { node, editor } = props

  const tagId = node.attrs.tagId

  // 🔥 obtener tags desde editor.storage
  const tags = editor.storage.songTags ?? []

  const tag = tags.find((t: any) => String(t.id) === String(tagId))
  const backgroundColor = tag ? `${tag.color}B5` : undefined
  const color = backgroundColor ? getContrastTextColor(tag.color) : undefined
  return (
    <NodeViewWrapper className="my-1 rounded-md px-2 py-1" style={{ backgroundColor, color }}>
      {tag && backgroundColor ? (
        <div className="font-bold text-xs pt-1 pb-1.5 italic">{tag.name}</div>
      ) : null}
      <NodeViewContent className="pl-3 pr-1" />
    </NodeViewWrapper>
  )
}
export const SongGroup = Node.create({
  name: 'songGroup',
  group: 'block',
  content: 'block+',
  isolating: true,

  addAttributes() {
    return {
      tagId: {
        default: null
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-tag-song]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-tag-song': HTMLAttributes.tagId
      }),
      0
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SongGroupView)
  },
  addCommands() {
    return {
      setSongGroup:
        (tagId) =>
        ({ state, commands, editor }) => {
          const { from, to } = state.selection

          // Analizar qué hay en la selección
          let groupCount = 0
          let paragraphsInGroups = 0
          let paragraphsOutsideGroups = 0
          let allGroupsHaveSameTag = true

          state.doc.nodesBetween(from, to, (node, _pos, parent) => {
            if (node.type.name === 'songGroup') {
              groupCount++
              if (node.attrs.tagId !== tagId) {
                allGroupsHaveSameTag = false
              }
            } else if (node.type.name === 'paragraph') {
              if (parent?.type.name === 'songGroup') {
                paragraphsInGroups++
              } else {
                paragraphsOutsideGroups++
              }
            }
          })

          // Toggle: si TODOS los párrafos están en grupos con el mismo tag, remover
          if (groupCount > 0 && paragraphsOutsideGroups === 0 && allGroupsHaveSameTag) {
            return commands.lift('songGroup')
          }

          // Si hay grupos con diferente tag o mezcla, reconstruir manualmente
          if (groupCount > 0) {
            const { tr, doc, schema } = state

            // Expandir rango para incluir grupos completos
            let expandedFrom = from
            let expandedTo = to

            // Encontrar todos los grupos que intersectan con la selección
            doc.nodesBetween(0, doc.content.size, (node, pos) => {
              if (node.type.name === 'songGroup') {
                const groupEnd = pos + node.nodeSize
                if (pos < to && groupEnd > from) {
                  if (pos < expandedFrom) expandedFrom = pos
                  if (groupEnd > expandedTo) expandedTo = groupEnd
                }
              }
            })

            // Extraer TODOS los párrafos en el rango expandido con su tag original
            const allParagraphs: Array<{
              node: any
              originalTagId: number | null
              inSelection: boolean
            }> = []

            doc.nodesBetween(expandedFrom, expandedTo, (node, pos, parent) => {
              if (node.type.name === 'paragraph') {
                const originalTagId = parent?.type.name === 'songGroup' ? parent.attrs.tagId : null
                const paragraphEnd = pos + node.nodeSize
                const inSelection = (pos >= from && pos < to) || (pos < from && paragraphEnd > from)

                allParagraphs.push({ node, originalTagId, inSelection })
              }
            })

            // Reconstruir: agrupar párrafos consecutivos con el mismo tagId
            const newNodes: any[] = []
            let currentGroup: { tagId: number | null; paragraphs: any[] } = {
              tagId: null,
              paragraphs: []
            }

            allParagraphs.forEach((p) => {
              const resultTagId = p.inSelection ? tagId : p.originalTagId

              // Si cambia el tag, cerrar grupo actual
              if (currentGroup.paragraphs.length > 0 && currentGroup.tagId !== resultTagId) {
                if (currentGroup.tagId !== null) {
                  newNodes.push(
                    schema.nodes.songGroup.create(
                      { tagId: currentGroup.tagId },
                      currentGroup.paragraphs
                    )
                  )
                } else {
                  newNodes.push(...currentGroup.paragraphs)
                }
                currentGroup = { tagId: resultTagId, paragraphs: [] }
              } else if (currentGroup.paragraphs.length === 0) {
                currentGroup.tagId = resultTagId
              }

              currentGroup.paragraphs.push(p.node)
            })

            // Agregar el último grupo
            if (currentGroup.paragraphs.length > 0) {
              if (currentGroup.tagId !== null) {
                newNodes.push(
                  schema.nodes.songGroup.create(
                    { tagId: currentGroup.tagId },
                    currentGroup.paragraphs
                  )
                )
              } else {
                newNodes.push(...currentGroup.paragraphs)
              }
            }

            // Reemplazar todo el rango expandido con los nodos reconstruidos
            tr.replaceWith(expandedFrom, expandedTo, newNodes)
            editor.view.dispatch(tr)

            return true
          }

          // Sin grupos existentes, aplicar directamente
          return commands.wrapIn('songGroup', { tagId })
        },
      unsetSongGroup:
        () =>
        ({ commands }) => {
          return commands.lift('songGroup')
        }
    }
  }
})
