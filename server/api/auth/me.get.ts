export default defineEventHandler(async (event) => {
  const session = await useSession(event, {
    password: process.env.SESSION_PASSWORD || 'a_very_long_and_secure_password_for_session_encryption',
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
