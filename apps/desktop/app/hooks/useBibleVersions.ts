import { Api } from '@ecclesia/queries'
import { useQuery } from '@tanstack/react-query'

export default function useBibleVersions() {
  const query = useQuery(Api.query.bible.getAvailableBibles())
  return query
}
