import { selectCvm, checkCvmExists } from "@/src/api/cvms";
import { logger } from "./logger";

/**
 * Resolves a CVM App ID either by prompting the user to select one if none is provided,
 * or by validating the provided App ID exists.
 *
 * @param appId Optional App ID to resolve
 * @returns The resolved App ID or undefined if none was selected/found
 */
export async function resolveCvmAppId(
	appId?: string,
): Promise<string | undefined> {
	if (!appId) {
		// If no app ID is provided, prompt user to select one
		const selectedCvm = await selectCvm();
		if (!selectedCvm) {
			return undefined; // No CVMs found or user canceled
		}
		return selectedCvm;
	}
	// Verify the provided App ID exists
	return await checkCvmExists(appId);
}