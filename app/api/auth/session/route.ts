import { errorResponse, getCurrentIdentity, requireProfile } from "@/lib/server/authz";

export async function GET(request: Request) {
  try {
    const [identity, profile] = await Promise.all([getCurrentIdentity(request), requireProfile(request)]);
    return Response.json({ authenticated: true, identity: { email: identity.email }, profile });
  } catch (error) {
    return errorResponse(error);
  }
}
