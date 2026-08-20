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
/**
 * Callers pass the locale they want; this app ships English only, so anything
 * unsupported resolves to the default rather than being rejected. The
 * parameter was missing entirely, which made every call site a type error.
 */
export const resolveLocale = (locale?: string) => (locale && isLocale(locale) ? locale : defaultLocale);
export const getLocaleMessages = async (locale: string): Promise<Messages> => ({});
export const isRTL = (locale: string) => false;
