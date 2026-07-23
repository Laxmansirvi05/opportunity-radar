const puppeteer = require("puppeteer");

(async () => {
	const browser = await puppeteer.launch();
	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1440, height: 900 });
		page.on("pageerror", (error) => console.error("PAGE ERROR", error));
		await page.goto(process.env.CURRENT_URL ?? "http://localhost:3000/resume/builder/local-test", {
			waitUntil: "networkidle2",
		});
		await new Promise((resolve) => setTimeout(resolve, 3_000));
		console.log(JSON.stringify(await page.evaluate(() => {
			const describe = (element) => {
				if (!element) return null;
				const rect = element.getBoundingClientRect();
				const style = getComputedStyle(element);
				return {
					tag: element.tagName,
					text: element.textContent?.trim().slice(0, 80),
					className: typeof element.className === "string" ? element.className : element.getAttribute("class"),
					rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
					backgroundColor: style.backgroundColor,
					borderColor: style.borderColor,
					borderStyle: style.borderStyle,
					borderWidth: style.borderWidth,
					color: style.color,
					display: style.display,
					fontFamily: style.fontFamily,
					fontSize: style.fontSize,
					gap: style.gap,
					gridTemplateColumns: style.gridTemplateColumns,
					opacity: style.opacity,
					padding: style.padding,
					position: style.position,
					visibility: style.visibility,
				};
			};

			const left = document.querySelector("#left");
			const picture = document.querySelector("#sidebar-picture");
			const firstLabel = picture?.querySelector("label");
			const firstInput = picture?.querySelector("input");
			const pt = Array.from(picture?.querySelectorAll("*") ?? []).find((element) => element.textContent === "pt");
			const edgeIcon = left?.querySelector('[data-slot="sidebar-edge"] svg');
			const formIcon = picture?.querySelector("svg");
			const rootStyle = getComputedStyle(document.documentElement);

			return {
				htmlClass: document.documentElement.className,
				cssVariables: Object.fromEntries([
					"--background", "--foreground", "--primary", "--color-background", "--color-foreground",
					"--color-primary", "--color-muted-foreground", "--font-sans", "--font-body",
				].map((name) => [name, rootStyle.getPropertyValue(name).trim()])),
				body: describe(document.body),
				left: describe(left),
				leftScrollArea: describe(left?.querySelector('[data-slot="scroll-area"]')),
				picture: describe(picture),
				pictureChildren: Array.from(picture?.children ?? []).map(describe),
				firstLabel: describe(firstLabel),
				firstInput: describe(firstInput),
				inputParent: describe(firstInput?.parentElement),
				inputGrandparent: describe(firstInput?.parentElement?.parentElement),
				unit: describe(pt),
				edgeIcon: describe(edgeIcon),
				formIcon: describe(formIcon),
			};
		}), null, 2));
	} finally {
		await browser.close();
	}
})();
