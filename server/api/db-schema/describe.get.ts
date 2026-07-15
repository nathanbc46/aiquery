import { getAuthSession } from '../../utils/auth'
import { describeTable } from '../../utils/schemaTools'

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  if (!session.userId) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const { table } = getQuery(event)
  if (!table || typeof table !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing table parameter' })
  }

  const columns = await describeTable(table)
  return { columns }
})
