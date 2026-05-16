import { Api } from '@ecclesia/queries'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

export default function useScheduleGroupTemplates() {
  const {
    data: scheduleGroupTemplates = [],
    refetch,
    ...query
  } = useQuery(Api.query.schedule.getAllGroupTemplates())

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on('schedule-group-templates-saved', () => {
      console.log('invalidando query')
      refetch()
    })
    return unsubscribe
  }, [])

  return { scheduleGroupTemplates, refetch, ...query }
}
