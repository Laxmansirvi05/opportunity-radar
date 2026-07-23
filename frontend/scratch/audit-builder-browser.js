const puppeteer = require("puppeteer");

const targets = [
	{ name: "current", url: process.env.CURRENT_URL ?? "http://localhost:3000/resume/builder/local-test" },
	{ name: "original", url: process.env.ORIGINAL_URL ?? "http://localhost:3001/builder/mock-test" },
];

const inspect = () => {
	const readElement = (element) => {
		if (!element) return null;
		const rect = element.getBoundingClientRect();
		const style = getComputedStyle(element);
		return {
			classes: typeof element.className === "string" ? element.className : element.getAttribute("class"),
			display: style.display,
			height: rect.height,
			opacity: style.opacity,
			overflow: style.overflow,
			position: style.position,
			visibility: style.visibility,
			width: rect.width,
			x: rect.x,
			y: rect.y,
		};
	};

	const readIcons = (root) =>
		Array.from(root?.querySelectorAll("svg") ?? []).map((icon, index) => {
			const style = getComputedStyle(icon);
			const rect = icon.getBoundingClientRect();
			return {
				index,
				ariaLabel: icon.getAttribute("aria-label"),
				color: style.color,
				display: style.display,
				fill: style.fill,
				fontFamily: style.fontFamily,
				height: rect.height,
				opacity: style.opacity,
				stroke: style.stroke,
				visibility: style.visibility,
				width: rect.width,
			};
		});

	const left = document.querySelector("#left");
	const artboard = document.querySelector("#artboard");
	const right = document.querySelector("#right");
	const canvas = document.querySelector("canvas");
	const loader = document.querySelector('[aria-label^="Loading resume page"]');
	const resumePage = document.querySelector('[aria-label^="Resume page"]');

	return {
		viewport: { width: innerWidth, height: innerHeight },
		body: readElement(document.body),
		left: readElement(left),
		leftScrollArea: readElement(left?.querySelector('[data-slot="scroll-area"]')),
		leftText: left?.innerText,
		leftSections: Array.from(left?.querySelectorAll('[id^="sidebar-"]') ?? []).map((section) => ({
			id: section.id,
			text: section.textContent?.trim().slice(0, 120),
			...readElement(section),
		})),
		leftIcons: readIcons(left),
		artboard: readElement(artboard),
		right: readElement(right),
		rightScrollArea: readElement(right?.querySelector('[data-slot="scroll-area"]')),
		rightText: right?.innerText,
		rightSections: Array.from(right?.querySelectorAll('[id^="sidebar-"]') ?? []).map((section) => ({
			id: section.id,
			text: section.textContent?.trim().slice(0, 120),
			...readElement(section),
		})),
		rightIcons: readIcons(right),
		preview: {
			canvas: canvas
				? { ...readElement(canvas), bitmapWidth: canvas.width, bitmapHeight: canvas.height }
				: null,
			loader: readElement(loader),
			page: readElement(resumePage),
		},
	};
};

(async () => {
	const browser = await puppeteer.launch();
	try {
		for (const target of targets) {
			const page = await browser.newPage();
			await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
			const messages = [];
			page.on("console", (message) => messages.push(`${message.type()}: ${message.text()}`));
			page.on("pageerror", (error) => messages.push(`pageerror: ${error.stack ?? error.message}`));
			const response = await page.goto(target.url, { waitUntil: "networkidle2", timeout: 60_000 });
			await new Promise((resolve) => setTimeout(resolve, 5_000));
			await page.screenshot({ path: `browser-${target.name}.png`, fullPage: true });
			console.log(JSON.stringify({
				name: target.name,
				url: page.url(),
				status: response?.status(),
				messages,
				audit: await page.evaluate(inspect),
			}, null, 2));
			await page.close();
		}
	} finally {
		await browser.close();
	}
})();
