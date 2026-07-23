import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function getAuthenticatedClient() {
	const cookieStore = await cookies();
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{ cookies: { getAll: () => cookieStore.getAll() } },
	);
	const { data: { user } } = await supabase.auth.getUser();
	return { supabase, user };
}

function ownedPath(path: string, userId: string) {
	return path.startsWith(`${userId}/pictures/`) && !path.includes("..");
}

export async function POST(request: NextRequest) {
	const { supabase, user } = await getAuthenticatedClient();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const formData = await request.formData().catch(() => null);
	const file = formData?.get("file");
	if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_SIZE) {
		return NextResponse.json({ error: "Upload a PNG, JPEG, or WebP image under 5 MB." }, { status: 422 });
	}

	const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
	const path = `${user.id}/pictures/${crypto.randomUUID()}.${extension}`;
	const { error } = await supabase.storage.from("resume-toolkit").upload(path, file, {
		contentType: file.type,
		upsert: false,
	});
	if (error) return NextResponse.json({ error: "Picture upload failed." }, { status: 500 });

	return NextResponse.json({ url: `/api/resume/picture?path=${encodeURIComponent(path)}` }, { status: 201 });
}

export async function GET(request: NextRequest) {
	const { supabase, user } = await getAuthenticatedClient();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const path = request.nextUrl.searchParams.get("path");
	if (!path || !ownedPath(path, user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const { data, error } = await supabase.storage.from("resume-toolkit").download(path);
	if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
	return new NextResponse(data, { headers: { "Content-Type": data.type || "application/octet-stream", "Cache-Control": "private, max-age=3600" } });
}

export async function DELETE(request: NextRequest) {
	const { supabase, user } = await getAuthenticatedClient();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const body = await request.json().catch(() => null);
	const path = body?.path;
	if (typeof path !== "string" || !ownedPath(path, user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
	const { error } = await supabase.storage.from("resume-toolkit").remove([path]);
	if (error) return NextResponse.json({ error: "Picture deletion failed." }, { status: 500 });
	return NextResponse.json({ success: true });
}
