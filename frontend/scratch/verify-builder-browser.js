const puppeteer = require("puppeteer");

const EXPECTED_LEFT_SECTIONS = [
	"picture",
	"basics",
	"summary",
	"profiles",
	"experience",
	"education",
	"projects",
	"skills",
	"languages",
	"interests",
	"awards",
	"certifications",
	"publications",
	"volunteer",
	"references",
	"custom",
];

const EXPECTED_RIGHT_SECTIONS = ["template", "layout", "typography", "design", "page", "export"];

(async () => {
	const browser = await puppeteer.launch();
	try {
		const page = await browser.newPage();
		await page.setViewport({
			width: Number(process.env.WIDTH ?? 1920),
			height: Number(process.env.HEIGHT ?? 1080),
			deviceScaleFactor: 1,
		});

		const runtimeErrors = [];
		page.on("pageerror", (error) => runtimeErrors.push(error.stack ?? error.message));
		page.on("console", (message) => {
			if (message.type() === "error") runtimeErrors.push(message.text());
		});

		const response = await page.goto(
			process.env.CURRENT_URL ?? "http://localhost:3000/resume/builder/local-test",
			{ waitUntil: "networkidle2", timeout: 60_000 },
		);
		await new Promise((resolve) => setTimeout(resolve, 5_000));

		const audit = await page.evaluate(({ expectedLeftSections, expectedRightSections }) => {
			const sectionIds = (panel) =>
				Array.from(panel?.querySelectorAll('[id^="sidebar-"]') ?? []).map((element) =>
					element.id.replace("sidebar-", ""),
				);

			const left = document.querySelector("#left");
			const right = document.querySelector("#right");
			const icons = Array.from(document.querySelectorAll("svg"));
			const brokenIcons = icons.flatMap((icon, index) => {
				const rect = icon.getBoundingClientRect();
				const style = getComputedStyle(icon);
				const isBroken =
					style.display === "none" ||
					style.visibility !== "visible" ||
					Number(style.opacity) === 0 ||
					rect.width === 0 ||
					rect.height === 0 ||
					style.color === "rgba(0, 0, 0, 0)";

				return isBroken
					? [{
						index,
						className: icon.getAttribute("class"),
						color: style.color,
						display: style.display,
						height: rect.height,
						opacity: style.opacity,
						visibility: style.visibility,
						width: rect.width,
					}]
					: [];
			});

			const unitElements = Array.from(left?.querySelectorAll('[data-slot="input-group-addon"]') ?? [])
				.filter((element) => ["pt", "°"].includes(element.textContent?.trim() ?? ""));
			const detachedUnits = unitElements.flatMap((unit) => {
				const group = unit.closest('fieldset[data-slot="input-group"]');
				if (!group) return [{ text: unit.textContent?.trim(), reason: "missing input group" }];

				const unitRect = unit.getBoundingClientRect();
				const groupRect = group.getBoundingClientRect();
				const contained =
					unitRect.left >= groupRect.left &&
					unitRect.right <= groupRect.right &&
					unitRect.top >= groupRect.top &&
					unitRect.bottom <= groupRect.bottom;

				return contained ? [] : [{ text: unit.textContent?.trim(), reason: "outside input group" }];
			});

			const canvases = Array.from(document.querySelectorAll('[aria-label^="Resume page"] canvas'));
			const canvasPixelChecks = canvases.map((canvas) => {
				const context = canvas.getContext("2d", { willReadFrequently: true });
				if (!context || canvas.width === 0 || canvas.height === 0) {
					return { bitmapHeight: canvas.height, bitmapWidth: canvas.width, nonWhiteSamples: 0 };
				}

				let nonWhiteSamples = 0;
				const stepX = Math.max(1, Math.floor(canvas.width / 80));
				const stepY = Math.max(1, Math.floor(canvas.height / 80));
				for (let y = 0; y < canvas.height; y += stepY) {
					for (let x = 0; x < canvas.width; x += stepX) {
						const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
						if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) nonWhiteSamples += 1;
					}
				}

				return { bitmapHeight: canvas.height, bitmapWidth: canvas.width, nonWhiteSamples };
			});

			const leftSections = sectionIds(left);
			const rightSections = sectionIds(right);
			const rootStyle = getComputedStyle(document.documentElement);

			return {
				canvasPixelChecks,
				detachedUnits,
				fontFamily: getComputedStyle(document.body).fontFamily,
				iconCount: icons.length,
				brokenIcons,
				leftSections,
				leftSectionsMatch: JSON.stringify(leftSections) === JSON.stringify(expectedLeftSections),
				loaderMounted: Boolean(document.querySelector('[aria-label^="Loading resume page"]')),
				previewPageCount: document.querySelectorAll('[aria-label^="Resume page"]').length,
				rightSections,
				rightSectionsMatch: JSON.stringify(rightSections) === JSON.stringify(expectedRightSections),
				theme: {
					background: rootStyle.getPropertyValue("--color-background").trim(),
					foreground: rootStyle.getPropertyValue("--color-foreground").trim(),
					font: rootStyle.getPropertyValue("--font-sans").trim(),
				},
			};
		}, { expectedLeftSections: EXPECTED_LEFT_SECTIONS, expectedRightSections: EXPECTED_RIGHT_SECTIONS });

		const failures = [
			...(response?.status() === 200 ? [] : [`HTTP status ${response?.status()}`]),
			...runtimeErrors.map((error) => `Runtime error: ${error}`),
			...(audit.leftSectionsMatch ? [] : ["Left section list differs from Reactive Resume"]),
			...(audit.rightSectionsMatch ? [] : ["Right section list differs from Reactive Resume"]),
			...(audit.detachedUnits.length === 0 ? [] : ["One or more unit labels are detached"]),
			...(audit.brokenIcons.length === 0 ? [] : ["One or more SVG icons are not visibly rendered"]),
			...(audit.loaderMounted ? ["ResumePreviewLoader is still mounted"] : []),
			...(audit.previewPageCount === 4 ? [] : [`Expected 4 PDF pages, found ${audit.previewPageCount}`]),
			...(audit.canvasPixelChecks.every((result) => result.nonWhiteSamples > 0)
				? []
				: ["One or more PDF canvases contain no visible content"]),
		];

		console.log(JSON.stringify({ status: failures.length === 0 ? "PASS" : "FAIL", failures, audit }, null, 2));
		if (failures.length > 0) process.exitCode = 1;
	} finally {
		await browser.close();
	}
})();
