import { queryOptions } from '@tanstack/react-query'
import Api from '@api'
export const GetProductsResumeQuery = queryOptions({
  queryKey: ['productsResume'],
  queryFn: async () => {
    return await Api.products.getProductResume()
  }
})
