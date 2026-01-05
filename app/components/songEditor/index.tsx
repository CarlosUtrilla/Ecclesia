import { Input } from '@/ui/input'
import RichTextEditor from '@/ui/richTextEditor'
import t from '@locales'
import { Song } from '@prisma/client'
import { useFormik } from 'formik'
export default function SongEditor() {
  const { values, handleChange } = useFormik<Song>({
    initialValues: {
      title: '',
      author: '',
      copyright: '',
      fullText: '',
      id: -1,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    onSubmit: (values) => {
      console.log(values)
    }
  })
  return (
    <div className="grid grid-cols-12">
      <div className="p-3 space-y-2 col-span-3 bg-sidebar border-b-sidebar-border">
        <Input
          placeholder={t('songEditor.title')}
          value={values.title}
          onChange={handleChange}
          name="title"
        />
        <Input
          placeholder={t('songEditor.author')}
          value={values.author || ''}
          onChange={handleChange}
          name="author"
        />
        <Input
          placeholder={t('songEditor.copyright')}
          value={values.copyright || ''}
          onChange={handleChange}
          name="copyright"
        />
        <RichTextEditor
          className="h-full"
          text={values.fullText || ''}
          onTextChange={(newText) => handleChange({ target: { name: 'fullText', value: newText } })}
        />
      </div>
    </div>
  )
}
