import { queryOptions } from '@tanstack/react-query'
import Api from '@api'
export const GetUserList = queryOptions({
  queryKey: ['users'],
  queryFn: async () => {
    return await Api.user.getAllUsers()
  }
})
