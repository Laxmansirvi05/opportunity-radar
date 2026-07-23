import { t } from "@lingui/core/macro";
import { GithubLogoIcon, StarIcon } from "@phosphor-icons/react";
import { Button } from "@reactive-resume/ui/components/button";
import { CountUp } from "../animation/count-up";

export function GithubStarsButton() {
	const starCount: number | null = null;

	const ariaLabel =
		starCount != null
			? t`Star us on GitHub, currently ${starCount.toLocaleString()} stars (opens in new tab)`
			: t`Star us on GitHub (opens in new tab)`;

	return (
		<Button
			variant="outline"
			nativeButton={false}
			render={
				<a target="_blank" href="https://github.com/amruthpillai/reactive-resume" aria-label={ariaLabel} rel="noopener">
					<GithubLogoIcon aria-hidden="true" />
					{starCount != null ? (
						<CountUp to={starCount} duration={0.5} separator="," className="font-bold" aria-hidden="true" />
					) : null}
					<StarIcon aria-hidden="true" />
				</a>
			}
		/>
	);
}
