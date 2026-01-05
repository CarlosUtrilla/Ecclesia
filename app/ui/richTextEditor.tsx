import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'
import { Button } from './button'
import { Bold, Italic, Underline as UnderlineIcon, Type } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './dropdown-menu'
import { Separator } from './separator'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

type Props = {
  text: string
  onTextChange: (newText: string) => void
  className?: string
}

const fontSizes = [
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

// Extensión personalizada para tamaño de fuente
const FontSize = Extension.create({
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

export default function RichTextEditor({ text, onTextChange, className }: Props) {
  const editor = useEditor({
    extensions: [
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
      FontSize
    ],
    content: text,
    onUpdate: ({ editor }) => {
      onTextChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'min-h-[300px] p-4 focus:outline-none prose prose-sm max-w-none'
      }
    }
  })

  // Actualizar contenido cuando cambie desde fuera
  useEffect(() => {
    if (editor && text !== editor.getHTML()) {
      editor.commands.setContent(text)
    }
  }, [text, editor])

  if (!editor) {
    return null
  }

  return (
    <div className={cn('border rounded-md overflow-hidden', className)}>
      {/* Barra de herramientas */}
      <div className="bg-muted/30 p-2 flex items-center gap-1 border-b">
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
          className="h-8 w-8"
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
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}
