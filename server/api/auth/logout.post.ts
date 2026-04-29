export default defineEventHandler(async (event) => {
  const session = await useSession(event, {
    password: process.env.SESSION_PASSWORD || 'a_very_long_and_secure_password_for_session_encryption',
  });
  
  await session.clear();
  
  return {
    status: 'success',
    message: 'Logged out successfully'
  };
});
