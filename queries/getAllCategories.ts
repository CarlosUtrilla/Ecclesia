import { queryOptions } from '@tanstack/react-query'
import Api from '@api'
export const GetAllCategoriesQuery = queryOptions({
  queryKey: ['categoryList'],
  queryFn: async () => {
    return await Api.category.getAllCategories()
  }
})
