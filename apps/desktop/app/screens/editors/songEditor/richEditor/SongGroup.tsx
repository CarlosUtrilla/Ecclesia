import { getContrastTextColor } from '@/lib/utils'
import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import { useEffect, useState } from 'react'

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

  // Estado local para forzar re-render
  const [tags, setTags] = useState(editor.storage.songTags ?? [])

  useEffect(() => {
    // Actualizar cuando cambie el storage
    const updateTags = () => {
      setTags(editor.storage.songTags ?? [])
    }

    // Escuchar transacciones del editor
    const { view } = editor
    const originalDispatch = view.dispatch.bind(view)

    view.dispatch = (tr: any) => {
      originalDispatch(tr)
      updateTags()
    }

    return () => {
      view.dispatch = originalDispatch
    }
  }, [editor])

  const tag = tags.find((t: any) => String(t.id) === String(tagId))
  const backgroundColor = tag ? `${tag.color}db` : undefined
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

          const mergeAdjacentGroups = () => {
            setTimeout(() => {
              const { state: newState } = editor.view
              const { tr: finalTr, doc: finalDoc, schema: finalSchema } = newState

              const allNodes: any[] = []
              finalDoc.content.forEach((node: any) => {
                allNodes.push(node)
              })

              const mergedNodes: any[] = []
              let i = 0

              while (i < allNodes.length) {
                const node = allNodes[i]

                if (node.type.name === 'songGroup') {
                  const currentTagId = node.attrs.tagId

                  let mergeEnd = i + 1
                  while (mergeEnd < allNodes.length) {
                    const next = allNodes[mergeEnd]
                    if (next.type.name === 'songGroup' && next.attrs.tagId === currentTagId) {
                      mergeEnd++
                    } else if (next.type.name === 'paragraph') {
                      let scan = mergeEnd + 1
                      let found = false
                      while (scan < allNodes.length) {
                        const candidate = allNodes[scan]
                        if (candidate.type.name === 'songGroup' && candidate.attrs.tagId === currentTagId) {
                          found = true
                          break
                        }
                        if (candidate.type.name !== 'paragraph') break
                        scan++
                      }
                      if (found) {
                        mergeEnd = scan + 1
                      } else {
                        break
                      }
                    } else {
                      break
                    }
                  }

                  const needsMerge = mergeEnd - i > 1

                  if (needsMerge) {
                    const groupParagraphs: any[] = []
                    for (let j = i; j < mergeEnd; j++) {
                      const current = allNodes[j]
                      if (current.type.name === 'songGroup') {
                        current.content.forEach((p: any) => groupParagraphs.push(p))
                      } else {
                        groupParagraphs.push(current)
                      }
                    }
                    mergedNodes.push(
                      finalSchema.nodes.songGroup.create({ tagId: currentTagId }, groupParagraphs)
                    )
                  } else {
                    mergedNodes.push(node)
                  }

                  i = mergeEnd
                } else {
                  mergedNodes.push(node)
                  i++
                }
              }

              if (mergedNodes.length > 0) {
                finalTr.replaceWith(0, finalDoc.content.size, mergedNodes)
                editor.view.dispatch(finalTr)
              }
            }, 0)
          }

          // Función auxiliar para reconstruir grupos
          const reconstructGroups = (newTagId: number | null) => {
            const { tr, doc, schema } = state

            // Expandir rango para incluir grupos completos
            let expandedFrom = from
            let expandedTo = to

            doc.nodesBetween(0, doc.content.size, (node, pos) => {
              if (node.type.name === 'songGroup') {
                const groupEnd = pos + node.nodeSize
                if (pos < to && groupEnd > from) {
                  if (pos < expandedFrom) expandedFrom = pos
                  if (groupEnd > expandedTo) expandedTo = groupEnd
                }
              }
            })

            // Extraer todos los párrafos en el rango expandido
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

            // Reconstruir: agrupar párrafos consecutivos
            const newNodes: any[] = []
            let currentGroup: { tagId: number | null; paragraphs: any[] } = {
              tagId: null,
              paragraphs: []
            }

            allParagraphs.forEach((p) => {
              const resultTagId = p.inSelection ? newTagId : p.originalTagId

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

            tr.replaceWith(expandedFrom, expandedTo, newNodes)
            editor.view.dispatch(tr)

            // Ejecutar fusión final
            mergeAdjacentGroups()
          }

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

          // Toggle: si TODOS los párrafos tienen el mismo tag, desagrupar
          if (groupCount > 0 && paragraphsOutsideGroups === 0 && allGroupsHaveSameTag) {
            reconstructGroups(null)
            return true
          }

          // Si hay grupos con diferente tag o mezcla, reconstruir con nuevo tag
          if (groupCount > 0) {
            reconstructGroups(tagId)
            return true
          }

          // Sin grupos existentes, aplicar directamente y luego fusionar
          const result = commands.wrapIn('songGroup', { tagId })
          if (result) {
            mergeAdjacentGroups()
          }
          return result
        },
      unsetSongGroup:
        () =>
        ({ commands }) => {
          return commands.lift('songGroup')
        }
    }
  }
})

// Extensión personalizada para tamaño de fuente
export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle']
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}`
              }
            }
          }
        }
      }
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          if (fontSize === '1em') {
            return chain().setMark('textStyle', { fontSize: null }).run()
          }
          return chain().setMark('textStyle', { fontSize }).run()
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).run()
        }
    }
  }
})
