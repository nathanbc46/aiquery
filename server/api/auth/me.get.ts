export default defineEventHandler(async (event) => {
  const session = await useSession(event, {
    password: getSessionPassword(),
  });
  
  if (!session.data.userId) {
    return {
      authenticated: false
    };
  }
  
  return {
    authenticated: true,
    user: session.data
  };
});
