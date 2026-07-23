import type React from "react";

type BuilderSession = { user: { name: string; image?: string | null } };
type UserDropdownMenuProps = {
	children?: React.ReactNode | ((props: { session: BuilderSession }) => React.ReactNode);
};

// The full-screen builder only needs the trigger supplied by its caller.  The
// authenticated page layout already protects this surface; rendering the
// trigger here avoids the previous placeholder replacing it entirely.
export function UserDropdownMenu({ children }: UserDropdownMenuProps) {
	const session: BuilderSession = { user: { name: "User" } };
	return <>{typeof children === "function" ? children({ session }) : children}</>;
}
