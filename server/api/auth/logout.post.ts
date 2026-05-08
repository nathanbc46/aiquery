export default defineEventHandler(async (event) => {
  const session = await useSession(event, {
    password: getSessionPassword(),
    cookie: {
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
    },
  });

  await session.clear();

  // ล้าง cookie โดยตรงให้แน่ใจว่า browser ลบออกจริง
  deleteCookie(event, 'h3');

  return {
    status: 'success',
    message: 'Logged out successfully',
  };
});
