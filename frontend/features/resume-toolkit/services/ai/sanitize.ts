import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { deepmergeCustom } from "deepmerge-ts";
import { jsonrepair } from "jsonrepair";
import { flattenError, ZodError } from "zod";
import { resumeDataSchema } from "@reactive-resume/schema/resume/data";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";
import { v4 as uuidv4 } from "uuid";
import { buildAiExtractionTemplate } from "./extraction-template";

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function generateId(): string {
	return uuidv4();
}
const aiExtractionTemplate = buildAiExtractionTemplate();

type SectionKey = keyof typeof sectionRequiredFieldMap;

type CoercionEntry = {
	path: string;
	fromType: string;
	toType: string;
};

type DroppedSectionItemEntry = {
	section: SectionKey;
	index: number;
	reason: string;
};

export type ResumeSanitizationDiagnostics = {
	coercions: CoercionEntry[];
	droppedSectionItems: DroppedSectionItemEntry[];
	salvageApplied: boolean;
};

export type ResumeSanitizationResult = {
	data: ResumeData;
	diagnostics: ResumeSanitizationDiagnostics;
};

const mergeDefaultsDeep = deepmergeCustom({
	filterValues: (values) => values.filter((value) => value !== undefined && value !== null),
	mergeArrays: false,
});

const sectionRequiredFieldMap = {
	profiles: "network",
	experience: "company",
	education: "school",
	projects: "name",
	skills: "name",
	languages: "language",
	interests: "name",
	awards: "title",
	certifications: "title",
	publications: "title",
	volunteer: "organization",
	references: "name",
} as const;

function getValueType(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function mergeDefaults<T extends Record<string, unknown>, S extends Record<string, unknown>>(
	target: T,
	source: S,
): T & S {
	if (!isObject(target) || !isObject(source)) {
		return (source !== undefined && source !== null ? source : target) as T & S;
	}

	return mergeDefaultsDeep(target, source) as T & S;
}

function coerceBoolean(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") {
		if (value === 1) return true;
		if (value === 0) return false;
		return;
	}
	if (typeof value !== "string") return;

	const normalized = value.trim().toLowerCase();
	if (normalized === "true" || normalized === "1") return true;
	if (normalized === "false" || normalized === "0") return false;
	return;
}

function coerceNumber(value: unknown): number | undefined {
	if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
	if (typeof value !== "string") return;

	const normalized = value.trim();
	if (normalized.length === 0) return;

	const coerced = Number(normalized);
	return Number.isFinite(coerced) ? coerced : undefined;
}

function coerceValueAgainstTemplate(
	value: unknown,
	template: unknown,
	path: string,
	diagnostics: ResumeSanitizationDiagnostics,
): unknown {
	if (typeof template === "string") {
		if (typeof value === "string") return value;
		if (isObject(value)) {
			diagnostics.coercions.push({ path, fromType: "object", toType: "string" });
			const strVal = (value.url || value.name || value.label || value.text || "") as string;
			return String(strVal);
		}
		if (typeof value === "number" || typeof value === "boolean") {
			diagnostics.coercions.push({ path, fromType: getValueType(value), toType: "string" });
			return String(value);
		}
		return value;
	}

	if (typeof template === "boolean") {
		const coerced = coerceBoolean(value);
		if (coerced === undefined) return value;
		if (coerced === value) return value;

		diagnostics.coercions.push({ path, fromType: getValueType(value), toType: "boolean" });
		return coerced;
	}

	if (typeof template === "number") {
		const coerced = coerceNumber(value);
		if (coerced === undefined) return value;
		if (coerced === value) return value;

		diagnostics.coercions.push({ path, fromType: getValueType(value), toType: "number" });
		return coerced;
	}

	if (Array.isArray(template) && Array.isArray(value)) {
		const itemTemplate = template[0];
		if (itemTemplate === undefined) return value;

		return value.map((entry, index) =>
			coerceValueAgainstTemplate(entry, itemTemplate, `${path}[${index}]`, diagnostics),
		);
	}

	if (!isObject(template) || !isObject(value)) return value;

	const output: Record<string, unknown> = { ...value };

	for (const key of Object.keys(template)) {
		if (!(key in output)) continue;

		const nextPath = path.length > 0 ? `${path}.${key}` : key;
		output[key] = coerceValueAgainstTemplate(output[key], template[key], nextPath, diagnostics);
	}

	return output;
}

function getJsonBoundaryIndices(value: string): { first: number; last: number } {
	const firstCurly = value.indexOf("{");
	const firstSquare = value.indexOf("[");
	const lastCurly = value.lastIndexOf("}");
	const lastSquare = value.lastIndexOf("]");

	let first = -1;
	if (firstCurly !== -1 && firstSquare !== -1) {
		first = Math.min(firstCurly, firstSquare);
	} else {
		first = Math.max(firstCurly, firstSquare);
	}

	return { first, last: Math.max(lastCurly, lastSquare) };
}

function mapAiParserVariations(data: Record<string, unknown>): Record<string, unknown> {
	if (!isObject(data)) return data;

	const output = { ...data };
	if (!isObject(output.sections)) {
		output.sections = {};
	}
	const sections = { ...(output.sections as Record<string, unknown>) };

	const mapping: Record<string, SectionKey | "summary"> = {
		work: "experience",
		workExperience: "experience",
		experience: "experience",
		employment: "experience",
		education: "education",
		skill: "skills",
		skills: "skills",
		project: "projects",
		projectList: "projects",
		projects: "projects",
		certifications: "certifications",
		certificate: "certifications",
		certificates: "certifications",
		award: "awards",
		awards: "awards",
		achievement: "awards",
		achievements: "awards",
		publications: "publications",
		publication: "publications",
		volunteer: "volunteer",
		volunteering: "volunteer",
		language: "languages",
		languages: "languages",
		interest: "interests",
		interests: "interests",
		reference: "references",
		references: "references",
		profiles: "profiles",
		socials: "profiles",
		social: "profiles",
		summary: "summary",
	};

	const normalizeItemsArray = (items: unknown[], mappedKey: string) => {
		return items.map((item) => {
			if (typeof item === "string") {
				// String fallbacks must use the EXACT field names from the Reactive Resume schema
				if (mappedKey === "skills") return { name: item };
				if (mappedKey === "experience") return { company: item, position: "", period: "" };
				if (mappedKey === "education") return { school: item, degree: "", period: "" };
				if (mappedKey === "projects") return { name: item, description: "" };
				if (mappedKey === "certifications") return { title: item, issuer: "" };
				if (mappedKey === "awards") return { title: item };
				if (mappedKey === "languages") return { language: item };
				if (mappedKey === "volunteer") return { organization: item };
				if (mappedKey === "references") return { name: item };
				if (mappedKey === "publications") return { title: item };
				if (mappedKey === "profiles") return { network: item, username: "" };
				return { name: item };
			}
			if (isObject(item)) {
				// ── Experience: map JSONResume → Reactive Resume field names ──
				if (mappedKey === "experience") {
					if (item.name && !item.company) item.company = item.name;
					if (item.companyName && !item.company) item.company = item.companyName;
					if (item.title && !item.position) item.position = item.title;
					if (item.role && !item.position) item.position = item.role;
					// date/dates/startDate+endDate → period
					if (!item.period) {
						if (item.date) item.period = item.date;
						else if (item.dates) item.period = item.dates;
						else if (item.startDate) item.period = item.endDate ? `${item.startDate} - ${item.endDate}` : String(item.startDate);
					}
				}
				// ── Education: map JSONResume → Reactive Resume field names ──
				if (mappedKey === "education") {
					if (item.institution && !item.school) item.school = item.institution;
					if (item.university && !item.school) item.school = item.university;
					if (item.studyType && !item.degree) item.degree = item.studyType;
					// Map gpa/score → grade
					if (!item.grade) {
						if (item.gpa) item.grade = String(item.gpa);
						else if (item.cgpa) item.grade = String(item.cgpa);
						else if (item.sgpa) item.grade = String(item.sgpa);
						else if (item.score) item.grade = String(item.score);
						else if (item.percentage) item.grade = `${item.percentage}%`;
					}
					// date/dates/startDate+endDate → period
					if (!item.period) {
						if (item.date) item.period = item.date;
						else if (item.dates) item.period = item.dates;
						else if (item.startDate) item.period = item.endDate ? `${item.startDate} - ${item.endDate}` : String(item.startDate);
					}
				}
				// ── Certifications: map name → title (schema uses 'date' not 'period') ──
				if (mappedKey === "certifications") {
					if (item.name && !item.title) item.title = item.name;
				}
				// ── Awards: map name → title, achievement → title ──
				if (mappedKey === "awards") {
					if (item.name && !item.title) item.title = item.name;
					if (item.achievement && !item.title) item.title = item.achievement;
				}
				// ── Projects: map title → name ──
				if (mappedKey === "projects") {
					if (item.title && !item.name) item.name = item.title;
					if (item.date && !item.period) item.period = item.date;
				}
				// ── Skills: handle keywords array ──
				if (mappedKey === "skills") {
					// If skills have a 'list' or 'items' array, convert to keywords
					if (Array.isArray(item.list) && !item.keywords) item.keywords = item.list.map(String);
					if (Array.isArray(item.items) && !item.keywords) item.keywords = item.items.map(String);
				}

				// ── Convert url string → website object for any section that has website ──
				if (typeof item.url === "string" && item.url.trim().length > 0 && !isObject(item.website)) {
					item.website = { url: item.url, label: "", inlineLink: false };
				}

				// Convert JSONResume 'highlights' array into HTML 'description'
				if (Array.isArray(item.highlights) && item.highlights.length > 0) {
					const ul = `<ul>${item.highlights.map((h: unknown) => `<li>${h}</li>`).join('')}</ul>`;
					item.description = item.description ? `${item.description}<br/>${ul}` : ul;
				}

				// Convert 'summary' field to 'description' (JSONResume uses summary, RR uses description)
				if (typeof item.summary === "string" && !item.description) {
					item.description = item.summary;
				}

				// Convert nested objects to string if they leaked into description
				if (isObject(item.description)) {
					item.description = JSON.stringify(item.description);
				}
			}
			return item;
		});
	};

	// 1. Map top-level variations
	for (const key of Object.keys(output)) {
		const mappedKey = mapping[key];
		if (mappedKey) {
			if (mappedKey === "summary") {
				if (typeof output[key] === "string") {
					output.summary = { content: output[key] };
				} else if (isObject(output[key]) && typeof (output[key] as Record<string, unknown>).content === "string") {
					output.summary = output[key];
				}
			} else {
				let itemsArray: unknown[] = Array.isArray(output[key])
					? output[key] as unknown[]
					: isObject(output[key]) && Array.isArray((output[key] as Record<string, unknown>).items)
						? (output[key] as Record<string, unknown>).items as unknown[]
						: [];

				if (itemsArray.length === 0 && isObject(output[key]) && mappedKey === "skills") {
					// If LLM returned a plain object for skills (like a dictionary), map its keys to items
					itemsArray = Object.entries(output[key] as Record<string, unknown>).map(([k, v]) => {
						if (Array.isArray(v)) return { name: k, keywords: v.map(String) };
						return { name: k, keywords: [String(v)] };
					});
				}

				if (Array.isArray(itemsArray) && itemsArray.length > 0) {
					sections[mappedKey] = {
						items: normalizeItemsArray(itemsArray, mappedKey),
					};
				} else if (isObject(output[key])) {
					// LLM sometimes just returns the section directly
					sections[mappedKey] = output[key];
				}
			}
		}
	}

	// 2. Map sections variations and normalize their items too
	for (const key of Object.keys(sections)) {
		const mappedKey = mapping[key] || key; // If no mapping, assume the key is correct

		if (mappedKey && mappedKey !== key) {
			sections[mappedKey] = sections[key];
			// We can delete sections[key] here if we want to clean up, but keeping it is fine as schema validation strips unknowns
		}

		// Ensure items array exists and is normalized
		const sectionObj = sections[mappedKey];
		if (isObject(sectionObj)) {
			if (Array.isArray(sectionObj.items)) {
				sectionObj.items = normalizeItemsArray(sectionObj.items, mappedKey);
			} else if (Array.isArray(sections[key])) {
				// Sometimes sections[key] is just the array directly instead of { items: [...] }
				sections[mappedKey] = { items: normalizeItemsArray(sections[key] as unknown[], mappedKey) };
			}
		} else if (Array.isArray(sections[key])) {
			sections[mappedKey] = { items: normalizeItemsArray(sections[key] as unknown[], mappedKey) };
		}
	}

	// 3. Fix name mapping if in root
	if (typeof output.name === "string" || typeof output.fullName === "string") {
		const name = output.name || output.fullName;
		if (!isObject(output.basics)) {
			output.basics = {};
		}
		if (!(output.basics as Record<string, unknown>).name) {
			(output.basics as Record<string, unknown>).name = name;
		}
	}

	// 4. Normalize basics fields for Reactive Resume schema
	if (isObject(output.basics)) {
		const basics = output.basics as Record<string, unknown>;

		// JSONResume uses "label", Reactive Resume uses "headline"
		if (typeof basics.label === "string" && !basics.headline) {
			basics.headline = basics.label;
		}

		// Prevent headline from being a hallucinated summary
		if (typeof basics.headline === "string") {
			if (basics.headline.length > 100) {
				// Too long to be a real headline, it's likely a duplicated summary
				if (typeof basics.summary !== "string") {
					basics.summary = basics.headline; // Move to summary if summary is empty
				}
				basics.headline = "";
			}
			if (typeof basics.summary === "string" && (basics.headline as string).trim() === basics.summary.trim()) {
				basics.headline = ""; // Exact duplicate
			}
		}

		// Extract summary from basics.summary → output.summary
		if (typeof basics.summary === "string" && basics.summary.trim().length > 0) {
			if (!isObject(output.summary) || !(output.summary as Record<string, unknown>).content) {
				output.summary = { content: basics.summary };
			}
		}

		if (isObject(basics.location)) {
			const loc = basics.location as Record<string, string>;
			const rawParts = [loc.address, loc.city, loc.region, loc.postalCode, loc.countryCode]
				.filter(Boolean)
				.map(p => String(p).trim());
			
			const dedupedParts: string[] = [];
			for (let i = 0; i < rawParts.length; i++) {
				const part = rawParts[i];
				let isRedundant = false;
				for (let j = 0; j < rawParts.length; j++) {
					if (i === j) continue;
					const other = rawParts[j];
					if (other.toLowerCase().includes(part.toLowerCase())) {
						if (other.toLowerCase() === part.toLowerCase()) {
							if (j < i) isRedundant = true;
						} else {
							isRedundant = true;
						}
					}
				}
				if (!isRedundant) {
					dedupedParts.push(part);
				}
			}
			basics.location = dedupedParts.join(", ");
		}

		if (isObject(basics.url) && typeof (basics.url as Record<string, unknown>).url === "string") {
			(basics.url as Record<string, unknown>).href = (basics.url as Record<string, unknown>).url;
		}

		// Delete any profiles or websites to strictly prevent social URL extraction during AI parsing
		delete basics.profiles;
		delete basics.website;
		delete basics.url;
		delete basics.customFields;
	}

	// Delete sections.profiles to prevent any social URLs from leaking
	delete sections.profiles;
	delete output.profiles;

	output.sections = sections;
	return output;
}

function normalizeResumeDataForSchema(data: Record<string, unknown>, diagnostics: ResumeSanitizationDiagnostics) {
	if (!isObject(data)) return data;
	if (!isObject(data.sections)) return data;

	const normalizedSections: Record<string, unknown> = { ...data.sections };

	for (const sectionKey of Object.keys(sectionRequiredFieldMap) as SectionKey[]) {
		const section = normalizedSections[sectionKey];
		if (!isObject(section)) continue;
		if (!Array.isArray(section.items)) continue;

		const itemTemplate = aiExtractionTemplate.sections[sectionKey].items[0] as Record<string, unknown>;
		const requiredField = sectionRequiredFieldMap[sectionKey];

		const normalizedItems = section.items
			.filter((item): item is Record<string, unknown> => isObject(item))
			.map((item) => {
				const mergedItem = mergeDefaults(itemTemplate, item);
				return coerceValueAgainstTemplate(
					mergedItem,
					itemTemplate,
					`sections.${sectionKey}.items`,
					diagnostics,
				) as Record<string, unknown>;
			})
			.filter((item, index) => {
				const requiredValue = item[requiredField];
				if (typeof requiredValue !== "string" || requiredValue.trim().length === 0) {
					diagnostics.salvageApplied = true;
					diagnostics.droppedSectionItems.push({
						section: sectionKey,
						index,
						reason: `missing required "${requiredField}"`,
					});
					return false;
				}

				return true;
			})
			.map((item) => {
				const normalizedItem = { ...item };
				if (typeof normalizedItem.id !== "string" || normalizedItem.id.trim().length === 0) {
					diagnostics.salvageApplied = true;
					normalizedItem.id = generateId();
				}
				if (typeof normalizedItem.hidden !== "boolean") {
					diagnostics.salvageApplied = true;
					normalizedItem.hidden = false;
				}

				return normalizedItem;
			});

		normalizedSections[sectionKey] = { ...section, items: normalizedItems };
	}

	return { ...data, sections: normalizedSections };
}

export function sanitizeAndParseResumeJson(resultText: string): ResumeSanitizationResult {
	let jsonString = resultText;
	const { first, last } = getJsonBoundaryIndices(jsonString);
	if (first !== -1 && last !== -1 && last >= first) {
		jsonString = jsonString.substring(first, last + 1);
	}

	try {
		const diagnostics: ResumeSanitizationDiagnostics = {
			coercions: [],
			droppedSectionItems: [],
			salvageApplied: false,
		};

		const repairedJson = jsonrepair(jsonString);
		console.log("[AI_DEBUG] RAW_JSON_STRING: ", jsonString.slice(0, 500));

		const parsedJson = JSON.parse(repairedJson);
		console.log("[AI_DEBUG] PARSED_JSON_ROOT_KEYS: ", Object.keys(parsedJson));

		const mappedJson = mapAiParserVariations(parsedJson as Record<string, unknown>);
		console.log(
			"[AI_DEBUG] MAPPED_JSON_SECTIONS: ",
			Object.keys((mappedJson.sections as Record<string, unknown>) || {}),
		);

		const mergedData = mergeDefaults(defaultResumeData, mappedJson);
		const coercedData = coerceValueAgainstTemplate(mergedData, defaultResumeData, "", diagnostics);
		const normalizedData = normalizeResumeDataForSchema(coercedData as Record<string, unknown>, diagnostics);

		// Log per-section item counts
		const sectionCounts: Record<string, number> = {};
		if (isObject(normalizedData.sections)) {
			for (const [key, sec] of Object.entries(normalizedData.sections as Record<string, unknown>)) {
				if (isObject(sec) && Array.isArray((sec as Record<string, unknown>).items)) {
					sectionCounts[key] = ((sec as Record<string, unknown>).items as unknown[]).length;
				}
			}
		}
		console.log("[AI_DEBUG] SECTION_ITEM_COUNTS:", sectionCounts);
		console.log("[AI_DEBUG] SUMMARY_CONTENT:", typeof (normalizedData.summary as Record<string, unknown>)?.content === "string" ? "present" : "missing");
		console.log("[AI_DEBUG] BASICS_HEADLINE:", (normalizedData.basics as Record<string, unknown>)?.headline || "missing");

		if (diagnostics.droppedSectionItems.length > 0) {
			console.warn("[AI_DEBUG] DROPPED_ITEMS:", JSON.stringify(diagnostics.droppedSectionItems));
		}

		const data = resumeDataSchema.parse({
			...normalizedData,
			customSections: [],
			picture: defaultResumeData.picture,
			metadata: defaultResumeData.metadata,
		});

		return { data, diagnostics };
	} catch (error: unknown) {
		if (error instanceof ZodError) {
			console.error("Zod validation failed during resume parsing:", flattenError(error));
			throw error;
		}

		console.error("Unknown error during resume data validation:", error);
		throw new Error("An unknown error occurred while validating the merged resume data.");
	}
}
