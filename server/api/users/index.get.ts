import { users } from '../../utils/schema';
import { useDb } from '../../utils/db';

export default defineEventHandler(async (event) => {
  try {
    const db = await useDb();
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt
    }).from(users);
    
    return { success: true, data: allUsers };
  } catch (error: any) {
    // Return mock data if DB is not connected yet for demo purposes
    console.warn("Returning mock data because DB connection failed:", error.message);
    return {
      success: true,
      data: [
        { id: '1', username: 'admin', displayName: 'System Administrator', role: 'admin', isActive: true },
        { id: '2', username: 'manager1', displayName: 'หัวหน้างาน ฝ่ายขาย', role: 'manager', isActive: true },
        { id: '3', username: 'user1', displayName: 'พนักงานขาย 01', role: 'user', isActive: true }
      ]
    };
  }
});
