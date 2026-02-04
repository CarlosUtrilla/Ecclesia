import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'

import { Button } from '../../../../ui/button'
import { Bold, Italic, Underline as UnderlineIcon, Type, Tags } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../../../../ui/dropdown-menu'
import { Separator } from '../../../../ui/separator'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

import { FontSize, SongGroup } from './SongGroup'
import { BlockEditor, blocksToContent, contentToBlocks, fontSizes } from './utils'
import useTagSongs from '@/hooks/useTagSongs'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

type Props = {
  lyrics: BlockEditor[]
  onChange: (newLyrics: BlockEditor[]) => void
  className?: string
  error?: string
}

export default function RichTextEditor({ lyrics, onChange, className, error }: Props) {
  const { tagSongs } = useTagSongs()

  const extensions = [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      strike: false
    }),
    Underline,
    TextStyle,
    FontSize,
    SongGroup
  ]
  const content = {
    type: 'doc',
    content: blocksToContent(lyrics, extensions)
  }
  const editor = useEditor({
    extensions,
    content,
    onUpdate: ({ editor }) => {
      onChange(contentToBlocks(editor))
    },
    editorProps: {
      attributes: {
        class: 'min-h-[300px] p-4 focus:outline-none prose prose-sm max-w-none'
      }
    }
  })

  useEffect(() => {
    if (!editor || !tagSongs.length) {
      return
    }
    ;(editor.storage as any).songTags = tagSongs

    // fuerza re-render de NodeViews
    editor.view.dispatch(editor.state.tr)
  }, [tagSongs, editor])

  if (!editor) {
    return null
  }

  return (
    <div className="flex-1 flex flex-col">
      <div
        className={cn('flex-1 border rounded-md overflow-hidden flex flex-col', className, {
          'border-red-500': error
        })}
      >
        {/* Barra de herramientas */}
        <div className="bg-muted/30 p-2 flex items-center gap-1 border-b overflow-x-auto scro">
          <Button
            type="button"
            size="icon"
            variant={editor.isActive('bold') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className="h-8 w-8"
          >
            <Bold className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="icon"
            variant={editor.isActive('italic') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className="h-8 w-8"
          >
            <Italic className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="icon"
            variant={editor.isActive('underline') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className="h-8 w-8 first:w-2"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="ghost" className="h-8 gap-2">
                <Type className="h-4 w-4" />
                <span className="text-xs">Tamaño</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {fontSizes.map((size) => (
                <DropdownMenuItem
                  key={size.value}
                  onClick={() => editor.chain().focus().setFontSize(size.value).run()}
                >
                  <span style={{ fontSize: size.value }}>{size.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="ghost" className="h-8 gap-2">
                <Tags className="h-4 w-4" />
                <span className="text-xs">Tags</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {tagSongs.map((tag) => (
                <DropdownMenuItem
                  key={tag.id}
                  onClick={() => editor.chain().focus().setSongGroup(tag.id).run()}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm border"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>{tag.name}</span>
                    <span
                      className="ml-auto text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: tag.color + '25',
                        color: tag.color
                      }}
                    >
                      {tag.shortName}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Editor */}
        <EditorContent className="flex-1 overflow-y-auto" editor={editor} />
      </div>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  )
}
