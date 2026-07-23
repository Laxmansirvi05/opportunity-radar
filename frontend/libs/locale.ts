import { type Messages } from "@lingui/core";
import { setupI18n } from "@lingui/core";
import { enUS as en } from "date-fns/locale";

import { i18n } from "@lingui/core";

export const locales = ["en"];

export const languageNames = {
	en: "English",
};

export const defaultLocale = "en";

i18n.load({ en: {} });
i18n.activate(defaultLocale);

export { i18n };

export const dateLocales: Record<string, any> = { en };

export const getLocale = () => defaultLocale;
export const setLocale = (locale: string) => {};
export const setLocaleCookie = (locale: string) => {};
export const loadLocale = async (locale: string) => {};
export const isLocale = (locale: string) => locale === "en";
export const localeMap = { en: "English" };
export const resolveLocale = () => defaultLocale;
export const getLocaleMessages = async (locale: string): Promise<Messages> => ({});
export const isRTL = (locale: string) => false;
