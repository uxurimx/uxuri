import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { businesses, businessMembers, users } from "@/db/schema";
import { eq, or, inArray, count, desc } from "drizzle-orm";
import { BusinessesList } from "@/components/businesses/businesses-list";

export default async function NegociosPage() {
  const { userId } = await auth();
  if (!userId) return null;

  // Business IDs where this user is a member
  const memberOf = await db
    .select({ businessId: businessMembers.businessId })
    .from(businessMembers)
    .where(eq(businessMembers.userId, userId));
  const memberIds = memberOf.map((r) => r.businessId);

  const whereClause =
    memberIds.length > 0
      ? or(eq(businesses.ownerId, userId), inArray(businesses.id, memberIds))
      : eq(businesses.ownerId, userId);

  const bizList = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      type: businesses.type,
      description: businesses.description,
      logo: businesses.logo,
      color: businesses.color,
      status: businesses.status,
      website: businesses.website,
      linkedProjectId: businesses.linkedProjectId,
      ownerId: businesses.ownerId,
      createdAt: businesses.createdAt,
      updatedAt: businesses.updatedAt,
      memberCount: count(businessMembers.id),
    })
    .from(businesses)
    .leftJoin(businessMembers, eq(businessMembers.businessId, businesses.id))
    .where(whereClause!)
    .groupBy(businesses.id)
    .orderBy(desc(businesses.createdAt));

  // Fetch members for each business (for avatars in cards)
  const allMembers =
    bizList.length > 0
      ? await db
          .select({
            businessId: businessMembers.businessId,
            userId: businessMembers.userId,
            role: businessMembers.role,
            userName: users.name,
            userImage: users.imageUrl,
          })
          .from(businessMembers)
          .leftJoin(users, eq(businessMembers.userId, users.id))
          .where(inArray(businessMembers.businessId, bizList.map((b) => b.id)))
      : [];

  // Fetch all system users (for add-member selector)
  const allUsers = await db
    .select({ id: users.id, name: users.name, email: users.email, imageUrl: users.imageUrl })
    .from(users)
    .orderBy(users.name);

  const bizWithMembers = bizList.map((b) => ({
    ...b,
    members: allMembers.filter((m) => m.businessId === b.id),
  }));

  return (
    <div className="space-y-6">
      <BusinessesList
        initialBusinesses={bizWithMembers}
        currentUserId={userId}
        allUsers={allUsers}
      />
    </div>
  );
}
