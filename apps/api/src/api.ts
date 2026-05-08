import { routes } from './routes'
import { RoutesTypes } from './routeTypes'
import { Fetcher } from './utils/fetcher'

const api = exposeRoutes() as RoutesTypes
export default api
