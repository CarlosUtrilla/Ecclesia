import { Bug } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'

export default function DevSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="size-4" /> Dev
        </CardTitle>
        <CardDescription>
          Utilidades de desarrollo y diagnóstico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Las herramientas de diagnóstico y reparación de sincronización han sido eliminadas.
          El nuevo sistema OpLog maneja la sincronización automáticamente.
        </p>
      </CardContent>
    </Card>
  )
}
