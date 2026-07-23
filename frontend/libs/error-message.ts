export const getErrorMessage = (error: any) => {
	return typeof error === "string" ? error : error?.message || "An unknown error occurred.";
};
export const getReadableErrorMessage = (error: any) => "An error occurred";
export const getResumeErrorMessage = (error: any) => getErrorMessage(error);
