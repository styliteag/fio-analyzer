// Convert block size string to numeric value in bytes for comparison
function blockSizeToBytes(blockSize: string | number): number {
	if (typeof blockSize === 'number') {
		return blockSize;
	}
	
	const str = blockSize.toString().toLowerCase();
	const num = parseInt(str);
	
	if (str.includes('g')) {
		return num * 1024 * 1024 * 1024; // GB to bytes
	} else if (str.includes('m')) {
		return num * 1024 * 1024; // MB to bytes
	} else if (str.includes('k')) {
		return num * 1024; // KB to bytes
	} else {
		// Plain number - assume it's already in bytes
		return typeof blockSize === 'number' ? blockSize : num;
	}
}

// Sort block sizes in logical order (512 < 1K < 4K < 64K < 1M < 2G)
export const sortBlockSizes = (blockSizes: (string | number)[]): (string | number)[] => {
	return [...blockSizes].sort((a, b) => {
		const bytesA = blockSizeToBytes(a);
		const bytesB = blockSizeToBytes(b);
		return bytesA - bytesB;
	});
};