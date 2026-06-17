import type { ParsedFile } from './types';

export interface ParseInput {
	filePath: string;
	source: string;
}

export interface SourceParser {
	readonly languageId: string;
	parse(input: ParseInput): ParsedFile;
}

export interface AsyncSourceParserFactory<TParser extends SourceParser> {
	create(): Promise<TParser>;
}
