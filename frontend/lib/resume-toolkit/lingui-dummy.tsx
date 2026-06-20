import React from "react";

export const t = (strings: TemplateStringsArray | string, ...values: any[]) => {
  if (typeof strings === "string") return strings;
  return strings.reduce((acc, str, i) => acc + str + (values[i] || ""), "");
};

export const plural = (value: number, options: any) => {
  return options[value] || options.other;
};

export const Trans = ({ message, children }: any) => {
  return <>{message || children}</>;
};

export const Plural = ({ value, _0, _1, other }: any) => {
  return <>{value === 0 ? _0 : value === 1 ? _1 : other}</>;
};

export const useLingui = () => {
  return {
    i18n: {
      load: () => {},
      activate: () => {},
      t,
    },
  };
};

export const I18nProvider = ({ children }: any) => {
  return <>{children}</>;
};

export const i18n = {
  load: () => {},
  activate: () => {},
  t,
};
