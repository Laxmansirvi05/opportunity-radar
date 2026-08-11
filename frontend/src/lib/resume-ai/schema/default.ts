import type { ResumeData } from "./data";

export const defaultResumeData: ResumeData = {
	picture: {
		hidden: false,
		url: "",
		size: 80,
		rotation: 0,
		aspectRatio: 1,
		borderRadius: 0,
		borderColor: "",
		borderWidth: 0,
		shadowColor: "",
		shadowWidth: 0,
	},
	basics: {
		name: "",
		headline: "",
		email: "",
		phone: "",
		location: "",
		website: { url: "", label: "" },
		customFields: [],
	},
	summary: {
		title: "",
		columns: 1,
		hidden: false,
		content: "",
	},
	sections: {
		profiles: { title: "", columns: 1, hidden: false, items: [] },
		experience: { title: "", columns: 1, hidden: false, items: [] },
		education: { title: "", columns: 1, hidden: false, items: [] },
		projects: { title: "", columns: 1, hidden: false, items: [] },
		skills: { title: "", columns: 1, hidden: false, items: [] },
		languages: { title: "", columns: 1, hidden: false, items: [] },
		interests: { title: "", columns: 1, hidden: false, items: [] },
		awards: { title: "", columns: 1, hidden: false, items: [] },
		certifications: { title: "", columns: 1, hidden: false, items: [] },
		publications: { title: "", columns: 1, hidden: false, items: [] },
		volunteer: { title: "", columns: 1, hidden: false, items: [] },
		references: { title: "", columns: 1, hidden: false, items: [] },
	},
	customSections: [],
	metadata: {
		template: "onyx",
		layout: {
			sidebarWidth: 35,
			pages: [{ fullWidth: false, main: [], sidebar: [] }],
		},
		page: {
			gapX: 4, gapY: 6, marginX: 14, marginY: 12, format: "a4", locale: "en-US", hideIcons: false,
		},
		design: {
			colors: { primary: "", text: "", background: "" },
			level: { icon: "star", type: "circle" },
		},
		typography: {
			body: { fontFamily: "", fontWeights: ["400"], fontSize: 10, lineHeight: 1.5 },
			heading: { fontFamily: "", fontWeights: ["600"], fontSize: 14, lineHeight: 1.5 },
		},
		notes: "",
	},
};
