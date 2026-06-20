export const useForm = () => ({ Field: ({ children }: any) => children({ state: { value: "" }, handleChange: () => {} }), handleSubmit: () => {} });
