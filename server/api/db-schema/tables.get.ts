import { getAuthSession } from '../../utils/auth'
import { listTables } from '../../utils/schemaTools'

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const tables = await listTables()
  return { tables }
})
