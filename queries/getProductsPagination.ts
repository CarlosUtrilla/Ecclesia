import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import Api from '@api'
import { GetProductsPaginationFilters } from 'database/controllers/products/products.dto'
export const GetProductsPaginationQuery = (page: number, filters?: GetProductsPaginationFilters) =>
  queryOptions({
    queryKey: ['productsPagination', page, filters],
    queryFn: async () => {
      const prods = await Api.products.getProductsPagination(page, filters)
      return prods
    }
  })

export const GetProductsPaginationInfiniteQuery = (filters?: GetProductsPaginationFilters) =>
  infiniteQueryOptions({
    queryKey: ['productsPagination', filters],
    queryFn: async ({ pageParam }) => {
      const prods = await Api.products.getProductsPagination(pageParam, filters)
      return prods
    },
    getNextPageParam: (lastGroup) => lastGroup.nextPage,
    initialPageParam: 1
  })
