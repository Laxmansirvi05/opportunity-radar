import { t } from "@lingui/core/macro";
import { GithubLogoIcon, StarIcon } from "@phosphor-icons/react";
import { Button } from "@reactive-resume/ui/components/button";

/**
 * The live star count was removed with the API call that fetched it, leaving
 * `starCount` hard-coded to null — so both the count badge and the
 * "currently N stars" label were unreachable, and TypeScript flagged the
 * narrowed `never`. Rendering the plain link is what this already did.
 */
export function GithubStarsButton() {
	const ariaLabel = t`Star us on GitHub (opens in new tab)`;

	return (
		<Button
			variant="outline"
			nativeButton={false}
			render={
				<a target="_blank" href="https://github.com/amruthpillai/reactive-resume" aria-label={ariaLabel} rel="noopener">
					<GithubLogoIcon aria-hidden="true" />
					<StarIcon aria-hidden="true" />
				</a>
			}
		/>
	);
}
