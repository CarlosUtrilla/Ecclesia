import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SplashScreenProps {
  isReady: boolean
  children: React.ReactNode
}

export function SplashScreen({ isReady, children }: SplashScreenProps) {
  const [showSplash, setShowSplash] = useState(true)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Simular progreso de carga
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev
        return prev + 10
      })
    }, 100)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isReady) {
      setProgress(100)
      // Esperar un poco antes de ocultar el splash
      setTimeout(() => {
        setShowSplash(false)
      }, 300)
    }
  }, [isReady])

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
          >
            <div className="flex flex-col items-center gap-8">
              {/* Logo o nombre de la app */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="text-4xl font-bold"
              >
                Ecclesia
              </motion.div>

              {/* Texto de carga */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-sm text-muted-foreground"
              >
                Cargando Ecclesia...
              </motion.div>

              {/* Barra de progreso */}
              <div className="w-64 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showSplash && children}
    </>
  )
}
