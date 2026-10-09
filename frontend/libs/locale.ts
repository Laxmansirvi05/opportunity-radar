import { type Messages } from "@lingui/core";
import { enUS as en } from "date-fns/locale";

import { i18n } from "@lingui/core";
import { compileMessage } from "@lingui/message-utils/compileMessage";

export const locales = ["en"];

export const languageNames = {
	en: "English",
};

export const defaultLocale = "en";

// No compiled catalogue ships with this app: each message carries its own
// English text (next.config.ts keeps it in the bundle). Without a compiler
// Lingui logs "Uncompiled message detected" for every label it renders, a
// few hundred console warnings per Resume Builder page in production, and
// plurals and interpolation would not be applied.
i18n.setMessagesCompiler(compileMessage);
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
