import { Api } from '@ecclesia/queries'
import { useQuery } from '@tanstack/react-query'

export default function useScheduleGroupTemplates() {
  const {
    data: scheduleGroupTemplates = [],
    refetch,
    ...query
  } = useQuery(Api.query.schedule.getAllGroupTemplates())

  return { scheduleGroupTemplates, refetch, ...query }
}
