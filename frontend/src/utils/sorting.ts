export const sortBlockSizes = (blockSizes: number[]): number[] => {
	const getOrder = (size: number): number => {
		const s = String(size);
		if (s.endsWith('k')) return parseInt(s, 10) * 1024;
		if (s.endsWith('M')) return parseInt(s, 10) * 1024 * 1024;
		if (s.endsWith('G')) return parseInt(s, 10) * 1024 * 1024 * 1024;
		return size;
	};

	return blockSizes.sort((a, b) => getOrder(a) - getOrder(b));
};