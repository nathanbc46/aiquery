export default defineEventHandler(async (event) => {
  const session = await useSession(event, {
    password: getSessionPassword(),
  });

  await session.clear();
  
  return {
    status: 'success',
    message: 'Logged out successfully'
  };
});
