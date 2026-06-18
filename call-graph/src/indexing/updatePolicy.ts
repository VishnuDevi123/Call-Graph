import type { ParsedFile } from '../analyzer';

export interface ParsedFileUpdateDecision {
	parsedFile: ParsedFile | undefined;
	accepted: boolean;
	retainedLastGood: boolean;
}

export function chooseParsedFileUpdate(previous: ParsedFile | undefined, candidate: ParsedFile): ParsedFileUpdateDecision {
	const hasErrors = candidate.diagnostics.some(diagnostic => diagnostic.severity === 'error');
	if (!hasErrors) {
		return {
			parsedFile: candidate,
			accepted: true,
			retainedLastGood: false,
		};
	}

	return {
		parsedFile: previous,
		accepted: false,
		retainedLastGood: previous !== undefined,
	};
}
