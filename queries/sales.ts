import { PeriodOptionsEnum } from '@/modules/salesDashboard/const'
import api from '@api'
import { queryOptions } from '@tanstack/react-query'
import { CustomPeriod } from 'database/controllers/sales/sales.dto'

export const getAllSales = (period: PeriodOptionsEnum, customPeriod?: CustomPeriod) =>
  queryOptions({
    queryKey: ['all-sales', period, customPeriod],
    queryFn: async () => api.sales.getAllSales(period, customPeriod)
  })
